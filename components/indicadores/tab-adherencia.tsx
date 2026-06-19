"use client"

import { useMemo, useState, Fragment } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Gauge, ChevronRight, ChevronDown, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  type IndicadoresFiltro,
  type KpiAdherenciaRow,
  MES_TODOS,
  MESES,
  PALETA,
  SERIE_COLORS,
  avg,
  fmtInt,
  fmtPct,
  num,
  periodoLabel,
} from "./shared"
import { AdherenciaDetallePanel } from "./adherencia-detalle-panel"
import { AdherenciaTiempos } from "./adherencia-tiempos"

interface Props {
  rows: KpiAdherenciaRow[]
  filtro: IndicadoresFiltro
}

const AREAS = [
  { key: "adherencia_diseno", label: "Diseno" },
  { key: "adherencia_impresion", label: "Impresion" },
  { key: "adherencia_sublimacion", label: "Sublimacion" },
  { key: "adherencia_corte", label: "Corte" },
  { key: "adherencia_costura", label: "Costura" },
  { key: "adherencia_empaque", label: "Empaque" },
] as const

/** Agrega una lista de filas a un unico registro ponderado por ordenes. */
function agregar(list: KpiAdherenciaRow[]) {
  const ordenes = list.reduce((a, r) => a + num(r.total_ordenes), 0)
  const cumplidos = list.reduce((a, r) => a + num(r.cumplidos_global), 0)
  const areas: Record<string, number> = {}
  for (const a of AREAS) {
    // Promedio ponderado por el numero de ordenes de cada fila.
    const wsum = list.reduce(
      (acc, r) => acc + num(r[a.key]) * num(r.total_ordenes),
      0
    )
    areas[a.key] = ordenes > 0 ? wsum / ordenes : avg(list.map((r) => r[a.key]))
  }
  return {
    ordenes,
    cumplidos,
    adherencia_global: ordenes > 0 ? (cumplidos / ordenes) * 100 : 0,
    areas,
  }
}

const colorAdh = (v: number) =>
  v >= 95 ? "text-emerald-600" : v >= 85 ? "text-amber-600" : "text-rose-600"

export function TabAdherencia({ rows, filtro }: Props) {
  // Adherencia global ponderada del negocio (entregados a tiempo / entregados).
  const { totalOrdenes, totalCumplidos, adherenciaGlobal } = useMemo(() => {
    const ord = rows.reduce((a, r) => a + num(r.total_ordenes), 0)
    const cum = rows.reduce((a, r) => a + num(r.cumplidos_global), 0)
    return {
      totalOrdenes: ord,
      totalCumplidos: cum,
      adherenciaGlobal: ord > 0 ? (cum / ord) * 100 : 0,
    }
  }, [rows])

  // Serie de tendencia de la adherencia global por periodo (mes o semana).
  const tendenciaGlobal = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string
        orden: number
        mes: number
        ordenes: number
        cumplidos: number
      }
    >()
    for (const r of rows) {
      const label = periodoLabel(filtro, r)
      const orden = filtro.mes === MES_TODOS ? num(r.mes) : num(r.semana)
      const e =
        map.get(label) ??
        { label, orden, mes: num(r.mes), ordenes: 0, cumplidos: 0 }
      e.ordenes += num(r.total_ordenes)
      e.cumplidos += num(r.cumplidos_global)
      map.set(label, e)
    }
    return Array.from(map.values())
      .sort((a, b) => a.orden - b.orden)
      .map((e) => ({
        periodo: e.label,
        mes: e.mes,
        ordenes: e.ordenes,
        cumplidos: e.cumplidos,
        adherencia: Number(
          (e.ordenes > 0 ? (e.cumplidos / e.ordenes) * 100 : 0).toFixed(1)
        ),
      }))
  }, [rows, filtro])

  // Datos del grafico de barras agrupadas por area.
  const dataGrafico = useMemo(() => {
    const map = new Map<string, KpiAdherenciaRow[]>()
    for (const r of rows) {
      const key = periodoLabel(filtro, r)
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries()).map(([periodo, list]) => {
      const entry: Record<string, number | string> = { periodo }
      for (const a of AREAS) {
        entry[a.key] = Number(avg(list.map((r) => r[a.key])).toFixed(1))
      }
      return entry
    })
  }, [rows, filtro])

  // Tabla de departamentos: agrupada por mes (con detalle de semanas) cuando
  // se ven todos los meses; por semana cuando hay un mes fijo.
  const tablaDepto = useMemo(() => {
    if (filtro.mes === MES_TODOS) {
      const map = new Map<number, KpiAdherenciaRow[]>()
      for (const r of rows) {
        const m = num(r.mes)
        const arr = map.get(m) ?? []
        arr.push(r)
        map.set(m, arr)
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([m, list]) => ({
          key: `mes-${m}`,
          label: m >= 1 && m <= 12 ? MESES[m - 1] : "—",
          agg: agregar(list),
          hijos: [...list]
            .sort((a, b) => num(a.semana) - num(b.semana))
            .map((r) => ({
              key: `mes-${m}-sem-${num(r.semana)}`,
              label: `Semana ${num(r.semana)}`,
              agg: agregar([r]),
            })),
        }))
    }
    return [...rows]
      .sort((a, b) => num(a.semana) - num(b.semana))
      .map((r, i) => ({
        key: `sem-${i}`,
        label: periodoLabel(filtro, r),
        agg: agregar([r]),
        hijos: [] as { key: string; label: string; agg: ReturnType<typeof agregar> }[],
      }))
  }, [rows, filtro])

  // Control de expansion de filas mensuales.
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const toggle = (key: string) =>
    setExpandido((prev) => ({ ...prev, [key]: !prev[key] }))

  // Detalle de ordenes del mes (conexion directa a telas.cabecera).
  const [detalle, setDetalle] = useState<{
    mes: number
    label: string
  } | null>(null)
  // Solo se puede abrir el detalle por mes cuando los periodos son meses.
  const verPorMes = filtro.mes === MES_TODOS

  return (
    <div className="space-y-4">
      {/* Seccion macro: adherencia global del negocio */}
      <Card className="flex flex-col items-center justify-between gap-4 bg-slate-900 p-6 text-white sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10">
            <Gauge className="size-6 text-teal-300" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">
              Adherencia Global del Negocio
            </p>
            <p className="text-sm text-white/70">
              % de entregas a tiempo al cliente final
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-5xl font-bold ${colorAdh(adherenciaGlobal)}`}>
            {fmtPct(adherenciaGlobal)}
          </p>
          <p className="text-xs text-white/60">
            {fmtInt(totalCumplidos)} a tiempo de {fmtInt(totalOrdenes)} entregadas
          </p>
        </div>
      </Card>

      {/* Tiempos promedio de entrega: prometido vs real (telas.cabecera) */}
      <AdherenciaTiempos filtro={filtro} />

      {/* Tendencia de la adherencia global + tabla explicativa del calculo */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Tendencia de adherencia global
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Evolucion {filtro.mes === MES_TODOS ? "por mes" : "por semana"} frente
            al objetivo del 100%
          </p>
          {tendenciaGlobal.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={tendenciaGlobal}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="periodo"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  domain={[0, 110]}
                  unit="%"
                />
                <Tooltip
                  formatter={(value: number, _name, item) => {
                    const p = item?.payload as {
                      cumplidos: number
                      ordenes: number
                    }
                    return [
                      `${value}% (${fmtInt(p.cumplidos)}/${fmtInt(p.ordenes)})`,
                      "Adherencia",
                    ]
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={100}
                  stroke={PALETA.coral}
                  strokeDasharray="4 4"
                  label={{
                    value: "Objetivo 100%",
                    position: "right",
                    fontSize: 10,
                    fill: PALETA.coral,
                  }}
                />
                <Bar dataKey="adherencia" name="Adherencia" radius={[3, 3, 0, 0]}>
                  {tendenciaGlobal.map((d) => (
                    <Cell
                      key={d.periodo}
                      fill={
                        d.adherencia >= 95
                          ? PALETA.teal
                          : d.adherencia >= 85
                            ? PALETA.amber
                            : PALETA.coral
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Tabla explicativa: entregadas vs entregadas a tiempo */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Calculo de la adherencia
            </h3>
            <p className="text-xs text-muted-foreground">
              Entregadas a tiempo / total entregadas
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Entregadas</TableHead>
                  <TableHead className="text-right">A tiempo</TableHead>
                  <TableHead className="text-right">Adherencia</TableHead>
                  {verPorMes && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tendenciaGlobal.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={verPorMes ? 5 : 4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin datos para el periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {tendenciaGlobal.map((d) => (
                      <TableRow key={d.periodo} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-800">
                          {d.periodo}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtInt(d.ordenes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtInt(d.cumplidos)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${colorAdh(d.adherencia)}`}
                        >
                          {fmtPct(d.adherencia)}
                        </TableCell>
                        {verPorMes && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-slate-500 hover:text-slate-800"
                              title={`Ver detalle de ${d.periodo}`}
                              onClick={() =>
                                setDetalle({ mes: d.mes, label: d.periodo })
                              }
                            >
                              <Eye className="size-4" />
                              <span className="sr-only">Ver detalle</span>
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold">
                      <TableCell className="text-slate-800">TOTAL</TableCell>
                      <TableCell className="text-right">
                        {fmtInt(totalOrdenes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtInt(totalCumplidos)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${colorAdh(adherenciaGlobal)}`}
                      >
                        {fmtPct(adherenciaGlobal)}
                      </TableCell>
                      {verPorMes && <TableCell />}
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Detalle de ordenes del mes a pantalla completa (telas.cabecera) */}
      {detalle && (
        <AdherenciaDetallePanel
          ano={filtro.ano}
          mes={detalle.mes}
          label={detalle.label}
          onClose={() => setDetalle(null)}
        />
      )}

      {/* Grafico de barras agrupadas por area */}
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Adherencia por area vs objetivo
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Comparativo por periodo frente a la linea objetivo del 100%
        </p>
        {dataGrafico.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={dataGrafico}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                domain={[0, 110]}
                unit="%"
              />
              <Tooltip
                formatter={(value: number) => `${value}%`}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={100}
                stroke="#e11d48"
                strokeDasharray="4 4"
                label={{
                  value: "Objetivo 100%",
                  position: "right",
                  fontSize: 10,
                  fill: "#e11d48",
                }}
              />
              {AREAS.map((a, i) => (
                <Bar
                  key={a.key}
                  dataKey={a.key}
                  name={a.label}
                  fill={SERIE_COLORS[i % SERIE_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla de datos avanzada */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Cumplimiento por departamento y periodo
          </h3>
          {filtro.mes === MES_TODOS && (
            <p className="text-xs text-muted-foreground">
              Agrupado por mes. Haz clic en un mes para ver el detalle semanal.
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead className="w-8" />
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Ordenes</TableHead>
                {AREAS.map((a) => (
                  <TableHead key={a.key} className="text-right">
                    {a.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Global</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tablaDepto.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={AREAS.length + 4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin datos para el periodo seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                tablaDepto.map((fila) => {
                  const tieneHijos = fila.hijos.length > 0
                  const abierto = !!expandido[fila.key]
                  return (
                    <Fragment key={fila.key}>
                      <TableRow
                        className={
                          tieneHijos
                            ? "cursor-pointer hover:bg-slate-50/60"
                            : "hover:bg-slate-50/60"
                        }
                        onClick={tieneHijos ? () => toggle(fila.key) : undefined}
                      >
                        <TableCell className="text-slate-400">
                          {tieneHijos &&
                            (abierto ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            ))}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {fila.label}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtInt(fila.agg.ordenes)}
                        </TableCell>
                        {AREAS.map((a) => (
                          <TableCell key={a.key} className="text-right">
                            {fmtPct(fila.agg.areas[a.key])}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`text-right font-semibold ${colorAdh(fila.agg.adherencia_global)}`}
                        >
                          {fmtPct(fila.agg.adherencia_global)}
                        </TableCell>
                      </TableRow>
                      {abierto &&
                        fila.hijos.map((h) => (
                          <TableRow
                            key={h.key}
                            className="bg-slate-50/40 text-xs hover:bg-slate-50/40"
                          >
                            <TableCell />
                            <TableCell className="pl-6 text-slate-600">
                              {h.label}
                            </TableCell>
                            <TableCell className="text-right text-slate-600">
                              {fmtInt(h.agg.ordenes)}
                            </TableCell>
                            {AREAS.map((a) => (
                              <TableCell
                                key={a.key}
                                className="text-right text-slate-600"
                              >
                                {fmtPct(h.agg.areas[a.key])}
                              </TableCell>
                            ))}
                            <TableCell
                              className={`text-right font-medium ${colorAdh(h.agg.adherencia_global)}`}
                            >
                              {fmtPct(h.agg.adherencia_global)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
      Sin datos para graficar en el periodo seleccionado.
    </div>
  )
}
