"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
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
import { Scissors, Ruler, Users, AlertCircle } from "lucide-react"
import {
  type KpiReprocesoRow,
  PALETA,
  SERIE_COLORS,
  avg,
  fmtInt,
  fmtPct,
  num,
} from "./shared"

interface Props {
  rows: KpiReprocesoRow[]
}

/** Devuelve el valor de texto mas frecuente (ignora nulos/vacios). */
function modaTexto(values: (string | null)[]): string {
  const counts = new Map<string, number>()
  for (const v of values) {
    const s = (v ?? "").trim()
    if (!s) continue
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  let best = "—"
  let max = 0
  for (const [k, c] of counts.entries()) {
    if (c > max) {
      max = c
      best = k
    }
  }
  return best
}

/** Frecuencia de cada valor (para gráfico de defectos). */
function frecuencia(
  values: (string | null)[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    const s = (v ?? "").trim()
    if (!s || s === "—") continue
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

const DIMENSIONES = [
  {
    key: "parte" as const,
    label: "Parte afectada",
    field: "top_parte_afectada" as keyof KpiReprocesoRow,
  },
  {
    key: "motivo" as const,
    label: "Motivo critico",
    field: "top_motivo_critico" as keyof KpiReprocesoRow,
  },
  {
    key: "talla" as const,
    label: "Talla",
    field: "top_talla_error" as keyof KpiReprocesoRow,
  },
  {
    key: "genero" as const,
    label: "Genero",
    field: "top_genero_error" as keyof KpiReprocesoRow,
  },
]

type DimKey = (typeof DIMENSIONES)[number]["key"]

export function TabReprocesos({ rows }: Props) {
  const porArea = useMemo(() => {
    const map = new Map<string, KpiReprocesoRow[]>()
    for (const r of rows) {
      const key = r.area_responsable ?? "—"
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([area, list]) => ({
        area,
        piezas: list.reduce((a, r) => a + num(r.total_piezas_entregadas), 0),
        incidencias: list.reduce(
          (a, r) => a + num(r.cantidad_incidencias_reportadas),
          0
        ),
        calidad: avg(list.map((r) => r.porcentaje_calidad_cumplimiento)),
        topParte: modaTexto(list.map((r) => r.top_parte_afectada)),
        topTalla: modaTexto(list.map((r) => r.top_talla_error)),
        topGenero: modaTexto(list.map((r) => r.top_genero_error)),
        topMotivo: modaTexto(list.map((r) => r.top_motivo_critico)),
      }))
      .sort((a, b) => b.incidencias - a.incidencias)
  }, [rows])

  const [areaSel, setAreaSel] = useState<string>("")
  const [dimActiva, setDimActiva] = useState<DimKey>("parte")

  const areaActiva = useMemo(() => {
    if (porArea.length === 0) return null
    const found = porArea.find((a) => a.area === areaSel)
    return found ?? porArea[0]
  }, [porArea, areaSel])

  const dataDonut = useMemo(
    () =>
      porArea
        .filter((a) => a.incidencias > 0)
        .map((a) => ({ name: a.area, value: a.incidencias })),
    [porArea]
  )

  // Gráfico de defectos: frecuencia de cada valor en la dimensión activa
  // para las filas del área seleccionada.
  const datosDefectos = useMemo(() => {
    const dim = DIMENSIONES.find((d) => d.key === dimActiva)!
    const rowsArea = areaActiva
      ? rows.filter(
          (r) => (r.area_responsable ?? "—") === areaActiva.area
        )
      : rows
    return frecuencia(rowsArea.map((r) => r[dim.field] as string | null))
  }, [rows, areaActiva, dimActiva])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Donut: distribucion de incidencias por area */}
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Distribucion de incidencias por area
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Volumen acumulado de reprocesos reportados
          </p>
          {dataDonut.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Sin incidencias en el periodo seleccionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dataDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {dataDonut.map((_, i) => (
                    <Cell
                      key={i}
                      fill={SERIE_COLORS[i % SERIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `${fmtInt(value)} incidencias`,
                    "",
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Panel de pareteos para el area seleccionada */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Analisis del area
            </h3>
            <Select
              value={areaActiva?.area ?? ""}
              onValueChange={setAreaSel}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Selecciona area" />
              </SelectTrigger>
              <SelectContent>
                {porArea.map((a) => (
                  <SelectItem key={a.area} value={a.area} className="text-xs">
                    {a.area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!areaActiva ? (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              Sin datos para el periodo seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParetoCard
                label="Top parte afectada"
                value={areaActiva.topParte}
                icon={<Scissors className="size-4" />}
                accent="bg-rose-100 text-rose-700"
              />
              <ParetoCard
                label="Talla critica"
                value={areaActiva.topTalla}
                icon={<Ruler className="size-4" />}
                accent="bg-amber-100 text-amber-700"
              />
              <ParetoCard
                label="Genero mas afectado"
                value={areaActiva.topGenero}
                icon={<Users className="size-4" />}
                accent="bg-blue-100 text-blue-700"
              />
              <ParetoCard
                label="Motivo critico"
                value={areaActiva.topMotivo}
                icon={<AlertCircle className="size-4" />}
                accent="bg-slate-100 text-slate-700"
              />
            </div>
          )}
        </Card>
      </div>

      {/* Gráfico de defectos por dimensión */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Defectos generados
              {areaActiva && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  — {areaActiva.area}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              Frecuencia de aparicion de cada valor como defecto top en el
              periodo seleccionado
            </p>
          </div>
          {/* Selector de dimensión */}
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDimActiva(d.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  dimActiva === d.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {datosDefectos.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Sin datos de defectos para el area y dimension seleccionadas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={datosDefectos}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
                label={{
                  value: "Veces como top defecto",
                  position: "insideBottom",
                  offset: -2,
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569" }}
                width={130}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${value} ${value === 1 ? "vez" : "veces"}`,
                  DIMENSIONES.find((d) => d.key === dimActiva)?.label ?? "",
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" name="Frecuencia" radius={[0, 3, 3, 0]}>
                {datosDefectos.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      dimActiva === "parte"
                        ? PALETA.coral
                        : dimActiva === "motivo"
                          ? PALETA.navy
                          : dimActiva === "talla"
                            ? PALETA.amber
                            : PALETA.teal
                    }
                    fillOpacity={1 - i * 0.07}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla de calidad por taller */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Calidad por taller
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead>Area responsable</TableHead>
              <TableHead className="text-right">Piezas entregadas</TableHead>
              <TableHead className="text-right">Incidencias</TableHead>
              <TableHead className="text-right">% Calidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {porArea.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin datos para el periodo seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              porArea.map((a) => {
                const calidadColor =
                  a.calidad >= 98
                    ? "text-emerald-600"
                    : a.calidad >= 95
                      ? "text-amber-600"
                      : "text-rose-600"
                return (
                  <TableRow key={a.area} className="hover:bg-slate-50/60">
                    <TableCell className="font-medium text-slate-800">
                      {a.area}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtInt(a.piezas)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtInt(a.incidencias)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${calidadColor}`}
                    >
                      {fmtPct(a.calidad)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function ParetoCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex size-7 items-center justify-center rounded-md ${accent}`}
        >
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="truncate text-base font-semibold text-slate-800" title={value}>
        {value}
      </p>
    </div>
  )
}
