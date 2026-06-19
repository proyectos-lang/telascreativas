"use client"

import { useMemo, useState, Fragment } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
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
import {
  Palette,
  Award,
  AlertTriangle,
  Target,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { KpiCard } from "./kpi-card"
import {
  type IndicadoresFiltro,
  type KpiDisenoRow,
  MES_TODOS,
  PALETA,
  SERIE_COLORS,
  avg,
  fmtDec,
  fmtInt,
  fmtMoney,
  fmtPct,
  num,
  periodoLabel,
} from "./shared"

const BONO_META = 500
// Cumplimiento minimo (exclusivo) para ganar el bono: > 90%.
const BONO_UMBRAL = 90
// Meta de produccion de disenos: 90 por mes => ~22.5 por semana.
const META_MENSUAL = 90
const META_SEMANAL = META_MENSUAL / 4

interface Props {
  rows: KpiDisenoRow[]
  filtro: IndicadoresFiltro
}

export function TabDiseno({ rows, filtro }: Props) {
  // Total de disenos entregados en el periodo visible.
  const totalDisenos = useMemo(
    () => rows.reduce((acc, r) => acc + num(r.diseños_entregados), 0),
    [rows]
  )

  const alcancePromedio = useMemo(
    () => avg(rows.map((r) => r.porcentaje_alcance)),
    [rows]
  )

  // Meta del periodo seleccionado:
  // - Semana especifica  -> 22.5 (90/4)
  // - Mes completo        -> 90
  // - Todo el año         -> 90 x cantidad de meses con datos
  const metaPeriodo = useMemo(() => {
    if (filtro.semanas.length > 0)
      return META_SEMANAL * Math.max(1, filtro.semanas.length)
    if (filtro.mes !== MES_TODOS) return META_MENSUAL
    const meses = new Set(
      rows.map((r) => num(r.mes)).filter((m) => m >= 1 && m <= 12)
    )
    return META_MENSUAL * Math.max(1, meses.size)
  }, [rows, filtro])

  // Cumplimiento global = total entregado vs meta del periodo.
  const cumplimientoPromedio = useMemo(
    () => (metaPeriodo > 0 ? (totalDisenos / metaPeriodo) * 100 : 0),
    [totalDisenos, metaPeriodo]
  )

  // Tendencia: una linea por diseñador con su % de cumplimiento vs la meta
  // de cada punto (semanal cuando hay mes fijo, mensual cuando es todo el año).
  const { tendencia, disenadores } = useMemo(() => {
    const metaPorPunto =
      filtro.mes === MES_TODOS ? META_MENSUAL : META_SEMANAL
    const disSet = new Set<string>()
    const periodKey = new Map<string, number>()
    // periodo -> diseñador -> entregados
    const map = new Map<string, Map<string, number>>()
    for (const r of rows) {
      const dis = r.disenador ?? "—"
      const per = periodoLabel(filtro, r)
      disSet.add(dis)
      periodKey.set(per, filtro.mes === MES_TODOS ? num(r.mes) : num(r.semana))
      const inner = map.get(per) ?? new Map<string, number>()
      inner.set(dis, num(inner.get(dis)) + num(r.diseños_entregados))
      map.set(per, inner)
    }
    const disList = Array.from(disSet)
    const data = Array.from(map.entries())
      .sort((a, b) => (periodKey.get(a[0]) ?? 0) - (periodKey.get(b[0]) ?? 0))
      .map(([periodo, inner]) => {
        const obj: Record<string, number | string> = { periodo }
        for (const dis of disList) {
          obj[dis] =
            metaPorPunto > 0
              ? Number(((num(inner.get(dis)) / metaPorPunto) * 100).toFixed(1))
              : 0
        }
        return obj
      })
    return { tendencia: data, disenadores: disList }
  }, [rows, filtro])

  // Tabla agregada por diseñador.
  const porDisenador = useMemo(() => {
    const map = new Map<string, KpiDisenoRow[]>()
    for (const r of rows) {
      const key = r.disenador ?? "—"
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([disenador, list]) => {
        const entregados = list.reduce(
          (a, r) => a + num(r.diseños_entregados),
          0
        )
        // Cumplimiento vs meta del periodo (90/mes, 22.5/semana).
        const cumplimiento = metaPeriodo > 0 ? (entregados / metaPeriodo) * 100 : 0
        // Desglose por semana (entregados y cumplimiento vs meta semanal).
        const semMap = new Map<number, number>()
        for (const r of list) {
          const sem = num(r.semana)
          semMap.set(sem, num(semMap.get(sem)) + num(r.diseños_entregados))
        }
        const semanas = Array.from(semMap.entries())
          .map(([semana, ent]) => ({
            semana,
            entregados: ent,
            cumplimiento:
              META_SEMANAL > 0 ? (ent / META_SEMANAL) * 100 : 0,
          }))
          .sort((a, b) => a.semana - b.semana)
        return {
          disenador,
          entregados,
          // Bono de L 500 si supera el 90% de cumplimiento de la meta.
          bono: cumplimiento > BONO_UMBRAL ? BONO_META : 0,
          incidencias: list.reduce((a, r) => a + num(r.total_incidencias), 0),
          cumplimiento,
          semanas,
        }
      })
      .sort((a, b) => b.entregados - a.entregados)
  }, [rows, metaPeriodo])

  // % de participacion de cada diseñador sobre el total de entregas.
  const totalParticipacion = useMemo(
    () => porDisenador.reduce((a, d) => a + d.entregados, 0),
    [porDisenador]
  )

  // Diseñadores que ganaron el bono (cumplimiento > 90%).
  const ganadoresBono = useMemo(
    () => porDisenador.filter((d) => d.bono >= BONO_META),
    [porDisenador]
  )

  // Control de filas expandidas (detalle semanal por diseñador).
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const toggleExpandir = (disenador: string) =>
    setExpandido((prev) => ({ ...prev, [disenador]: !prev[disenador] }))

  return (
    <div className="space-y-4">
      {/* KPI Cards superiores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Disenos entregados"
          value={fmtInt(totalDisenos)}
          hint="Total en el periodo seleccionado"
          icon={<Palette className="size-4" />}
          accentClass="bg-amber-100 text-amber-700"
        />
        <KpiCard
          label="Bonos alcanzados"
          value={`${fmtInt(ganadoresBono.length)} x ${fmtMoney(BONO_META)}`}
          hint={
            ganadoresBono.length > 0
              ? `Superan el ${BONO_UMBRAL}% de la meta`
              : `Nadie supera el ${BONO_UMBRAL}% de la meta aun`
          }
          icon={<Award className="size-4" />}
          accentClass="bg-emerald-100 text-emerald-700"
          highlight={ganadoresBono.length > 0}
        />
        <KpiCard
          label="% Alcance de meta"
          value={fmtPct(alcancePromedio)}
          hint="Promedio del periodo"
          icon={<Target className="size-4" />}
          accentClass="bg-blue-100 text-blue-700"
        />
        <KpiCard
          label="% Cumplimiento de meta"
          value={fmtPct(cumplimientoPromedio)}
          hint={`${fmtInt(totalDisenos)} de ${fmtInt(metaPeriodo)} (meta del periodo)`}
          icon={<AlertTriangle className="size-4" />}
          accentClass="bg-teal-100 text-teal-700"
          highlight={cumplimientoPromedio >= 100}
        />
      </div>

      {/* Grafico de tendencia combinado */}
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Tendencia de desempeno por diseñador
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          % de cumplimiento de la meta{" "}
          {filtro.mes === MES_TODOS
            ? `mensual (${META_MENSUAL}/mes)`
            : `semanal (~${fmtDec(META_SEMANAL)}/semana)`}{" "}
          por periodo. La linea punteada marca el 100% de la meta.
        </p>
        {tendencia.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={tendencia}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                domain={[0, (max: number) => Math.max(120, Math.ceil(max + 10))]}
                unit="%"
              />
              <Tooltip
                formatter={(value: number) => `${fmtDec(value)}%`}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={100}
                stroke={PALETA.coral}
                strokeDasharray="6 4"
                label={{
                  value: "Meta 100%",
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: PALETA.coral,
                }}
              />
              {disenadores.map((dis, i) => (
                <Line
                  key={dis}
                  type="monotone"
                  dataKey={dis}
                  name={dis}
                  stroke={SERIE_COLORS[i % SERIE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla de datos por diseñador */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Detalle por disenador
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead className="w-8" />
              <TableHead>Disenador</TableHead>
              <TableHead className="text-right">Entregados</TableHead>
              <TableHead className="text-right">% Participacion</TableHead>
              <TableHead className="text-right">Bono (L)</TableHead>
              <TableHead className="text-right">Incidencias</TableHead>
              <TableHead className="text-right">% Cumplimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {porDisenador.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin datos para el periodo seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              porDisenador.map((d) => {
                const abierto = !!expandido[d.disenador]
                const participacion =
                  totalParticipacion > 0
                    ? (d.entregados / totalParticipacion) * 100
                    : 0
                return (
                  <Fragment key={d.disenador}>
                    <TableRow
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => toggleExpandir(d.disenador)}
                    >
                      <TableCell className="text-slate-400">
                        {abierto ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {d.disenador}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtInt(d.entregados)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-700">
                        {fmtPct(participacion)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          d.bono >= BONO_META
                            ? "text-emerald-600"
                            : "text-slate-700"
                        }`}
                      >
                        {fmtMoney(d.bono)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtInt(d.incidencias)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtPct(d.cumplimiento)}
                      </TableCell>
                    </TableRow>
                    {abierto && (
                      <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
                        <TableCell />
                        <TableCell colSpan={6} className="py-2">
                          {d.semanas.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Sin detalle semanal disponible.
                            </p>
                          ) : (
                            <div className="rounded-md border border-slate-200 bg-white">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50/80">
                                    <TableHead className="h-8 text-xs">
                                      Semana
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      Entregados
                                    </TableHead>
                                    <TableHead className="h-8 text-right text-xs">
                                      % Cumplimiento semanal
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {d.semanas.map((s) => (
                                    <TableRow key={s.semana}>
                                      <TableCell className="py-1.5 text-xs font-medium text-slate-700">
                                        Semana {s.semana}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-right text-xs">
                                        {fmtInt(s.entregados)}
                                      </TableCell>
                                      <TableCell
                                        className={`py-1.5 text-right text-xs font-medium ${
                                          s.cumplimiento >= 100
                                            ? "text-emerald-600"
                                            : "text-slate-600"
                                        }`}
                                      >
                                        {fmtPct(s.cumplimiento)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Sin datos para graficar en el periodo seleccionado.
    </div>
  )
}
