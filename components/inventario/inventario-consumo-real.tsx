"use client"

/**
 * Consumo real de tela, sin comparar contra nada.
 *
 * La auditoría contra el marker solo puede mirar las órdenes que tienen
 * las dos cifras —hoy una minoría—, y eso deja fuera la mayor parte del
 * gasto de tela. Esta vista toma TODAS las órdenes con consumo
 * registrado: es la que responde "cuánta tela se gastó y en qué".
 *
 * Como aquí no hay teórico contra el que medir, la señal de si una orden
 * consumió lo razonable son las YARDAS POR PIEZA. Se muestra por orden y
 * por grupo para poder comparar entre sí lo que no se puede comparar
 * contra un trazo.
 */

import { useMemo, useState } from "react"
import {
  Download,
  Layers,
  Package,
  RefreshCw,
  Ruler,
  Search,
  Users,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  agruparConsumo,
  resumirConsumo,
  type FilaAuditoria,
} from "@/lib/inventario/auditoria-consumo"

const yd = (n: number | null | undefined, dec = 1) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("es-CO", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })

function fmtFecha(v: string | null) {
  if (!v) return "—"
  const [y, m, d] = v.split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

type Agrupacion = "tela" | "cliente" | "estilo" | "semana"

const AGRUPACIONES: { valor: Agrupacion; label: string }[] = [
  { valor: "tela", label: "Tela" },
  { valor: "cliente", label: "Cliente" },
  { valor: "estilo", label: "Estilo de prenda" },
  { valor: "semana", label: "Semana de corte" },
]

interface Props {
  filas: FilaAuditoria[]
  onRecargar: () => void
}

/**
 * No recibe `cargando`: el componente padre corta con su propio skeleton
 * antes de montar las pestañas, así que esto solo se renderiza con los
 * datos ya en memoria.
 */
export function InventarioConsumoReal({ filas, onRecargar }: Props) {
  const [busqueda, setBusqueda] = useState("")
  const [tela, setTela] = useState("todas")
  const [semana, setSemana] = useState("todas")
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("tela")

  /** Solo las que tienen consumo: es de lo que trata esta pantalla. */
  const conConsumo = useMemo(
    () => filas.filter((f) => f.reales !== null),
    [filas]
  )

  const telas = useMemo(
    () => [...new Set(conConsumo.map((f) => f.tela))].sort(),
    [conConsumo]
  )
  const semanas = useMemo(
    () =>
      [...new Set(conConsumo.map((f) => f.semana).filter((s): s is number => s !== null))].sort(
        (a, b) => a - b
      ),
    [conConsumo]
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return conConsumo
      .filter((f) => tela === "todas" || f.tela === tela)
      .filter((f) => semana === "todas" || String(f.semana) === semana)
      .filter(
        (f) =>
          !q ||
          [f.pedido, f.cliente, f.estilo, f.tela, f.coreNombre]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      )
      .sort((a, b) => (b.reales ?? 0) - (a.reales ?? 0))
  }, [conConsumo, busqueda, tela, semana])

  const resumen = useMemo(() => resumirConsumo(visibles), [visibles])

  const grupos = useMemo(() => {
    const clave =
      agrupacion === "tela"
        ? (f: FilaAuditoria) => f.tela
        : agrupacion === "cliente"
          ? (f: FilaAuditoria) => f.cliente
          : agrupacion === "estilo"
            ? (f: FilaAuditoria) => f.estilo
            : (f: FilaAuditoria) =>
                f.semana !== null ? `Semana ${f.semana}` : null
    return agruparConsumo(visibles, clave)
  }, [visibles, agrupacion])

  const exportar = () => {
    if (visibles.length === 0) {
      toast.error("No hay filas que exportar")
      return
    }
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        visibles.map((f) => ({
          Pedido: f.pedido,
          Cliente: f.cliente ?? "",
          Estilo: f.estilo ?? "",
          Tela: f.tela,
          Marker: f.coreNombre ?? "",
          "Fecha corte": f.fechaCorte ?? "",
          Semana: f.semana ?? "",
          "Piezas cortadas": f.piezasCortadas ?? "",
          "Piezas malas": f.piezasMalas ?? "",
          "Yardas reales": f.reales ?? "",
          "Yd/pieza":
            f.rendimiento !== null ? Number(f.rendimiento.toFixed(4)) : "",
          "Yardas teóricas": f.teoricas ?? "",
          Comentario: f.comentarioCorte ?? "",
        }))
      ),
      "Consumo real"
    )
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        grupos.map((g) => ({
          [AGRUPACIONES.find((a) => a.valor === agrupacion)!.label]: g.clave,
          Órdenes: g.ordenes,
          Yardas: Number(g.yardas.toFixed(2)),
          Piezas: g.piezas,
          "Yd/pieza":
            g.rendimiento !== null ? Number(g.rendimiento.toFixed(4)) : "",
        }))
      ),
      "Resumen"
    )
    XLSX.writeFile(
      libro,
      `consumo-real-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
    toast.success(`${visibles.length} órdenes exportadas`)
  }

  const maxGrupo = Math.max(...grupos.map((g) => g.yardas), 1)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta
          icono={<Package className="size-3.5" />}
          titulo="Órdenes"
          valor={String(resumen.ordenes)}
          pie="con consumo registrado"
        />
        <Tarjeta
          icono={<Ruler className="size-3.5" />}
          titulo="Yardas consumidas"
          valor={yd(resumen.yardas)}
          pie="total real de Corte"
        />
        <Tarjeta
          icono={<Layers className="size-3.5" />}
          titulo="Piezas cortadas"
          valor={resumen.piezas.toLocaleString("es-CO")}
        />
        <Tarjeta
          icono={<Ruler className="size-3.5" />}
          titulo="Rendimiento"
          valor={
            resumen.rendimientoGlobal !== null
              ? `${resumen.rendimientoGlobal.toFixed(3)}`
              : "—"
          }
          pie="yardas por pieza"
        />
        <Tarjeta
          icono={<Users className="size-3.5" />}
          titulo="Clientes / telas"
          valor={`${resumen.clientes} / ${resumen.telas}`}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Pedido, cliente, estilo, tela o marker…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tela</Label>
            <Select value={tela} onValueChange={setTela}>
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {telas.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Semana</Label>
            <Select value={semana} onValueChange={setSemana}>
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {semanas.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Semana {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={exportar} className="h-8">
            <Download className="mr-1.5 size-3.5" />
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={onRecargar} className="h-8">
            <RefreshCw className="mr-1.5 size-3.5" />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {/* Agrupado */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Consumo agrupado</CardTitle>
          <Select
            value={agrupacion}
            onValueChange={(v) => setAgrupacion(v as Agrupacion)}
          >
            <SelectTrigger className="h-7 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGRUPACIONES.map((a) => (
                <SelectItem key={a.valor} value={a.valor}>
                  Por {a.label.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {grupos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin consumo registrado con estos filtros.
            </p>
          ) : (
            <div className="max-h-[38dvh] space-y-2 overflow-auto pr-1">
              {grupos.map((g) => (
                <div key={g.clave} className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                      {g.clave}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {g.ordenes} órd.
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {g.piezas.toLocaleString("es-CO")} pcs
                    </span>
                    <span
                      className="tabular-nums text-slate-500"
                      title="Yardas por pieza"
                    >
                      {g.rendimiento !== null
                        ? `${g.rendimiento.toFixed(3)} yd/pc`
                        : "—"}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-800">
                      {yd(g.yardas)} yd
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(g.yardas / maxGrupo) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle orden por orden */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <Package className="size-4 text-icon-cyan" />
          <span className="font-semibold text-slate-800">
            Detalle por orden
          </span>
          <Badge variant="outline" className="text-[11px]">
            {visibles.length}
          </Badge>
        </div>

        {visibles.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Ninguna orden coincide con los filtros.
          </p>
        ) : (
          <div className="max-h-[60dvh] overflow-auto">
            <Table className="min-w-[68rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estilo</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead>Marker</TableHead>
                  <TableHead>Corte</TableHead>
                  <TableHead className="text-right">Sem.</TableHead>
                  <TableHead className="text-right">Pcs</TableHead>
                  <TableHead className="text-right">Yardas</TableHead>
                  <TableHead className="text-right">Yd/pc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((f) => (
                  <TableRow
                    key={f.pedido}
                    className="hover:bg-slate-50/60"
                    title={f.comentarioCorte ?? undefined}
                  >
                    <TableCell className="font-medium text-slate-800">
                      {f.pedido}
                    </TableCell>
                    <TableCell className="max-w-[13rem] truncate text-slate-600">
                      {f.cliente ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[11rem] truncate text-slate-600">
                      {f.estilo ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">{f.tela}</TableCell>
                    <TableCell>
                      {f.coreNombre ? (
                        <Badge variant="outline" className="text-[10px]">
                          {f.coreNombre}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {fmtFecha(f.fechaCorte)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {f.semana ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {f.piezasCortadas ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-slate-800">
                      {yd(f.reales, 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {f.rendimiento !== null ? f.rendimiento.toFixed(3) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
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
}: {
  icono: React.ReactNode
  titulo: string
  valor: string
  pie?: string
}) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
        {icono}
        {titulo}
      </p>
      <p className="text-2xl font-bold tabular-nums text-slate-800">{valor}</p>
      {pie && <p className="text-[10px] text-slate-400">{pie}</p>}
    </Card>
  )
}
