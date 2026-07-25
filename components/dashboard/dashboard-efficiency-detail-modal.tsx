"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ArrowDownUp,
} from "lucide-react"
import { FlowStepper } from "./dashboard-flow-stepper"
import { fetchAll } from "@/lib/fetch-all"
import type {
  NivelRiesgo,
  StatusArea,
  VistaControlProduccion,
} from "@/lib/types"
import type { AreaKey } from "@/lib/dashboard-context"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const PAGE_SIZE = 25

type EfficiencyAreaKey = Exclude<AreaKey, "empaque">

// Campos por area: la columna de dias y de estado viven en la vista; las
// fechas de recepcion (inicio) y fin del proceso viven en la tabla base
// telas.cabecera. Traer AMBAS fechas de la misma fuente garantiza que
// "Recibido vs Terminado" corresponda al mismo par que produce los dias.
const AREA_FIELDS: Record<
  EfficiencyAreaKey,
  {
    dias: keyof VistaControlProduccion
    status: keyof VistaControlProduccion
    recepCol: string
    finCol: string
  }
> = {
  diseno: {
    dias: "dias_en_diseno",
    status: "status_diseno",
    recepCol: "dfecha_de_ingreso_diseno",
    finCol: "dentrega_diseno",
  },
  corte: {
    dias: "dias_en_corte",
    status: "status_corte",
    recepCol: "cfecha_de_recepcion",
    finCol: "cfecha_de_corte",
  },
  impresion: {
    dias: "dias_en_impresion",
    status: "status_impresion",
    recepCol: "ifecha_de_ingreso_imp",
    finCol: "ientrega_impresion",
  },
  sublimacion: {
    dias: "dias_en_sublimacion",
    status: "status_sublimacion",
    recepCol: "sfecha_de_ingreso_sub",
    finCol: "seta_sublimacion",
  },
  costura: {
    dias: "dias_en_costura",
    status: "status_costura",
    recepCol: "cosfecha_conteo",
    finCol: "coseta_costura",
  },
}

// Todas las columnas de fecha (recepcion + fin) que se leen de telas.cabecera.
const CABECERA_COLS = [
  "dfecha_de_ingreso_diseno",
  "dentrega_diseno",
  "cfecha_de_recepcion",
  "cfecha_de_corte",
  "ifecha_de_ingreso_imp",
  "ientrega_impresion",
  "sfecha_de_ingreso_sub",
  "seta_sublimacion",
  "cosfecha_conteo",
  "coseta_costura",
] as const

// Cache a nivel modulo: se lee telas.cabecera una sola vez por sesion.
let recepCachePromise: Promise<Map<string, Record<string, string | null>>> | null =
  null

async function loadRecepByPedido(): Promise<
  Map<string, Record<string, string | null>>
> {
  if (recepCachePromise) return recepCachePromise
  recepCachePromise = (async () => {
    const { data, error } = await fetchAll<Record<string, string | null>>(
      (from, to) =>
        supabase
          .schema("telas")
          .from("cabecera")
          .select(["pedido", ...CABECERA_COLS].join(", "))
          .range(from, to) as unknown as PromiseLike<{
          data: Record<string, string | null>[] | null
          error: { message: string } | null
        }>
    )
    const map = new Map<string, Record<string, string | null>>()
    if (error || !data) {
      // No cachear un fallo: permitir reintento en la proxima apertura.
      recepCachePromise = null
      return map
    }
    for (const row of data) {
      const pedido = (row.pedido ?? "") as unknown as string
      if (pedido) map.set(pedido, row)
    }
    return map
  })()
  return recepCachePromise
}

function formatDate(d?: string | null): string {
  if (!d) return "-"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function excelDate(value?: string | null): string {
  if (!value) return ""
  const ymd = value.slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function statusBadge(s?: StatusArea | null) {
  switch (s) {
    case "Terminado":
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0">
          Terminado
        </Badge>
      )
    case "Recibido":
      return (
        <Badge className="bg-blue-500 hover:bg-blue-500 text-white border-0">
          Recibido
        </Badge>
      )
    case "Pendiente":
      return (
        <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">
          Pendiente
        </Badge>
      )
    case "N/A":
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          N/A
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          En espera
        </Badge>
      )
  }
}

function riskBadge(n?: NivelRiesgo | null) {
  switch (n) {
    case "Vencido":
      return (
        <Badge className="bg-rose-600 hover:bg-rose-600 text-white border-0">
          Vencido
        </Badge>
      )
    case "Riesgo Crítico":
      return (
        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border border-rose-200">
          Crítico
        </Badge>
      )
    case "Riesgo Medio":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">
          Medio
        </Badge>
      )
    case "A Tiempo":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
          A Tiempo
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          -
        </Badge>
      )
  }
}

// Una orden esta "Cerrada" cuando ya salio de la planta (entregada al cliente).
function isClosed(row: VistaControlProduccion): boolean {
  return (row.s_estado_entrega ?? "").toString() === "Completado"
}

interface DashboardEfficiencyDetailModalProps {
  areaKey: EfficiencyAreaKey
  areaLabel: string
  avg: number
  rows: VistaControlProduccion[]
  open: boolean
  onClose: () => void
}

export function DashboardEfficiencyDetailModal({
  areaKey,
  areaLabel,
  avg,
  rows,
  open,
  onClose,
}: DashboardEfficiencyDetailModalProps) {
  const fields = AREA_FIELDS[areaKey]
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [sortAsc, setSortAsc] = useState(false)
  const [recepByPedido, setRecepByPedido] = useState<Map<
    string,
    Record<string, string | null>
  > | null>(null)
  const [loadingRecep, setLoadingRecep] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingRecep(true)
    loadRecepByPedido().then((map) => {
      if (cancelled) return
      setRecepByPedido(map)
      setLoadingRecep(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const diasOf = (r: VistaControlProduccion): number => Number(r[fields.dias])
  const recepOf = (r: VistaControlProduccion): string | null =>
    recepByPedido?.get(r.pedido)?.[fields.recepCol] ?? null
  const finOf = (r: VistaControlProduccion): string | null =>
    recepByPedido?.get(r.pedido)?.[fields.finCol] ?? null

  // Dias calculados a partir de las dos fechas de cabecera (para que el
  // gerente confirme que "Terminado - Recibido" coincide con la columna Dias).
  const diasCalcOf = (r: VistaControlProduccion): number | null => {
    const ini = recepOf(r)
    const fin = finOf(r)
    if (!ini || !fin) return null
    const a = new Date(ini)
    const b = new Date(fin)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
    const MS = 1000 * 60 * 60 * 24
    const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
    const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
    return Math.round((db - da) / MS)
  }

  // Conjunto contribuyente: exactamente las filas que alimentan el promedio
  // (mismo criterio que avgDaysByAreaAll en dashboard-context).
  const contrib = useMemo(
    () =>
      rows.filter((r) => {
        const v = diasOf(r)
        return Number.isFinite(v) && v > 0
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, areaKey]
  )

  const sumDias = useMemo(
    () => contrib.reduce((s, r) => s + diasOf(r), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contrib, areaKey]
  )
  const promedio =
    contrib.length > 0 ? +(sumDias / contrib.length).toFixed(1) : 0
  const excluidas = rows.length - contrib.length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? contrib.filter(
          (r) =>
            (r.pedido || "").toLowerCase().includes(q) ||
            (r.cliente || "").toLowerCase().includes(q)
        )
      : contrib
    return [...base].sort((a, b) =>
      sortAsc ? diasOf(a) - diasOf(b) : diasOf(b) - diasOf(a)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrib, query, sortAsc, areaKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  )

  function handleExport() {
    const headers = [
      "Pedido",
      "Cliente",
      "PCS",
      "Recibido",
      "Terminado",
      "Días en " + areaLabel,
      "Estado etapa",
      "Entrega",
      "Riesgo",
    ]
    const data: (string | number)[][] = filtered.map((r) => [
      r.pedido ?? "",
      r.cliente ?? "",
      Number(r.pcs) || 0,
      excelDate(recepOf(r)),
      excelDate(finOf(r)),
      diasOf(r),
      (r[fields.status] as string | null) ?? "",
      isClosed(r) ? "Cerrada" : "Abierta",
      r.nivel_riesgo ?? "",
    ])
    // Fila resumen: la prueba del promedio.
    data.push([])
    data.push([
      "PROMEDIO",
      "",
      "",
      "",
      "",
      `${sumDias} ÷ ${contrib.length} = ${promedio}`,
      "",
      "",
      "",
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    ws["!cols"] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, areaLabel.slice(0, 28))
    const stamp = new Date().toISOString().split("T")[0]
    XLSX.writeFile(wb, `eficiencia-${areaKey}-${stamp}.xlsx`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none sm:max-w-none rounded-none border-0 overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Eficiencia de {areaLabel} — auditoría de tiempos</DialogTitle>
          <DialogDescription>
            Promedio{" "}
            <span className="font-semibold text-foreground">{avg} d</span> ·{" "}
            {contrib.length} órden{contrib.length !== 1 ? "es" : ""} incluida
            {contrib.length !== 1 ? "s" : ""}. Cada línea aporta a este promedio.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Buscar pedido o cliente..."
              className="pl-9 h-9 bg-white"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 gap-1.5"
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Exportar Excel
          </Button>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow className="hover:bg-muted">
                <TableHead className="text-xs font-semibold">Pedido</TableHead>
                <TableHead className="text-xs font-semibold">Cliente</TableHead>
                <TableHead className="text-xs font-semibold text-right">PCS</TableHead>
                <TableHead className="text-xs font-semibold">Recibido</TableHead>
                <TableHead className="text-xs font-semibold">Terminado</TableHead>
                <TableHead className="text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSortAsc((s) => !s)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    title="Ordenar por días"
                  >
                    Días
                    <ArrowDownUp className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold">Estado etapa</TableHead>
                <TableHead className="text-xs font-semibold">Entrega</TableHead>
                <TableHead className="text-xs font-semibold">Riesgo</TableHead>
                <TableHead className="text-xs font-semibold">Flujo en Planta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRecep ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    {contrib.length === 0
                      ? "No hay órdenes con días registrados en esta etapa."
                      : "No se encontraron órdenes con la búsqueda aplicada."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow key={r.pedido} className="text-xs">
                    <TableCell className="font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {r.pedido}
                        {r.es_urgente && (
                          <Badge
                            variant="outline"
                            className="border-rose-300 bg-rose-100 text-rose-700 h-4 px-1 text-[9px]"
                          >
                            U
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.cliente}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat("es-CO").format(Number(r.pcs) || 0)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(recepOf(r))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(finOf(r))}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const dv = diasOf(r)
                        const dc = diasCalcOf(r)
                        const mismatch = dc !== null && dc !== dv
                        return (
                          <span
                            className={
                              mismatch
                                ? "inline-flex items-center gap-1"
                                : undefined
                            }
                            title={
                              mismatch
                                ? `La vista reporta ${dv} d, pero Terminado − Recibido = ${dc} d`
                                : undefined
                            }
                          >
                            <span className="font-bold tabular-nums text-foreground">
                              {dv}
                            </span>
                            <span className="ml-0.5 text-[10px] text-muted-foreground">
                              d
                            </span>
                            {mismatch && (
                              <span className="text-[10px] font-medium text-amber-600">
                                (≠ {dc})
                              </span>
                            )}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {statusBadge(r[fields.status] as StatusArea | null)}
                    </TableCell>
                    <TableCell>
                      {isClosed(r) ? (
                        <Badge
                          variant="outline"
                          className="border-slate-300 bg-slate-100 text-slate-600"
                        >
                          Cerrada
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                          Abierta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{riskBadge(r.nivel_riesgo)}</TableCell>
                    <TableCell>
                      <FlowStepper row={r} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pie: la prueba del promedio + paginacion */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-t pt-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Σ días</span>
              <span className="font-semibold text-foreground tabular-nums">
                {sumDias}
              </span>
              <span className="text-muted-foreground">÷ órdenes</span>
              <span className="font-semibold text-foreground tabular-nums">
                {contrib.length}
              </span>
              <span className="text-muted-foreground">=</span>
              <span className="rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-700 tabular-nums">
                {promedio} d
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se excluyen {excluidas} orden{excluidas !== 1 ? "es" : ""} sin días
              registrados en esta etapa (aún no la terminan).
            </p>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-xs px-2">
                Pág. {current + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-white"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={current >= totalPages - 1}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
