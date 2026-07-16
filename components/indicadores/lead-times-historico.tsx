"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDown, ChevronUp, Clock, RotateCcw, TrendingUp, X } from "lucide-react"
import { KpiCard } from "./kpi-card"
import { supabase, PALETA, fmtDias, fmtDec, type LtHistoricoRow } from "./shared"
import { fetchAll } from "@/lib/fetch-all"

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const AREAS = [
  { key: "diseno",      label: "Diseño",      field: "dias_en_diseno"      as keyof LtHistoricoRow, color: PALETA.navy,    accentClass: "bg-blue-100 text-blue-700"     },
  { key: "corte",       label: "Corte",       field: "dias_en_corte"       as keyof LtHistoricoRow, color: PALETA.teal,    accentClass: "bg-teal-100 text-teal-700"     },
  { key: "impresion",   label: "Impresión",   field: "dias_en_impresion"   as keyof LtHistoricoRow, color: PALETA.emerald, accentClass: "bg-emerald-100 text-emerald-700"},
  { key: "sublimacion", label: "Sublimación", field: "dias_en_sublimacion" as keyof LtHistoricoRow, color: PALETA.amber,   accentClass: "bg-amber-100 text-amber-700"   },
  { key: "costura",     label: "Costura",     field: "dias_en_costura"     as keyof LtHistoricoRow, color: PALETA.coral,   accentClass: "bg-rose-100 text-rose-700"     },
] as const

type AreaKey = typeof AREAS[number]["key"]
type SortCol = AreaKey | "fecha_de_ingreso"
type SortState = { col: SortCol; dir: "asc" | "desc" }

function avgPositive(vals: (number | null | undefined)[]): number | null {
  const pos = vals.filter((v): v is number => typeof v === "number" && !Number.isNaN(v) && v > 0)
  if (pos.length === 0) return null
  return pos.reduce((a, b) => a + b, 0) / pos.length
}

function areaColor(dias: number): string {
  if (dias <= 2) return "#14b8a6"
  if (dias <= 3) return "#f59e0b"
  return "#ef4444"
}

const CURRENT_YEAR = new Date().getFullYear()

export function LeadTimesHistorico() {
  const [allRows, setAllRows] = useState<LtHistoricoRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [anoDesde, setAnoDesde] = useState<number>(CURRENT_YEAR - 1)
  const [anoHasta, setAnoHasta] = useState<number>(CURRENT_YEAR)
  const [areasActivas, setAreasActivas] = useState<AreaKey[]>([])
  const [cliente, setCliente] = useState("")
  const [estilo, setEstilo] = useState("")
  const [esUrgente, setEsUrgente] = useState<"todos" | "si" | "no">("todos")

  // UI state
  const [areaPopoverOpen, setAreaPopoverOpen] = useState(false)
  const [tablaVisible, setTablaVisible] = useState(false)
  const [tablaPagina, setTablaPagina] = useState(0)
  const [tablaSort, setTablaSort] = useState<SortState | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const { data, error } = await fetchAll((from, to) =>
        supabase.schema("telas").from("vista_lead_times_historico").select("*").range(from, to)
      )
      if (!error && data) {
        const rows = data as LtHistoricoRow[]
        setAllRows(rows)
        const anos = [...new Set(rows.map(r => r.ano).filter(Boolean))].sort((a, b) => a - b)
        if (anos.length > 0) {
          setAnoDesde(Math.max(CURRENT_YEAR - 1, anos[0]))
          setAnoHasta(anos[anos.length - 1])
        }
      }
      setIsLoading(false)
    }
    load()
  }, [])

  const uniqueAnos = useMemo(() => {
    const s = new Set(allRows.map(r => r.ano).filter((v): v is number => typeof v === "number"))
    return [...s].sort((a, b) => a - b)
  }, [allRows])

  const uniqueClientes = useMemo(() => {
    const s = new Set(allRows.map(r => r.cliente).filter((v): v is string => !!v))
    return [...s].sort()
  }, [allRows])

  const uniqueEstilos = useMemo(() => {
    const s = new Set(allRows.map(r => r.estilo_de_la_prenda).filter((v): v is string => !!v))
    return [...s].sort()
  }, [allRows])

  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      if ((r.ano ?? 0) < anoDesde || (r.ano ?? 0) > anoHasta) return false
      if (cliente && r.cliente !== cliente) return false
      if (estilo && r.estilo_de_la_prenda !== estilo) return false
      if (esUrgente === "si" && !r.es_urgente) return false
      if (esUrgente === "no" && r.es_urgente) return false
      return true
    })
  }, [allRows, anoDesde, anoHasta, cliente, estilo, esUrgente])

  const avgByArea = useMemo(() => {
    return AREAS.map(a => ({
      ...a,
      avg: avgPositive(filteredRows.map(r => r[a.field] as number | null)),
    }))
  }, [filteredRows])

  const trendData = useMemo(() => {
    const groups = new Map<string, LtHistoricoRow[]>()
    for (const r of filteredRows) {
      const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        const [ano, mes] = key.split("-").map(Number)
        const label = `${MESES_CORTOS[mes - 1]} ${String(ano).slice(2)}`
        const point: Record<string, unknown> = { label, ano, mes }
        for (const a of AREAS) {
          const v = avgPositive(rows.map(r => r[a.field] as number | null))
          point[a.key] = v != null ? +v.toFixed(1) : null
        }
        return point as { label: string; ano: number; mes: number } & Record<AreaKey, number | null>
      })
  }, [filteredRows])

  const areasEnGrafico: AreaKey[] = useMemo(
    () => areasActivas.length === 0 ? (AREAS.map(a => a.key) as AreaKey[]) : areasActivas,
    [areasActivas]
  )

  const barData = useMemo(() => {
    return avgByArea
      .filter(a => areasEnGrafico.includes(a.key as AreaKey))
      .map(a => ({
        area: a.label,
        dias: a.avg != null ? +a.avg.toFixed(1) : 0,
        color: a.avg != null ? areaColor(a.avg) : "#94a3b8",
      }))
  }, [avgByArea, areasEnGrafico])

  const tableRows = useMemo(() => {
    const withData = filteredRows.filter(r =>
      AREAS.some(a => {
        const v = r[a.field] as number | null
        return typeof v === "number" && v > 0
      })
    )
    if (!tablaSort) return withData
    return [...withData].sort((a, b) => {
      if (tablaSort.col === "fecha_de_ingreso") {
        const va = a.fecha_de_ingreso ?? ""
        const vb = b.fecha_de_ingreso ?? ""
        return tablaSort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const area = AREAS.find(x => x.key === tablaSort.col)
      if (!area) return 0
      const va = (a[area.field] as number | null) ?? -1
      const vb = (b[area.field] as number | null) ?? -1
      return tablaSort.dir === "asc" ? va - vb : vb - va
    })
  }, [filteredRows, tablaSort])

  const totalPaginas = Math.ceil(tableRows.length / 25)
  const tablaPaginada = useMemo(() => {
    const start = tablaPagina * 25
    return tableRows.slice(start, start + 25)
  }, [tableRows, tablaPagina])

  function toggleArea(k: AreaKey) {
    setAreasActivas(prev => prev.includes(k) ? prev.filter(a => a !== k) : [...prev, k])
  }

  function toggleSort(col: SortCol) {
    setTablaSort(s => s?.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" })
  }

  function resetFilters() {
    const min = uniqueAnos.length > 0 ? Math.max(CURRENT_YEAR - 1, uniqueAnos[0]) : CURRENT_YEAR - 1
    setAnoDesde(min)
    setAnoHasta(CURRENT_YEAR)
    setAreasActivas([])
    setCliente("")
    setEstilo("")
    setEsUrgente("todos")
  }

  const hayFiltros = !!cliente || !!estilo || esUrgente !== "todos" || areasActivas.length > 0

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Cargando datos históricos…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Filtros ── */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Filtros</h4>
          {hayFiltros && (
            <button
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
              onClick={resetFilters}
            >
              <RotateCcw className="size-3" />
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Año desde */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Año desde</label>
            <Select value={String(anoDesde)} onValueChange={v => setAnoDesde(Number(v))}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uniqueAnos.map(a => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Año hasta */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Año hasta</label>
            <Select value={String(anoHasta)} onValueChange={v => setAnoHasta(Number(v))}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uniqueAnos.filter(a => a >= anoDesde).map(a => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Áreas visibles */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              Áreas en gráficos
              {areasActivas.length > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {areasActivas.length}
                </span>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <Popover open={areaPopoverOpen} onOpenChange={setAreaPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-44 justify-between gap-2 font-normal">
                    <span className="truncate text-sm">
                      {areasActivas.length === 0
                        ? "Todas las áreas"
                        : areasActivas.length === 1
                        ? AREAS.find(a => a.key === areasActivas[0])?.label
                        : `${areasActivas.length} áreas`}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-2" align="start" onOpenAutoFocus={e => e.preventDefault()}>
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
                    onClick={() => setAreasActivas([])}
                  >
                    <Checkbox checked={areasActivas.length === 0} className="pointer-events-none" />
                    <span className="font-medium">Todas</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  {AREAS.map(a => (
                    <button
                      key={a.key}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100"
                      onClick={() => toggleArea(a.key as AreaKey)}
                    >
                      <Checkbox checked={areasActivas.includes(a.key as AreaKey)} className="pointer-events-none" />
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full" style={{ background: a.color }} />
                        {a.label}
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {areasActivas.length > 0 && (
                <button
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100"
                  onClick={() => setAreasActivas([])}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Cliente</label>
            <Select value={cliente || "__todos__"} onValueChange={v => { setCliente(v === "__todos__" ? "" : v); setTablaPagina(0) }}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos los clientes</SelectItem>
                {uniqueClientes.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estilo de prenda */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Estilo de prenda</label>
            <Select value={estilo || "__todos__"} onValueChange={v => { setEstilo(v === "__todos__" ? "" : v); setTablaPagina(0) }}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Todos los estilos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos los estilos</SelectItem>
                {uniqueEstilos.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Urgente */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Urgente</label>
            <Select value={esUrgente} onValueChange={v => { setEsUrgente(v as "todos" | "si" | "no"); setTablaPagina(0) }}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="si">Solo urgentes</SelectItem>
                <SelectItem value="no">No urgentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {avgByArea.map(a => (
          <KpiCard
            key={a.key}
            label={a.label}
            value={a.avg != null ? fmtDias(a.avg) : "Sin datos"}
            hint="Prom. días · solo completados"
            accentClass={a.accentClass}
            icon={<Clock className="size-4" />}
          />
        ))}
      </div>

      {/* ── Comparativo por área ── */}
      <Card className="p-4">
        <div className="mb-1">
          <h3 className="text-sm font-semibold text-slate-800">
            Promedio de Días por Área
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Basado en {filteredRows.length.toLocaleString("es-CO")} pedidos ·
            {" "}<span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-[#14b8a6]" /> ≤ 2 d</span>{" · "}
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-[#f59e0b]" /> 2–3 d</span>{" · "}
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-[#ef4444]" /> &gt; 3 d (meta: &lt; 3 d)</span>
          </p>
        </div>
        {barData.length === 0 || filteredRows.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Sin datos para los filtros aplicados.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 64, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "#64748b" }}
                unit=" d"
                domain={[0, "dataMax + 1"]}
              />
              <YAxis
                type="category"
                dataKey="area"
                tick={{ fontSize: 12, fill: "#64748b" }}
                width={90}
              />
              <Tooltip
                formatter={(v: number) => [`${fmtDec(v)} d`, "Días promedio"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <ReferenceLine
                x={3}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: "Meta 3 d", position: "insideTopRight", fontSize: 11, fill: "#94a3b8", dy: -4 }}
              />
              <Bar
                dataKey="dias"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", formatter: (v: number) => `${fmtDec(v)} d`, fontSize: 11, fill: "#334155" }}
              >
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Tendencia en el tiempo ── */}
      <Card className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <TrendingUp className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Tendencia de Tiempos por Mes</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Promedio de días por área mes a mes · Línea gris punteada = meta 3 días
        </p>
        {trendData.length < 2 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Se necesitan al menos 2 meses de datos para mostrar la tendencia.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit=" d" />
              <Tooltip
                formatter={(v: number, name: string) => [`${fmtDec(v)} d`, name]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="4 4" />
              {AREAS.filter(a => areasEnGrafico.includes(a.key as AreaKey)).map(a => (
                <Line
                  key={a.key}
                  type="monotone"
                  dataKey={a.key}
                  name={a.label}
                  stroke={a.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: a.color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Tabla de detalle (colapsable) ── */}
      <Card className="overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          onClick={() => { setTablaVisible(v => !v); setTablaPagina(0) }}
        >
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Detalle por pedido
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({tableRows.length.toLocaleString("es-CO")} pedidos con datos)
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solo pedidos con al menos un área registrada · clic en encabezado para ordenar
            </p>
          </div>
          {tablaVisible
            ? <ChevronUp className="size-4 shrink-0 text-slate-400" />
            : <ChevronDown className="size-4 shrink-0 text-slate-400" />}
        </button>

        {tablaVisible && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estilo</TableHead>
                    <TableHead className="text-center">Urg.</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right hover:text-slate-800"
                      onClick={() => toggleSort("fecha_de_ingreso")}
                    >
                      Ingreso{" "}
                      {tablaSort?.col === "fecha_de_ingreso" ? (tablaSort.dir === "asc" ? "↑" : "↓") : ""}
                    </TableHead>
                    {AREAS.map(a => (
                      <TableHead
                        key={a.key}
                        className="cursor-pointer select-none text-right hover:text-slate-800"
                        onClick={() => toggleSort(a.key as AreaKey)}
                      >
                        {a.label}{" "}
                        {tablaSort?.col === a.key ? (tablaSort.dir === "asc" ? "↑" : "↓") : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tablaPaginada.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                        Sin pedidos para los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tablaPaginada.map(r => (
                      <TableRow key={r.pedido}>
                        <TableCell className="font-mono text-xs">{r.pedido}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">{r.cliente ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.estilo_de_la_prenda ?? "—"}</TableCell>
                        <TableCell className="text-center">
                          {r.es_urgente ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              Sí
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{r.fecha_de_ingreso ?? "—"}</TableCell>
                        {AREAS.map(a => {
                          const v = r[a.field] as number | null
                          const hasData = typeof v === "number" && v > 0
                          return (
                            <TableCell key={a.key} className="text-right text-xs tabular-nums">
                              {hasData ? (
                                <span className="font-medium" style={{ color: areaColor(v as number) }}>
                                  {fmtDias(v as number)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                <span className="text-xs text-muted-foreground">
                  Página {tablaPagina + 1} de {totalPaginas} · {tableRows.length.toLocaleString("es-CO")} pedidos
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTablaPagina(p => Math.max(0, p - 1))}
                    disabled={tablaPagina === 0}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTablaPagina(p => Math.min(totalPaginas - 1, p + 1))}
                    disabled={tablaPagina >= totalPaginas - 1}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
