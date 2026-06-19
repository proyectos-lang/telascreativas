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

  // Estado del flujo de confirmacion para Procesar Reposicion
  const [toProcess, setToProcess] = useState<Incidencia | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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
    const procesoForThisArea = procesoReposicionForArea(area)

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

    // Aplicamos el filtro de visibilidad combinando el array nuevo con el
    // fallback legacy. Si el area actual no mapea a ningun proceso (ej.
    // Diseno o Empaque), unicamente respetamos el comportamiento legacy
    // de `area_genera` para no romper nada.
    const rows = rawRows.filter((inc) => {
      const procesos = inc.procesos_reposicion
      if (Array.isArray(procesos) && procesos.length > 0) {
        // Modelo nuevo: la incidencia define explicitamente su ruteo.
        // Solo aparece si el modulo actual esta listado.
        if (!procesoForThisArea) return false
        return procesos.includes(procesoForThisArea)
      }
      // Modelo legacy / sin ruteo definido -> filtrar por area_genera.
      return inc.area_genera === area
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
          Incidencias donde esta area es la responsable (
          <span className="font-medium text-foreground">{area}</span>).
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
        <div className="rounded-md border overflow-x-auto bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Pedido</TableHead>
                <TableHead className="whitespace-nowrap">Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Genero</TableHead>
                <TableHead className="whitespace-nowrap">Talla</TableHead>
                <TableHead className="whitespace-nowrap">
                  Motivo Especifico
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  Area que Reporta
                </TableHead>
                <TableHead className="min-w-[240px]">Descripcion</TableHead>
                <TableHead className="whitespace-nowrap">
                  Partes a Reponer
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  Procesos Activos
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  Fecha Reporte
                </TableHead>
                <TableHead className="whitespace-nowrap">Estado</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Accion
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidencias.map((inc) => {
                const isPending =
                  inc.genera_reposicion === true &&
                  (inc.estado_reposicion ?? "").toLowerCase() === "pendiente"

                const fechaReporte = inc.fecha_reporte || inc.created_at || ""

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
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {clienteMap[inc.pedido] || (
                        <span className="italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {inc.genero || <span className="italic">-</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {inc.talla || <span className="italic">-</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {inc.motivo_especifico || <span className="italic">-</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <Badge variant="outline">{inc.area_reporta}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="max-w-md whitespace-pre-wrap break-words">
                        {inc.descripcion}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {inc.genera_reposicion && inc.partes_reposicion ? (
                        <div className="flex flex-wrap gap-1">
                          {inc.partes_reposicion
                            .split(",")
                            .map((p) => p.trim())
                            .filter(Boolean)
                            .map((parte) => (
                              <Badge
                                key={parte}
                                variant="outline"
                                className="text-xs"
                              >
                                {parte}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {Array.isArray(inc.procesos_reposicion) &&
                      inc.procesos_reposicion.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {inc.procesos_reposicion.map((proc) => {
                            // Resaltamos en rojo el proceso que coincide con
                            // el modulo actual; los demas en gris para dar
                            // contexto del recorrido completo de la pieza.
                            const procActual =
                              procesoReposicionForArea(area) === proc
                            return (
                              <Badge
                                key={proc}
                                className={
                                  procActual
                                    ? "bg-rose-600 hover:bg-rose-700 text-white text-xs"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs border-transparent"
                                }
                              >
                                {proc}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          legacy
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
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
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <PlayCircle className="mr-1 size-3.5" />
                          Procesar Reposicion
                        </Button>
                      ) : inc.fecha_procesado ? (
                        <span className="text-xs text-muted-foreground">
                          Procesado el{" "}
                          {formatDateTimeLong(inc.fecha_procesado)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          -
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
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
