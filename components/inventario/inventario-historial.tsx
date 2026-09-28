"use client"

/**
 * Historial de movimientos de inventario.
 *
 * Todo lo que entró y salió, con su contexto: tela, cantidad, fecha,
 * quién lo registró y —en las salidas que genera Corte— a qué pedido y
 * cliente corresponde.
 *
 * La columna de origen distingue lo automático de lo capturado a mano, y
 * no es un adorno: los movimientos manuales solo dejan el motivo en
 * texto libre, donde hay más de cien formas de escribir "consumo ODT"
 * sin decir de qué orden. Mostrarlos como equivalentes daría a entender
 * que todo el consumo es igual de rastreable.
 */

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  cargarHistorial,
  resumirHistorial,
  type MovimientoHistorial,
} from "@/lib/inventario/historial"

const yd = (n: number, dec = 2) =>
  n.toLocaleString("es-CO", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })

function fmtFecha(v: string) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function InventarioHistorial() {
  const [movs, setMovs] = useState<MovimientoHistorial[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [tipo, setTipo] = useState("todos")
  const [origen, setOrigen] = useState("todos")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const cargar = async () => {
    setCargando(true)
    try {
      setMovs(await cargarHistorial())
    } catch (e) {
      toast.error("No se pudo cargar el historial", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    void cargar()
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return movs
      .filter((m) => tipo === "todos" || m.tipo === tipo)
      .filter(
        (m) =>
          origen === "todos" ||
          (origen === "auto" ? m.automatico : !m.automatico)
      )
      .filter((m) => !desde || m.fecha.slice(0, 10) >= desde)
      .filter((m) => !hasta || m.fecha.slice(0, 10) <= hasta)
      .filter(
        (m) =>
          !q ||
          [m.tela, m.pedido, m.cliente, m.motivo, m.usuario, m.coreNombre]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      )
  }, [movs, busqueda, tipo, origen, desde, hasta])

  const r = useMemo(() => resumirHistorial(visibles), [visibles])

  const exportar = () => {
    if (visibles.length === 0) {
      toast.error("No hay movimientos que exportar")
      return
    }
    const hoja = XLSX.utils.json_to_sheet(
      visibles.map((m) => ({
        Fecha: m.fecha,
        Tipo: m.tipo === "INGRESO" ? "Ingreso" : "Salida",
        Tela: m.tela,
        Yardas: m.yardas,
        Metros: m.metros,
        Pedido: m.pedido ?? "",
        Cliente: m.cliente ?? "",
        Marker: m.coreNombre ?? "",
        Origen: m.automatico ? "Automático" : "Manual",
        Usuario: m.usuario ?? "",
        Motivo: m.motivo ?? "",
      }))
    )
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, "Historial")
    XLSX.writeFile(
      libro,
      `historial-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
    toast.success(`${visibles.length} movimientos exportados`)
  }

  if (cargando)
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          icono={<History className="size-3.5" />}
          titulo="Movimientos"
          valor={String(r.movimientos)}
        />
        <Tarjeta
          icono={<ArrowDownToLine className="size-3.5 text-emerald-600" />}
          titulo="Ingresos"
          valor={yd(r.yardasIngreso, 1)}
          pie={`${r.ingresos} movimientos · yardas`}
        />
        <Tarjeta
          icono={<ArrowUpFromLine className="size-3.5 text-rose-600" />}
          titulo="Salidas"
          valor={yd(r.yardasSalida, 1)}
          pie={`${r.salidas} movimientos · yardas`}
        />
        <Tarjeta
          titulo="Neto"
          valor={yd(r.neto, 1)}
          pie={r.neto >= 0 ? "entró más de lo que salió" : "salió más de lo que entró"}
          clase={r.neto < 0 ? "text-rose-700" : "text-emerald-700"}
        />
      </div>

      {/* Cuántas salidas dicen a qué orden pertenecen. Es la medida de si
          el inventario se puede auditar contra producción. */}
      {r.salidas > 0 && r.salidasTrazables < r.salidas && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-600">
            <strong>
              {r.salidasTrazables} de {r.salidas}
            </strong>{" "}
            salidas dicen a qué pedido corresponden. Las demás se capturaron a
            mano antes de que Corte generara el descuento, y su motivo es texto
            libre.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Tela, pedido, cliente, marker, usuario o motivo…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="INGRESO">Ingresos</SelectItem>
                <SelectItem value="DESCUENTO">Salidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origen</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="auto">De producción</SelectItem>
                <SelectItem value="manual">Capturados a mano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportar} className="h-8">
            <Download className="mr-1.5 size-3.5" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void cargar()}
            className="h-8"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {visibles.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {movs.length === 0
              ? "Todavía no hay movimientos de inventario."
              : "Ningún movimiento coincide con los filtros."}
          </p>
        ) : (
          <div className="max-h-[62dvh] overflow-auto">
            <Table className="min-w-[70rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead className="text-right">Yardas</TableHead>
                  <TableHead className="text-right">Metros</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Registró</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((m) => {
                  const entra = m.tipo === "INGRESO"
                  return (
                    <TableRow key={m.id} className="hover:bg-slate-50/60">
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {fmtFecha(m.fecha)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            entra
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-rose-300 bg-rose-50 text-rose-800"
                          )}
                        >
                          {entra ? (
                            <ArrowDownToLine className="mr-1 size-3" />
                          ) : (
                            <ArrowUpFromLine className="mr-1 size-3" />
                          )}
                          {entra ? "Ingreso" : "Salida"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-slate-700">
                        {m.tela}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          entra ? "text-emerald-700" : "text-rose-700"
                        )}
                      >
                        {entra ? "+" : "−"}
                        {yd(m.yardas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {yd(m.metros)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {m.pedido ?? (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[13rem] truncate text-slate-600">
                        {m.cliente ?? "—"}
                      </TableCell>
                      <TableCell>
                        {m.automatico ? (
                          <Badge
                            variant="outline"
                            className="border-cyan-300 bg-cyan-50 text-[10px] text-cyan-800"
                            title={
                              m.coreNombre
                                ? `Generado al cerrar el marker ${m.coreNombre}`
                                : "Generado al cerrar el corte o la sublimación"
                            }
                          >
                            {m.coreNombre ?? "Producción"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Manual</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs text-slate-600">
                        {m.usuario ?? "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[16rem] truncate text-xs text-slate-500"
                        title={m.motivo ?? undefined}
                      >
                        {m.motivo ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Tarjeta({
  icono,
  titulo,
  valor,
  pie,
  clase,
}: {
  icono?: React.ReactNode
  titulo: string
  valor: string
  pie?: string
  clase?: string
}) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
        {icono}
        {titulo}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums text-slate-800", clase)}>
        {valor}
      </p>
      {pie && <p className="text-[10px] text-slate-400">{pie}</p>}
    </Card>
  )
}
