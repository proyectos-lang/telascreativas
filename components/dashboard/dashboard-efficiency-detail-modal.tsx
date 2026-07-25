"use client"

import { useMemo, useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Download, Search, ArrowDownUp } from "lucide-react"
import {
  DIAS_FIELD,
  FECHA_FIELDS,
  tieneDias,
  type AreaLT,
  type LeadTimeUnificadoRow,
} from "@/lib/lead-time-unificado"

const PAGE_SIZE = 25

type Universo = "enProceso" | "general"

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

/** Estado de la etapa derivado de las fechas de recepción/fin de la vista. */
function estadoEtapa(recep: string | null, fin: string | null): "Terminado" | "Recibido" | "Pendiente" {
  if (fin) return "Terminado"
  if (recep) return "Recibido"
  return "Pendiente"
}

function estadoBadge(estado: "Terminado" | "Recibido" | "Pendiente") {
  if (estado === "Terminado")
    return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0">Terminado</Badge>
  if (estado === "Recibido")
    return <Badge className="bg-blue-500 hover:bg-blue-500 text-white border-0">Recibido</Badge>
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Pendiente
    </Badge>
  )
}

interface Props {
  areaKey: AreaLT
  areaLabel: string
  universo: Universo
  avg: number
  rows: LeadTimeUnificadoRow[]
  open: boolean
  onClose: () => void
}

export function DashboardEfficiencyDetailModal({
  areaKey,
  areaLabel,
  universo,
  avg,
  rows,
  open,
  onClose,
}: Props) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [sortAsc, setSortAsc] = useState(false)

  const fechas = FECHA_FIELDS[areaKey]
  const diasField = DIAS_FIELD[areaKey]

  const diasOf = (r: LeadTimeUnificadoRow): number => Number(r[diasField])
  const recepOf = (r: LeadTimeUnificadoRow): string | null =>
    (r[fechas.recep] as string | null) ?? null
  const finOf = (r: LeadTimeUnificadoRow): string | null =>
    (r[fechas.fin] as string | null) ?? null

  // Universo seleccionado desde la barra: vigentes o todos.
  const universoRows = useMemo(
    () => (universo === "enProceso" ? rows.filter((r) => r.en_proceso === true) : rows),
    [rows, universo]
  )

  // Conjunto contribuyente: las filas con día válido en esta etapa.
  const contrib = useMemo(
    () => universoRows.filter((r) => tieneDias(r, areaKey)),
    [universoRows, areaKey]
  )

  const sumDias = useMemo(() => contrib.reduce((s, r) => s + diasOf(r), 0), [contrib, diasField])
  const promedio = contrib.length > 0 ? +(sumDias / contrib.length).toFixed(1) : 0
  const excluidas = universoRows.length - contrib.length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? contrib.filter(
          (r) =>
            (r.pedido || "").toLowerCase().includes(q) ||
            (r.cliente || "").toLowerCase().includes(q)
        )
      : contrib
    return [...base].sort((a, b) => (sortAsc ? diasOf(a) - diasOf(b) : diasOf(b) - diasOf(a)))
  }, [contrib, query, sortAsc, diasField])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const universoLabel = universo === "enProceso" ? "En proceso (vigentes)" : "General (con cerrados)"

  function handleExport() {
    const headers = [
      "Pedido",
      "Cliente",
      "PCS",
      "Recibido",
      "Terminado",
      `Días en ${areaLabel}`,
      "Estado etapa",
      "Entrega",
    ]
    const data: (string | number)[][] = filtered.map((r) => [
      r.pedido ?? "",
      r.cliente ?? "",
      Number(r.pcs) || 0,
      excelDate(recepOf(r)),
      excelDate(finOf(r)),
      diasOf(r),
      estadoEtapa(recepOf(r), finOf(r)),
      r.cerrado ? "Cerrada" : "Abierta",
    ])
    data.push([])
    data.push(["PROMEDIO", "", "", "", "", `${sumDias} ÷ ${contrib.length} = ${promedio}`, "", ""])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 10 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, areaLabel.slice(0, 28))
    const stamp = new Date().toISOString().split("T")[0]
    XLSX.writeFile(wb, `eficiencia-${areaKey}-${universo}-${stamp}.xlsx`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none sm:max-w-none rounded-none border-0 overflow-hidden flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            Eficiencia de {areaLabel} — auditoría de tiempos
            <Badge
              className={
                universo === "enProceso"
                  ? "ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  : "ml-2 bg-teal-100 text-teal-700 hover:bg-teal-100 border border-teal-200"
              }
            >
              {universoLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Promedio <span className="font-semibold text-foreground">{avg} d</span> ·{" "}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    {contrib.length === 0
                      ? "No hay órdenes con días registrados en esta etapa."
                      : "No se encontraron órdenes con la búsqueda aplicada."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const recep = recepOf(r)
                  const fin = finOf(r)
                  return (
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
                      <TableCell className="max-w-[220px] truncate">{r.cliente}</TableCell>
                      <TableCell className="text-right font-mono">
                        {new Intl.NumberFormat("es-CO").format(Number(r.pcs) || 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(recep)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(fin)}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold tabular-nums text-foreground">{diasOf(r)}</span>
                        <span className="ml-0.5 text-[10px] text-muted-foreground">d</span>
                      </TableCell>
                      <TableCell>{estadoBadge(estadoEtapa(recep, fin))}</TableCell>
                      <TableCell>
                        {r.cerrado ? (
                          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
                            Cerrada
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                            Abierta
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pie: la prueba del promedio + paginación */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-t pt-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Σ días</span>
              <span className="font-semibold text-foreground tabular-nums">{sumDias}</span>
              <span className="text-muted-foreground">÷ órdenes</span>
              <span className="font-semibold text-foreground tabular-nums">{contrib.length}</span>
              <span className="text-muted-foreground">=</span>
              <span className="rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-700 tabular-nums">
                {promedio} d
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Incluye los trabajos del mismo día (0 d). Se excluyen {excluidas}{" "}
              orden{excluidas !== 1 ? "es" : ""} que aún no terminan esta etapa.
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
