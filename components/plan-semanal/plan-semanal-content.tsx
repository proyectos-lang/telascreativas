"use client"

/**
 * Plan Semanal de Produccion (matriz desplegable).
 *
 * Vista gerencial de carga de trabajo basada en `telas.vista_plan_semanal`.
 * El usuario elige un Anio y una Semana ISO; el modulo trae las ordenes
 * cuya entrega cae en esa semana, las agrupa por dia de entrega
 * (`fecha_de_entrega`) en un acordeon y muestra, al expandir, el detalle
 * de cada pedido con las fechas reales de fin por area.
 *
 * El filtro de Estatus se aplica en cliente (reactivo) para no re-consultar
 * a la BD en cada cambio.
 */

import { useEffect, useMemo, useState } from "react"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  CalendarRange,
  Layers,
  PackageSearch,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface PlanRow {
  pedido: string | null
  cliente: string | null
  vendedora: string | null
  estilo_de_la_prenda: string | null
  disenador: string | null
  maquina_costura: string | null
  estatus_actual: string | null
  fecha_de_entrega: string | null
  ano_entrega: number | null
  semana_ano: number | null
  pcs: number | string | null
  fin_diseno: string | null
  fin_impresion: string | null
  fin_sublimacion: string | null
  fin_corte: string | null
  fin_costura: string | null
}

interface DayGroup {
  fecha: string
  label: string
  rows: PlanRow[]
  totalPcs: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Numero de semana ISO 8601 de una fecha (1-53). */
function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
}

/** Convierte un valor de pcs (numero o texto) a numero seguro. */
function toPcs(value: PlanRow["pcs"]): number {
  if (typeof value === "number") return value
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** "YYYY-MM-DD" -> "Lunes, 11 de Mayo" (capitalizado, en UTC). */
function formatDayLabel(value: string | null): string {
  if (!value) return "Sin fecha de entrega"
  const ymd = value.slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(Date.UTC(y, m - 1, d))
  const raw = date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
  // Capitaliza la primera letra ("lunes, 11 de mayo" -> "Lunes, 11 de mayo").
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" para exportacion; "" si es nula. */
function excelDate(value: string | null): string {
  if (!value) return ""
  const ymd = value.slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const dd = String(d).padStart(2, "0")
  const mm = String(m).padStart(2, "0")
  return `${dd}/${mm}/${y}`
}

/** Fecha por area: muestra fecha corta o "Pendiente" atenuado si es nula. */
function AreaDate({ value }: { value: string | null }) {
  if (!value) {
  return (
  <span className="text-[11px] text-muted-foreground/60">Pend.</span>
  )
  }
  const ymd = value.slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) {
  return (
  <span className="text-[11px] text-muted-foreground/60">Pend.</span>
  )
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  const label = date.toLocaleDateString("es-CO", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
  })
  return (
  <span className="whitespace-nowrap text-[11px] font-medium text-slate-700">
  {label}
  </span>
  )
  }

const ESTATUS_OPCIONES = [
  "POR PROGRAMAR",
  "DISEÑO",
  "IMPRESION",
  "CORTE",
  "SUBLIMACION",
  "COSTURA",
  "EMPAQUE",
  "ENTREGADO",
  "CORTE/SUBLIMACION",
] as const

/** Clases de color de Badge por estatus (categorico, por area). */
function estatusBadgeClasses(estatus: string | null): string {
  const key = (estatus ?? "").toString().trim().toUpperCase()
  switch (key) {
    case "POR PROGRAMAR":
      return "bg-rose-100 text-rose-700 border-rose-300"
    case "DISEÑO":
    case "DISENO":
      return "bg-slate-100 text-slate-700 border-slate-300"
    case "IMPRESION":
    case "IMPRESIÓN":
      return "bg-blue-100 text-blue-700 border-blue-300"
    case "CORTE":
      return "bg-amber-100 text-amber-800 border-amber-300"
    case "SUBLIMACION":
    case "SUBLIMACIÓN":
      return "bg-orange-100 text-orange-700 border-orange-300"
    case "CORTE/SUBLIMACION":
    case "CORTE/SUBLIMACIÓN":
      return "bg-indigo-100 text-indigo-700 border-indigo-300"
    case "COSTURA":
      return "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300"
    case "EMPAQUE":
      return "bg-teal-100 text-teal-700 border-teal-300"
    case "ENTREGADO":
      return "bg-emerald-100 text-emerald-700 border-emerald-300"
    default:
      return "bg-slate-100 text-slate-600 border-slate-300"
  }
}

const numberFmt = new Intl.NumberFormat("es-CO")

// Anios disponibles en el filtro (ventana razonable alrededor del actual).
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PlanSemanalContent() {
  const [year, setYear] = useState<number>(CURRENT_YEAR)
  const [week, setWeek] = useState<number>(() => getISOWeek(new Date()))
  // Seleccion multiple de estatus. Vacio = "Todos los estatus".
  const [estatusSel, setEstatusSel] = useState<string[]>([])
  // Oculta los pedidos ya entregados (estatus ENTREGADO). Activo por defecto
  // para enfocar la vista en el trabajo pendiente.
  const [ocultarEntregados, setOcultarEntregados] = useState(true)

  // Alterna un estatus dentro de la seleccion multiple.
  const toggleEstatus = (value: string) => {
    setEstatusSel((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value]
    )
  }

  const [rows, setRows] = useState<PlanRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch reactivo por anio + semana. El estatus se filtra en cliente.
  useEffect(() => {
    let cancelled = false
    async function fetchPlan() {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: dbError } = await supabase
          .schema("telas")
          .from("vista_plan_semanal")
          .select("*")
          .eq("ano_entrega", year)
          .eq("semana_ano", week)

        if (cancelled) return
        if (dbError) {
          console.log("[v0] PlanSemanal - error supabase:", dbError)
          setError(dbError.message)
          setRows([])
        } else {
          setRows((data as PlanRow[]) || [])
        }
      } catch (err) {
        if (cancelled) return
        console.log("[v0] PlanSemanal - unexpected error:", err)
        setError(err instanceof Error ? err.message : "Error inesperado")
        setRows([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void fetchPlan()
    return () => {
      cancelled = true
    }
  }, [year, week])

  // Filtro reactivo por estatus (seleccion multiple) + ocultar entregados.
  const filteredRows = useMemo(() => {
    // Normaliza la seleccion a mayusculas para comparar.
    const seleccion = estatusSel.map((e) => e.toUpperCase())
    return rows.filter((r) => {
      const current = (r.estatus_actual ?? "").toString().trim().toUpperCase()
      // Ocultar entregados: cubre los estatus "ENTREGADO" y "ENTREGAS"
      // (a menos que el usuario los incluya explicitamente en la seleccion).
      const esEntregado = current === "ENTREGADO" || current === "ENTREGAS"
      if (ocultarEntregados && esEntregado && !seleccion.includes(current)) {
        return false
      }
      // Seleccion vacia = todos los estatus.
      if (seleccion.length > 0 && !seleccion.includes(current)) {
        return false
      }
      return true
    })
  }, [rows, estatusSel, ocultarEntregados])

  // Agrupacion por fecha_de_entrega ascendente.
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, PlanRow[]>()
    for (const r of filteredRows) {
      const key = (r.fecha_de_entrega ?? "").slice(0, 10) || "sin-fecha"
      const arr = map.get(key)
      if (arr) arr.push(r)
      else map.set(key, [r])
    }
    const result: DayGroup[] = []
    for (const [fecha, groupRows] of map.entries()) {
      const totalPcs = groupRows.reduce((acc, r) => acc + toPcs(r.pcs), 0)
      result.push({
        fecha,
        label: formatDayLabel(fecha === "sin-fecha" ? null : fecha),
        rows: groupRows.sort((a, b) =>
          String(a.pedido ?? "").localeCompare(String(b.pedido ?? ""))
        ),
        totalPcs,
      })
    }
    // Ascendente por fecha; "sin-fecha" al final.
    result.sort((a, b) => {
      if (a.fecha === "sin-fecha") return 1
      if (b.fecha === "sin-fecha") return -1
      return a.fecha.localeCompare(b.fecha)
    })
    return result
  }, [filteredRows])

  const totalSemana = useMemo(
    () => filteredRows.reduce((acc, r) => acc + toPcs(r.pcs), 0),
    [filteredRows]
  )

  const totalPedidos = filteredRows.length

  // Exporta a XLSX la informacion actualmente visible (respeta filtros de
  // semana, estatus y "ocultar entregados"). Recorre los grupos por dia para
  // conservar el mismo orden de la tabla en pantalla.
  function handleExport() {
    const headers = [
      "Dia de entrega",
      "Fecha de entrega",
      "# Orden",
      "Cliente",
      "Vendedora",
      "Estilo",
      "Disenador",
      "Maquina Costura",
      "Estatus",
      "Fin Diseno",
      "Fin Impresion",
      "Fin Sublimacion",
      "Fin Corte",
      "Fin Costura",
      "Pcs",
    ]

    const data: (string | number)[][] = []
    for (const group of groups) {
      for (const r of group.rows) {
        data.push([
          group.label,
          excelDate(r.fecha_de_entrega),
          r.pedido ?? "",
          r.cliente ?? "",
          r.vendedora ?? "",
          r.estilo_de_la_prenda ?? "",
          r.disenador ?? "",
          r.maquina_costura ?? "",
          r.estatus_actual ?? "",
          excelDate(r.fin_diseno),
          excelDate(r.fin_impresion),
          excelDate(r.fin_sublimacion),
          excelDate(r.fin_corte),
          excelDate(r.fin_costura),
          toPcs(r.pcs),
        ])
      }
    }
    // Fila de totales al final.
    data.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalSemana,
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    ws["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 26 },
      { wch: 16 },
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 13 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Semana ${week}`)
    XLSX.writeFile(wb, `plan-semanal-${year}-S${week}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <CalendarRange className="size-5 text-icon-cyan" />
          Plan Semanal de Produccion
        </h1>
        <p className="text-sm text-muted-foreground">
          Carga de trabajo por dia de entrega. Selecciona el año y la semana
          para revisar cuantas prendas se deben fabricar y en que area esta
          retenido el trabajo.
        </p>
      </div>

      {/* Barra de filtros */}
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Año</label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-full md:w-32">
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
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Semana</label>
          <Select
            value={String(week)}
            onValueChange={(v) => setWeek(Number(v))}
          >
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Estatus</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-normal md:w-52"
              >
                <span className="truncate">
                  {estatusSel.length === 0
                    ? "Todos los estatus"
                    : estatusSel.length === 1
                      ? estatusSel[0]
                      : `${estatusSel.length} seleccionados`}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <button
                type="button"
                onClick={() => setEstatusSel([])}
                className="mb-1 w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Todos los estatus
              </button>
              <div className="max-h-64 overflow-y-auto">
                {ESTATUS_OPCIONES.map((e) => (
                  <label
                    key={e}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100"
                  >
                    <Checkbox
                      checked={estatusSel.includes(e)}
                      onCheckedChange={() => toggleEstatus(e)}
                    />
                    <span className="text-slate-700">{e}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Mostrar / ocultar pedidos ya entregados */}
        <label className="flex cursor-pointer items-center gap-2 pb-2 md:pb-2.5">
          <Checkbox
            checked={ocultarEntregados}
            onCheckedChange={(v) => setOcultarEntregados(v === true)}
          />
          <span className="text-xs font-medium text-slate-600">
            Ocultar entregados
          </span>
        </label>

        {/* Resumen rapido + exportar a la derecha */}
        <div className="flex flex-1 items-end justify-end gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-lg font-semibold text-slate-800">
              {numberFmt.format(totalPedidos)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Prendas</p>
            <p className="text-lg font-semibold text-icon-cyan">
              {numberFmt.format(totalSemana)}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || totalPedidos === 0}
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <FileSpreadsheet className="size-4" />
            Exportar a Excel
          </Button>
        </div>
      </Card>

      {/* Cuerpo */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="size-10 text-rose-400" />
          <p className="text-sm font-medium text-slate-600">
            No se pudo cargar el plan semanal.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              // fuerza refetch reasignando el mismo estado
              setWeek((w) => w)
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="size-3.5" />
            Reintentar
          </button>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <PackageSearch className="size-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            No hay pedidos para la semana {week} de {year}
            {estatusSel.length > 0
              ? ` con estatus ${estatusSel.join(", ")}`
              : ""}
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Prueba con otra semana o cambia el filtro de estatus.
          </p>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={groups.map((g) => g.fecha)}
          className="flex flex-col gap-2"
        >
          {groups.map((group) => (
            <AccordionItem
              key={group.fecha}
              value={group.fecha}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50/80">
                <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                      {group.label}
                    </span>
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                      {group.rows.length}{" "}
                      {group.rows.length === 1 ? "pedido" : "pedidos"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1">
                    <Layers className="size-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">Total dia:</span>
                    <span className="text-sm font-bold text-slate-800">
                      {numberFmt.format(group.totalPcs)}
                    </span>
                    <span className="text-xs text-slate-500">pzs</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="border-t border-slate-100">
                  <Table className="w-full table-fixed text-xs">
                    <colgroup>
                      <col className="w-[7%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[5%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-slate-50/60">
                        <TableHead className="h-8 px-2 text-[11px]">
                          # Orden
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Cliente
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Vendedora
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Estilo
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Disenador
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Maq. Costura
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px]">
                          Estatus
                        </TableHead>
                        <TableHead className="h-8 px-1 text-center text-[11px]">
                          Diseno
                        </TableHead>
                        <TableHead className="h-8 px-1 text-center text-[11px]">
                          Impres.
                        </TableHead>
                        <TableHead className="h-8 px-1 text-center text-[11px]">
                          Sublim.
                        </TableHead>
                        <TableHead className="h-8 px-1 text-center text-[11px]">
                          Corte
                        </TableHead>
                        <TableHead className="h-8 px-1 text-center text-[11px]">
                          Costura
                        </TableHead>
                        <TableHead className="h-8 px-1 text-right text-[11px]">
                          Pcs
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((r, idx) => (
                        <TableRow
                          key={`${r.pedido ?? "s"}-${idx}`}
                          className="hover:bg-slate-50/60"
                        >
                          <TableCell className="truncate px-2 py-1.5 font-medium text-slate-800">
                            {r.pedido ?? "-"}
                          </TableCell>
                          <TableCell
                            className="truncate px-2 py-1.5 text-slate-600"
                            title={r.cliente ?? undefined}
                          >
                            {r.cliente ?? "-"}
                          </TableCell>
                          <TableCell
                            className="truncate px-2 py-1.5 text-slate-600"
                            title={r.vendedora ?? undefined}
                          >
                            {r.vendedora ?? "-"}
                          </TableCell>
                          <TableCell
                            className="truncate px-2 py-1.5 text-slate-600"
                            title={r.estilo_de_la_prenda ?? undefined}
                          >
                            {r.estilo_de_la_prenda ?? "-"}
                          </TableCell>
                          <TableCell
                            className="truncate px-2 py-1.5 text-slate-600"
                            title={r.disenador ?? undefined}
                          >
                            {r.disenador ?? "-"}
                          </TableCell>
                          <TableCell
                            className="truncate px-2 py-1.5 text-slate-600"
                            title={r.maquina_costura ?? undefined}
                          >
                            {r.maquina_costura ?? "-"}
                          </TableCell>
                          <TableCell className="px-2 py-1.5">
                            <Badge
                              variant="outline"
                              className={`truncate text-[10px] ${estatusBadgeClasses(r.estatus_actual)}`}
                            >
                              {r.estatus_actual ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center">
                            <AreaDate value={r.fin_diseno} />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center">
                            <AreaDate value={r.fin_impresion} />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center">
                            <AreaDate value={r.fin_sublimacion} />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center">
                            <AreaDate value={r.fin_corte} />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-center">
                            <AreaDate value={r.fin_costura} />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-right font-semibold text-slate-800">
                            {numberFmt.format(toPcs(r.pcs))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Pie: carga total de la semana */}
      {!isLoading && !error && groups.length > 0 && (
        <Card className="flex items-center justify-between gap-4 border-icon-cyan/30 bg-icon-cyan/5 p-4">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-icon-cyan" />
            <span className="text-sm font-medium text-slate-700">
              Carga Total de la Semana {week} / {year}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {numberFmt.format(totalSemana)}
            </span>
            <span className="text-sm font-medium text-slate-500">prendas</span>
          </div>
        </Card>
      )}
    </div>
  )
}
