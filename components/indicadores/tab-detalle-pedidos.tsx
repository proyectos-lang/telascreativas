"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Search,
} from "lucide-react"
import { supabase } from "./shared"
import { fetchAll } from "@/lib/fetch-all"
import type { LeadTimeUnificadoRow } from "@/lib/lead-time-unificado"

const PAGE_SIZE = 50

function fDate(d?: string | null): string {
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

function xDate(d?: string | null): string {
  if (!d) return ""
  const ymd = d.slice(0, 10)
  const [y, m, day] = ymd.split("-").map(Number)
  if (!y || !m || !day) return ymd
  return `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function fDias(v: number | null | undefined): string {
  return v === null || v === undefined ? "-" : String(v)
}

const intFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 })

export function TabDetallePedidos() {
  const [allRows, setAllRows] = useState<LeadTimeUnificadoRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [universo, setUniverso] = useState<"todos" | "proceso" | "cerrado">("todos")
  const [urgente, setUrgente] = useState<"todos" | "si" | "no">("todos")
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const { data, error: qErr } = await fetchAll<LeadTimeUnificadoRow>((from, to) =>
        supabase
          .schema("telas")
          .from("vista_lead_times_unificado")
          .select("*")
          .range(from, to) as unknown as PromiseLike<{
          data: LeadTimeUnificadoRow[] | null
          error: { message: string } | null
        }>
      )
      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setAllRows([])
      } else {
        setAllRows(data || [])
      }
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter((r) => {
      if (universo === "proceso" && r.en_proceso !== true) return false
      if (universo === "cerrado" && r.cerrado !== true) return false
      if (urgente === "si" && r.es_urgente !== true) return false
      if (urgente === "no" && r.es_urgente === true) return false
      if (q) {
        const hay =
          (r.pedido || "").toLowerCase().includes(q) ||
          (r.cliente || "").toLowerCase().includes(q) ||
          (r.vendedora || "").toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [allRows, query, universo, urgente])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  function handleExport() {
    const headers = [
      "Pedido", "Cliente", "Vendedora", "Ciudad", "Estilo", "PCS", "Urgente",
      "Estado aprobación", "Situación",
      "Fecha ingreso", "Fecha entrega prometida", "Fecha entrega cliente", "Entregado",
      "Recibido Diseño", "Fin Diseño", "Días Diseño",
      "Recibido Corte", "Fin Corte", "Días Corte",
      "Recibido Impresión", "Fin Impresión", "Días Impresión",
      "Recibido Sublimación", "Fin Sublimación", "Días Sublimación",
      "Recibido Costura", "Fin Costura", "Días Costura",
      "Fecha Empaque", "Lead Time Global",
    ]
    const data = filtered.map((r) => [
      r.pedido ?? "", r.cliente ?? "", r.vendedora ?? "", r.ciudad ?? "", r.estilo_de_la_prenda ?? "",
      Number(r.pcs) || 0, r.es_urgente ? "Sí" : "No",
      r.estado_aprobado_rechazado ?? "", r.en_proceso ? "En proceso" : r.cerrado ? "Cerrado" : "—",
      xDate(r.fecha_de_ingreso), xDate(r.fecha_de_entrega), xDate(r.fecha_entrega_cliente),
      r.entregado_cliente_si_no ? "Sí" : "No",
      xDate(r.dfecha_de_ingreso_diseno), xDate(r.dentrega_diseno), r.dias_en_diseno ?? "",
      xDate(r.cfecha_de_recepcion), xDate(r.cfecha_de_corte), r.dias_en_corte ?? "",
      xDate(r.ifecha_de_ingreso_imp), xDate(r.ientrega_impresion), r.dias_en_impresion ?? "",
      xDate(r.sfecha_de_ingreso_sub), xDate(r.seta_sublimacion), r.dias_en_sublimacion ?? "",
      xDate(r.cosfecha_conteo), xDate(r.coseta_costura), r.dias_en_costura ?? "",
      xDate(r.efecha_de_empaque), r.lead_time_global ?? "",
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Detalle Pedidos")
    const stamp = new Date().toISOString().split("T")[0]
    XLSX.writeFile(wb, `detalle-pedidos-${stamp}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar pedido, cliente o vendedora..."
            className="pl-9 h-9 bg-white"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Situación</label>
          <Select value={universo} onValueChange={(v) => { setUniverso(v as typeof universo); setPage(0) }}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="proceso">En proceso (vigentes)</SelectItem>
              <SelectItem value="cerrado">Cerrados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Urgente</label>
          <Select value={urgente} onValueChange={(v) => { setUrgente(v as typeof urgente); setPage(0) }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="si">Solo urgentes</SelectItem>
              <SelectItem value="no">No urgentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 items-end justify-end">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <FileSpreadsheet className="size-4" />
            Exportar a Excel ({intFmt.format(filtered.length)})
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Error al cargar el detalle: {error}. ¿Ejecutaste{" "}
          <code className="rounded bg-white px-1">scripts/vista_lead_times_unificado.sql</code> en Supabase?
        </Card>
      )}

      {/* Tabla */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60">
                    <TableHead className="text-xs">Pedido</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Vendedora</TableHead>
                    <TableHead className="text-xs text-right">PCS</TableHead>
                    <TableHead className="text-xs">Situación</TableHead>
                    <TableHead className="text-xs">Ingreso</TableHead>
                    <TableHead className="text-xs text-right">Diseño</TableHead>
                    <TableHead className="text-xs text-right">Corte</TableHead>
                    <TableHead className="text-xs text-right">Impr.</TableHead>
                    <TableHead className="text-xs text-right">Subl.</TableHead>
                    <TableHead className="text-xs text-right">Cost.</TableHead>
                    <TableHead className="text-xs text-right">Lead Global</TableHead>
                    <TableHead className="text-xs">Entrega cliente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                        Sin pedidos para los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((r) => (
                      <TableRow key={r.pedido} className="text-xs">
                        <TableCell className="font-semibold whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            {r.pedido}
                            {r.es_urgente && (
                              <Badge variant="outline" className="border-rose-300 bg-rose-100 text-rose-700 h-4 px-1 text-[9px]">U</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.cliente}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-muted-foreground">{r.vendedora}</TableCell>
                        <TableCell className="text-right font-mono">{intFmt.format(Number(r.pcs) || 0)}</TableCell>
                        <TableCell>
                          {r.en_proceso ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">En proceso</Badge>
                          ) : r.cerrado ? (
                            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">Cerrado</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground">—</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fDate(r.fecha_de_ingreso)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fDias(r.dias_en_diseno)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fDias(r.dias_en_corte)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fDias(r.dias_en_impresion)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fDias(r.dias_en_sublimacion)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fDias(r.dias_en_costura)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fDias(r.lead_time_global)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fDate(r.fecha_entrega_cliente)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 text-xs text-muted-foreground">
              <p>
                Mostrando{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length === 0 ? 0 : current * PAGE_SIZE + 1}-
                  {Math.min((current + 1) * PAGE_SIZE, filtered.length)}
                </span>{" "}
                de <span className="font-semibold text-foreground">{intFmt.format(filtered.length)}</span> pedidos
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={current === 0}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2">Pág. {current + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={current >= totalPages - 1}>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
