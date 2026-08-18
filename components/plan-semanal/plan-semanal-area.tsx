"use client"

/**
 * Plan Semanal POR PROCESO.
 *
 * A diferencia del plan global (que agrupa por la fecha de entrega al cliente),
 * cada área ve lo que DEBE terminar en la semana según SU PROPIA fecha
 * objetivo. Es el plan de trabajo real del área: "esta semana Corte tiene que
 * cerrar estas órdenes".
 *
 * Fuente: `telas.cabecera` (la vista vista_plan_semanal no trae las fechas
 * objetivo por área). Se reutiliza el patrón de select paginado del módulo de
 * Capacidad y `pasaPorArea` para no listar áreas que la orden no atraviesa.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  PackageSearch,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchAll } from "@/lib/fetch-all"
import { pasaPorArea } from "@/lib/capacidad/motor"
import type { OrdenCapacidad } from "@/lib/capacidad/motor"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Área del plan: su fecha objetivo, su fecha de fin y su marca de recepción. */
export interface AreaPlan {
  key: string
  label: string
  /** Clave del área en el motor de flujos (lib/capacidad/motor.ts). */
  motor: string
  objetivo: keyof PlanAreaRow
  fin: keyof PlanAreaRow
  recepcion: keyof PlanAreaRow
}

export const AREAS_PLAN: AreaPlan[] = [
  {
    key: "diseno",
    label: "Diseño",
    motor: "Diseno",
    objetivo: "dfecha_objetivo_d",
    fin: "dentrega_diseno",
    recepcion: "dfecha_de_ingreso_diseno",
  },
  {
    key: "impresion",
    label: "Impresión",
    motor: "Impresion",
    objetivo: "ifecha_objetivo_i",
    fin: "ientrega_impresion",
    recepcion: "ifecha_de_ingreso_imp",
  },
  {
    key: "corte",
    label: "Corte",
    motor: "Corte",
    objetivo: "cfecha_objetivo_c",
    fin: "cfecha_de_corte",
    recepcion: "cfecha_de_recepcion",
  },
  {
    key: "sublimacion",
    label: "Sublimación",
    motor: "Sublimacion",
    objetivo: "sfecha_objetivo_s",
    fin: "seta_sublimacion",
    recepcion: "sfecha_de_ingreso_sub",
  },
  {
    key: "costura",
    label: "Costura",
    motor: "Costura",
    objetivo: "cosfecha_objetivo_cs",
    fin: "coseta_costura",
    recepcion: "cosfecha_conteo",
  },
]

export interface PlanAreaRow {
  pedido: string
  cliente: string | null
  vendedora: string | null
  estilo_de_la_prenda: string | null
  maquina_costura: string | null
  pcs: number | string | null
  es_urgente: boolean | null
  fecha_de_entrega: string | null
  estado_aprobado_rechazado: string | null
  entregado_cliente_si_no: boolean | null
  tipo_flujo_especial: string | null
  solo_corte_costura: boolean | null
  omite_corte_costura: boolean | null
  costura_si_no: boolean | string | null
  accesorios_inventario: string | null
  dfecha_objetivo_d: string | null
  cfecha_objetivo_c: string | null
  ifecha_objetivo_i: string | null
  sfecha_objetivo_s: string | null
  cosfecha_objetivo_cs: string | null
  dentrega_diseno: string | null
  cfecha_de_corte: string | null
  ientrega_impresion: string | null
  seta_sublimacion: string | null
  coseta_costura: string | null
  dfecha_de_ingreso_diseno: string | null
  cfecha_de_recepcion: string | null
  ifecha_de_ingreso_imp: string | null
  sfecha_de_ingreso_sub: string | null
  cosfecha_conteo: string | null
}

const CAMPOS = [
  "pedido", "cliente", "vendedora", "estilo_de_la_prenda", "maquina_costura",
  "pcs", "es_urgente", "fecha_de_entrega", "estado_aprobado_rechazado",
  "entregado_cliente_si_no", "tipo_flujo_especial", "solo_corte_costura",
  "omite_corte_costura", "costura_si_no", "accesorios_inventario",
  "dfecha_objetivo_d", "cfecha_objetivo_c", "ifecha_objetivo_i",
  "sfecha_objetivo_s", "cosfecha_objetivo_cs",
  "dentrega_diseno", "cfecha_de_corte", "ientrega_impresion",
  "seta_sublimacion", "coseta_costura",
  "dfecha_de_ingreso_diseno", "cfecha_de_recepcion", "ifecha_de_ingreso_imp",
  "sfecha_de_ingreso_sub", "cosfecha_conteo",
].join(", ")

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

/** Semana ISO de una fecha. */
function getISOWeek(date: Date): number {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3)
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000))
}

function anoYSemanaDe(ymd: string): { ano: number; semana: number } | null {
  const m = ymd.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const t = new Date(d.getTime())
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  return { ano: t.getUTCFullYear(), semana: getISOWeek(d) }
}

function toPcs(v: number | string | null): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatDayLabel(ymd: string): string {
  if (ymd === "sin-fecha") return "Sin fecha objetivo"
  const [y, m, d] = ymd.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const s = date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const numberFmt = new Intl.NumberFormat("es-CO")

/** Estado del área para una orden: Pendiente / Recibido / Terminado. */
function estadoArea(r: PlanAreaRow, area: AreaPlan): "Terminado" | "Recibido" | "Pendiente" {
  if (r[area.fin]) return "Terminado"
  if (r[area.recepcion]) return "Recibido"
  return "Pendiente"
}

const ESTADO_CLASSES: Record<string, string> = {
  Terminado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Recibido: "bg-amber-100 text-amber-700 border-amber-200",
  Pendiente: "bg-slate-100 text-slate-600 border-slate-200",
}

export function PlanSemanalArea({ area }: { area: AreaPlan }) {
  const [rows, setRows] = useState<PlanAreaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [week, setWeek] = useState(() => getISOWeek(new Date()))
  const [ocultarTerminados, setOcultarTerminados] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchAll<PlanAreaRow>((from, to) =>
      supabase
        .schema("telas")
        .from("cabecera")
        .select(CAMPOS)
        .eq("estado_aprobado_rechazado", "Aprobado")
        .range(from, to) as never
    )
    if (err) {
      setError(err.message)
      setRows([])
    } else {
      setRows(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Órdenes de esta área cuya fecha objetivo cae en la semana elegida. */
  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (r.entregado_cliente_si_no === true) return false
      // Solo áreas por las que realmente pasa la orden.
      if (!pasaPorArea(area.motor, r as unknown as OrdenCapacidad)) return false
      const obj = r[area.objetivo] as string | null
      if (!obj) return false
      const p = anoYSemanaDe(String(obj))
      if (!p || p.ano !== year || p.semana !== week) return false
      if (ocultarTerminados && estadoArea(r, area) === "Terminado") return false
      return true
    })
  }, [rows, area, year, week, ocultarTerminados])

  /** Agrupadas por día de la fecha objetivo del área. */
  const grupos = useMemo(() => {
    const map = new Map<string, PlanAreaRow[]>()
    for (const r of filtradas) {
      const key = String(r[area.objetivo] ?? "").slice(0, 10) || "sin-fecha"
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([dia, items]) => ({
        dia,
        items,
        pcs: items.reduce((a, r) => a + toPcs(r.pcs), 0),
      }))
      .sort((a, b) =>
        a.dia === "sin-fecha" ? 1 : b.dia === "sin-fecha" ? -1 : a.dia.localeCompare(b.dia)
      )
  }, [filtradas, area])

  const totalPcs = filtradas.reduce((a, r) => a + toPcs(r.pcs), 0)

  const exportar = () => {
    const aoa: (string | number)[][] = [
      ["Fecha objetivo", "Pedido", "Cliente", "Vendedora", "Estilo", "Estado", "Fin real", "Entrega cliente", "Pcs"],
    ]
    for (const g of grupos) {
      for (const r of g.items) {
        aoa.push([
          g.dia === "sin-fecha" ? "Sin fecha" : g.dia,
          r.pedido,
          r.cliente ?? "",
          r.vendedora ?? "",
          r.estilo_de_la_prenda ?? "",
          estadoArea(r, area),
          String(r[area.fin] ?? "").slice(0, 10),
          String(r.fecha_de_entrega ?? "").slice(0, 10),
          toPcs(r.pcs),
        ])
      }
    }
    aoa.push(["", "", "", "", "", "", "", "TOTAL", totalPcs])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, area.label.slice(0, 30))
    XLSX.writeFile(wb, `plan-${area.key}-${year}-S${week}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-5 text-icon-cyan" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Plan de {area.label}
              </p>
              <p className="text-[11px] text-slate-500">
                Órdenes cuya fecha objetivo de {area.label} cae en esta semana
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(week)} onValueChange={(v) => setWeek(Number(v))}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Semana {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex h-8 items-center gap-1.5 text-xs text-slate-600">
              <Checkbox
                checked={ocultarTerminados}
                onCheckedChange={(v) => setOcultarTerminados(v === true)}
              />
              Ocultar terminados
            </label>
            <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 size-4", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportar}
              disabled={filtradas.length === 0}
            >
              <FileSpreadsheet className="mr-1.5 size-4" />
              Excel
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
          <PackageSearch className="size-8" />
          <p className="text-sm">
            {area.label} no tiene órdenes con fecha objetivo en la semana {week} de {year}.
          </p>
        </div>
      ) : (
        <>
          <Accordion type="multiple" defaultValue={grupos.map((g) => g.dia)} className="space-y-2">
            {grupos.map((g) => (
              <AccordionItem
                key={g.dia}
                value={g.dia}
                className="rounded-lg border bg-white px-3"
              >
                <AccordionTrigger className="py-2.5 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {formatDayLabel(g.dia)}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge variant="outline">{g.items.length} pedidos</Badge>
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                        {numberFmt.format(g.pcs)} pcs
                      </Badge>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedora</TableHead>
                          <TableHead>Estilo</TableHead>
                          <TableHead className="whitespace-nowrap">Estado</TableHead>
                          <TableHead className="whitespace-nowrap">Fin real</TableHead>
                          <TableHead className="whitespace-nowrap">Entrega cliente</TableHead>
                          <TableHead className="text-right">Pcs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.items.map((r) => {
                          const est = estadoArea(r, area)
                          return (
                            <TableRow key={r.pedido}>
                              <TableCell className="whitespace-nowrap font-medium">
                                {r.pedido}
                                {r.es_urgente && (
                                  <Badge className="ml-1 bg-rose-500 px-1 py-0 text-[9px] text-white">
                                    urgente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate" title={r.cliente ?? ""}>
                                {r.cliente ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate">
                                {r.vendedora ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate">
                                {r.estilo_de_la_prenda ?? "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-[10px]", ESTADO_CLASSES[est])}>
                                  {est === "Terminado" ? (
                                    <CheckCircle2 className="mr-1 size-3" />
                                  ) : est === "Recibido" ? (
                                    <Clock className="mr-1 size-3" />
                                  ) : null}
                                  {est}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-slate-500">
                                {String(r[area.fin] ?? "").slice(0, 10) || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-slate-500">
                                {String(r.fecha_de_entrega ?? "").slice(0, 10) || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {numberFmt.format(toPcs(r.pcs))}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="text-xs text-slate-500">
            {filtradas.length} pedido{filtradas.length !== 1 ? "s" : ""} ·{" "}
            <strong>{numberFmt.format(totalPcs)} prendas</strong> con fecha objetivo de{" "}
            {area.label} en la semana {week} de {year}.
          </p>
        </>
      )}
    </div>
  )
}
