"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { formatDateShort, formatDateTimeLong } from "@/lib/date-utils"
import {
  procesoReposicionForArea,
  type Area,
} from "./modal-reporte-incidencia"

// Cliente de Supabase local al componente (mismo patron que el modal de reporte).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export interface Incidencia {
  id: number | string
  pedido: string
  area_reporta: string
  area_genera: string
  descripcion: string
  genera_reposicion: boolean | null
  partes_reposicion: string | null
  // Array de procesos por los que debe pasar la reposicion fisica
  // (Tela / Impresion / Corte / Sublimacion / Costura / Accesorios).
  // Persistido como text[] en Postgres. Puede venir como null en
  // incidencias antiguas creadas antes del feature de ruteo selectivo.
  procesos_reposicion: string[] | null
  estado_reposicion: string | null
  fecha_reporte: string | null
  fecha_procesado: string | null
  created_at?: string | null
  // Campos de contexto de la prenda afectada
  talla?: string | null
  genero?: string | null
  motivo_especifico?: string | null
}

interface IncidenciasTabProps {
  /** Area productiva del modulo actual; filtra incidencias por area_genera */
  area: Area
  /**
   * Callback opcional para notificar al padre cuantas reposiciones estan
   * pendientes (para pintar el badge rojo del Tab).
   */
  onPendingCountChange?: (count: number) => void
  /** Clase de acento para iconos del modulo (ej. text-icon-magenta) */
  accentClass?: string
}

export function IncidenciasTab({
  area,
  onPendingCountChange,
  accentClass = "text-rose-600",
}: IncidenciasTabProps) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  // Mapa pedido -> cliente obtenido de telas.cabecera para enriquecer la tabla.
  const [clienteMap, setClienteMap] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Proceso de reposicion que corresponde a este modulo (null si no aplica).
  // Se calcula una vez al montar ya que `area` es una prop estable.
  const procesoForThisArea = procesoReposicionForArea(area)

  // Estado del flujo de confirmacion para Procesar Reposicion
  const [toProcess, setToProcess] = useState<Incidencia | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Filtros de la tabla (por pedido, cliente y area que reporta).
  const [fPedido, setFPedido] = useState("")
  const [fCliente, setFCliente] = useState("")
  const [fArea, setFArea] = useState("todas")

  const fetchIncidencias = useCallback(async () => {
    if (!supabase) {
      setError("Cliente de Supabase no configurado.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    // Nuevo modelo de visibilidad (ruteo selectivo):
    //  - Una incidencia solo se muestra en este modulo si su array
    //    `procesos_reposicion` contiene el valor mapeado del area
    //    (p. ej. modulo "Impresion" -> busca "Impresion" en el array).
    //  - Compatibilidad hacia atras: las incidencias antiguas no tienen
    //    `procesos_reposicion` (es null); para esas seguimos filtrando
    //    por `area_genera` para que no se pierdan en el sistema.
    //
    // Estrategia: hacemos UN solo SELECT trayendo todas las incidencias
    // del pedido relevante (filtro amplio en BD) y luego refinamos en
    // cliente. Esto es mas simple que combinar dos queries con OR sobre
    // arrays, y la cantidad de incidencias por modulo es baja.
    const { data, error: fetchError } = await supabase
      .schema("telas")
      .from("incidencias")
      .select("*")

    if (fetchError) {
      setError(fetchError.message)
      setIsLoading(false)
      return
    }

    const rawRows = (data ?? []) as Incidencia[]

    // Regla de visibilidad:
    //  1. Siempre visible si este modulo ES el area que genero el error
    //     (area_genera). El area responsable siempre debe ver y gestionar
    //     la incidencia que originó, independientemente del ruteo de
    //     reposicion.
    //  2. Tambien visible si el area actual esta listada en
    //     procesos_reposicion (la reposicion fisica pasa por aqui).
    //  Las dos condiciones son independientes; una incidencia puede cumplir
    //  ambas al mismo tiempo sin duplicarse.
    const rows = rawRows.filter((inc) => {
      // Condicion 1: esta area genero el error.
      if (inc.area_genera === area) return true

      // Condicion 2: esta area debe procesar la reposicion.
      const procesos = inc.procesos_reposicion
      if (!Array.isArray(procesos) || procesos.length === 0) return false
      if (!procesoForThisArea) return false
      return procesos.includes(procesoForThisArea)
    })

    // Ordenamos mas recientes primero. Usamos fecha_reporte, con fallback a
    // created_at si la tabla usa esa convencion.
    rows.sort((a, b) => {
      const ta = new Date(a.fecha_reporte || a.created_at || 0).getTime()
      const tb = new Date(b.fecha_reporte || b.created_at || 0).getTime()
      return tb - ta
    })

    setIncidencias(rows)

    // Enriquecer con el nombre de cliente desde telas.cabecera.
    // Obtenemos los pedidos unicos presentes en las incidencias y hacemos
    // una sola consulta al servidor para traer pedido + cliente.
    const pedidosUnicos = [...new Set(rows.map((r) => r.pedido).filter(Boolean))]
    if (pedidosUnicos.length > 0) {
      const { data: cabeceraData } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("pedido, cliente")
        .in("pedido", pedidosUnicos)

      if (cabeceraData) {
        const map: Record<string, string> = {}
        for (const row of cabeceraData as { pedido: string; cliente: string }[]) {
          if (row.pedido) map[row.pedido] = row.cliente ?? ""
        }
        setClienteMap(map)
      }
    }

    setIsLoading(false)
  }, [area])

  useEffect(() => {
    fetchIncidencias()
  }, [fetchIncidencias])

  // Conteo de reposiciones pendientes para el badge del Tab
  const pendingCount = useMemo(
    () =>
      incidencias.filter(
        (i) =>
          i.genera_reposicion === true &&
          (i.estado_reposicion ?? "").toLowerCase() === "pendiente"
      ).length,
    [incidencias]
  )

  // Notificamos al padre cada vez que cambia el conteo.
  useEffect(() => {
    onPendingCountChange?.(pendingCount)
  }, [pendingCount, onPendingCountChange])

  // Áreas distintas que aparecen como "area_reporta" (para el filtro).
  const areasReporta = useMemo(
    () =>
      [...new Set(incidencias.map((i) => i.area_reporta).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [incidencias]
  )

  // Filtrado en cliente por pedido, cliente y área que reporta.
  const filtered = useMemo(() => {
    const p = fPedido.trim().toLowerCase()
    const c = fCliente.trim().toLowerCase()
    return incidencias.filter((inc) => {
      if (p && !(inc.pedido ?? "").toLowerCase().includes(p)) return false
      if (c && !(clienteMap[inc.pedido] ?? "").toLowerCase().includes(c)) return false
      if (fArea !== "todas" && inc.area_reporta !== fArea) return false
      return true
    })
  }, [incidencias, clienteMap, fPedido, fCliente, fArea])

  const hayFiltros = fPedido.trim() !== "" || fCliente.trim() !== "" || fArea !== "todas"
  const limpiarFiltros = () => {
    setFPedido("")
    setFCliente("")
    setFArea("todas")
  }

  /**
   * Ejecuta el UPDATE sobre telas.incidencias para marcar una reposicion
   * como procesada y refresca la tabla local sin necesidad de un refetch
   * completo (optimizacion UX).
   */
  const handleConfirmProcess = async () => {
    if (!toProcess || !supabase) return
    setIsProcessing(true)

    const nowIso = new Date().toISOString()

    const { error: updateError } = await supabase
      .schema("telas")
      .from("incidencias")
      .update({
        estado_reposicion: "Procesado",
        fecha_procesado: nowIso,
      })
      .eq("id", toProcess.id)

    setIsProcessing(false)

    if (updateError) {
      toast.error("No se pudo procesar la reposicion", {
        description: updateError.message,
      })
      return
    }

    // Update local: la fila pasa a Procesado con la fecha recien guardada.
    setIncidencias((prev) =>
      prev.map((i) =>
        i.id === toProcess.id
          ? {
              ...i,
              estado_reposicion: "Procesado",
              fecha_procesado: nowIso,
            }
          : i
      )
    )

    toast.success("Reposicion procesada", {
      description: `La reposicion del pedido ${toProcess.pedido} quedo marcada como Procesado.`,
    })
    setToProcess(null)
  }

  // Helpers visuales
  const renderEstadoBadge = (inc: Incidencia) => {
    if (!inc.genera_reposicion) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Sin reposicion
        </Badge>
      )
    }
    const estado = (inc.estado_reposicion ?? "Pendiente").toLowerCase()
    if (estado === "procesado") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle2 className="mr-1 size-3" />
          Procesado
        </Badge>
      )
    }
    return (
      <Badge className="bg-rose-600 hover:bg-rose-700 text-white">
        <AlertOctagon className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Incidencias generadas por{" "}
          <span className="font-medium text-foreground">{area}</span> o donde
          esta area debe procesar la reposicion.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchIncidencias}
          disabled={isLoading}
        >
          <RefreshCw
            className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Error al cargar incidencias: {error}
          </AlertDescription>
        </Alert>
      )}

      {!error && isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Cargando incidencias...
        </div>
      )}

      {!error && !isLoading && incidencias.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
          <Inbox className={`size-8 ${accentClass}`} />
          <p className="text-sm">
            No hay incidencias registradas contra el area de{" "}
            <span className="font-medium">{area}</span>.
          </p>
        </div>
      )}

      {!error && !isLoading && incidencias.length > 0 && (
        <>
          {/* Filtros: por pedido, cliente y área que reporta */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fPedido}
                onChange={(e) => setFPedido(e.target.value)}
                placeholder="Pedido"
                className="h-8 w-28 pl-7 text-xs"
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fCliente}
                onChange={(e) => setFCliente(e.target.value)}
                placeholder="Cliente"
                className="h-8 w-40 pl-7 text-xs"
              />
            </div>
            <Select value={fArea} onValueChange={setFArea}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="Área que reporta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las áreas</SelectItem>
                {areasReporta.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hayFiltros && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="h-8 px-2 text-xs text-muted-foreground"
              >
                <X className="mr-1 size-3.5" />
                Limpiar
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} de {incidencias.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border bg-white py-8 text-center text-xs text-muted-foreground">
              Ninguna incidencia coincide con los filtros.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto bg-white">
              <Table className="text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:text-xs [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">Género</TableHead>
                    <TableHead className="whitespace-nowrap">Talla</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="whitespace-nowrap">Rol</TableHead>
                    <TableHead className="whitespace-nowrap">Reporta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Partes</TableHead>
                    <TableHead>Procesos</TableHead>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inc) => {
                    const isPending =
                      inc.genera_reposicion === true &&
                      (inc.estado_reposicion ?? "").toLowerCase() === "pendiente"

                    const fechaReporte = inc.fecha_reporte || inc.created_at || ""

                    // Determinar por que razon este modulo ve la incidencia
                    const esGenerador = inc.area_genera === area
                    const esReposicion =
                      procesoForThisArea !== null &&
                      Array.isArray(inc.procesos_reposicion) &&
                      inc.procesos_reposicion.includes(procesoForThisArea)

                    return (
                      <TableRow
                        key={inc.id}
                        className={
                          isPending
                            ? "bg-rose-50/60 hover:bg-rose-50"
                            : "hover:bg-muted/40"
                        }
                      >
                        <TableCell className="font-medium whitespace-nowrap">
                          {inc.pedido}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span
                            className="block max-w-[120px] truncate"
                            title={clienteMap[inc.pedido] || undefined}
                          >
                            {clienteMap[inc.pedido] || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {inc.genero || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {inc.talla || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span
                            className="block max-w-[110px] truncate"
                            title={inc.motivo_especifico || undefined}
                          >
                            {inc.motivo_especifico || "-"}
                          </span>
                        </TableCell>
                        {/* Rol: por que este modulo ve la incidencia */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {esGenerador && (
                              <Badge className="w-fit border border-orange-300 bg-orange-100 px-1.5 py-0 text-[9px] font-medium text-orange-800 hover:bg-orange-200">
                                Generó error
                              </Badge>
                            )}
                            {esReposicion && (
                              <Badge className="w-fit border border-rose-300 bg-rose-100 px-1.5 py-0 text-[9px] font-medium text-rose-800 hover:bg-rose-200">
                                Procesa repo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px]">
                            {inc.area_reporta}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p
                            className="line-clamp-2 max-w-[200px] break-words"
                            title={inc.descripcion}
                          >
                            {inc.descripcion}
                          </p>
                        </TableCell>
                        <TableCell>
                          {inc.genera_reposicion && inc.partes_reposicion ? (
                            <div className="flex max-w-[130px] flex-wrap gap-1">
                              {inc.partes_reposicion
                                .split(",")
                                .map((p) => p.trim())
                                .filter(Boolean)
                                .map((parte) => (
                                  <Badge
                                    key={parte}
                                    variant="outline"
                                    className="px-1 py-0 text-[10px]"
                                  >
                                    {parte}
                                  </Badge>
                                ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(inc.procesos_reposicion) &&
                          inc.procesos_reposicion.length > 0 ? (
                            <div className="flex max-w-[150px] flex-wrap gap-1">
                              {inc.procesos_reposicion.map((proc) => {
                                const procActual =
                                  procesoReposicionForArea(area) === proc
                                return (
                                  <Badge
                                    key={proc}
                                    className={
                                      procActual
                                        ? "bg-rose-600 px-1 py-0 text-[10px] text-white hover:bg-rose-700"
                                        : "border-transparent bg-slate-100 px-1 py-0 text-[10px] text-slate-700 hover:bg-slate-200"
                                    }
                                  >
                                    {proc}
                                  </Badge>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">
                              legacy
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {fechaReporte ? formatDateShort(fechaReporte) : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {renderEstadoBadge(inc)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => setToProcess(inc)}
                              className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                            >
                              <PlayCircle className="mr-1 size-3.5" />
                              Procesar
                            </Button>
                          ) : inc.fecha_procesado ? (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTimeLong(inc.fecha_procesado)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Confirmacion antes de marcar como Procesado */}
      <AlertDialog
        open={toProcess !== null}
        onOpenChange={(v) => {
          if (!v && !isProcessing) setToProcess(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Procesar Reposicion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirmas que la reposicion del pedido{" "}
              <span className="font-medium text-foreground">
                {toProcess?.pedido}
              </span>{" "}
              ya fue procesada? Se marcara como{" "}
              <span className="font-medium text-foreground">Procesado</span> y
              se registrara la fecha y hora actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevenimos que AlertDialog cierre antes de completarse el UPDATE
                e.preventDefault()
                handleConfirmProcess()
              }}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 size-4" />
              )}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
