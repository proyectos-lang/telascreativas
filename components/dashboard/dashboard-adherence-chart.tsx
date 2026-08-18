"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { useDashboard } from "@/lib/dashboard-context"
import { Info, Gauge } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const INDIGO = "#6366f1"
const VIOLET = "#a855f7"
const ROSE = "#ef4444"

// Meta de adherencia a la fecha objetivo por área.
const META_PCT = 90

const chartConfig = {
  enProceso: { label: "En proceso (vigentes)", color: VIOLET },
  general: { label: "General (entregados del mes)", color: INDIGO },
} satisfies ChartConfig

export function DashboardAdherenceChart() {
  const { adherenceByArea, isLoading } = useDashboard()

  // Mes en curso: el universo "General" son los pedidos entregados este mes.
  const mesLabel = new Date().toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  })

  const conDatos = adherenceByArea.filter((a) => a.nGeneral > 0 || a.nEnProceso > 0)

  return (
    <Card className="h-full bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Gauge className="size-4 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Adherencia por Área</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-slate-400 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-72 text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Dos cálculos por área</p>
                    <p>
                      <strong>En proceso</strong>: pedidos vigentes en planta. Si
                      el área ya cerró se compara su fecha de fin contra la
                      objetivo; si sigue abierta se compara contra HOY, así que
                      refleja el riesgo vivo.
                    </p>
                    <p className="mt-1.5">
                      <strong>General (mes en curso)</strong>: proviene de la
                      vista oficial de adherencia (la misma del módulo
                      Indicadores), filtrada al mes actual y ponderada por
                      número de órdenes. Por eso cuadra con lo que ves allí.
                    </p>
                    <p className="mt-1.5">
                      Las fechas objetivo las fija el Planner al aprobar la orden.
                      Solo se cuentan las áreas por las que realmente pasa cada
                      flujo.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription className="text-xs">
              Cumplimiento de la fecha objetivo · meta {META_PCT}% ·{" "}
              <span className="capitalize">{mesLabel}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : conDatos.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Info className="size-5 text-slate-300" />
            <p>
              Sin datos de adherencia todavía.
              <br />
              Se calcula con los pedidos entregados en{" "}
              <span className="capitalize">{mesLabel}</span> y con los vigentes en planta.
            </p>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart
                accessibilityLayer
                data={adherenceByArea}
                layout="vertical"
                margin={{ top: 26, right: 48, left: 8, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="area"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#334155", fontWeight: 500 }}
                  width={90}
                />
                <ReferenceLine
                  x={META_PCT}
                  stroke={ROSE}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Meta ${META_PCT}%`,
                    position: "top",
                    fill: ROSE,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="enProceso"
                  name="En proceso (vigentes)"
                  fill={VIOLET}
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="enProceso"
                    position="right"
                    fontSize={10}
                    fontWeight={700}
                    fill="#7e22ce"
                    formatter={(v: number) => `${v}%`}
                  />
                </Bar>
                <Bar
                  dataKey="general"
                  name="General (entregados del mes)"
                  fill={INDIGO}
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="general"
                    position="right"
                    fontSize={10}
                    fontWeight={700}
                    fill="#4338ca"
                    formatter={(v: number) => `${v}%`}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Nota de alcance del indicador */}
            <div className="mt-3 flex items-start gap-1.5 rounded-md bg-slate-50 px-3 py-2">
              <Info className="mt-0.5 size-3 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-snug text-slate-500">
                <span className="font-semibold text-indigo-700">General</span> es la
                adherencia oficial de <strong><span className="capitalize">{mesLabel}</span></strong>,
                tomada de la misma fuente del módulo <strong>Indicadores</strong> y ponderada
                por número de órdenes (los valores coinciden entre ambos módulos).{" "}
                <span className="font-semibold text-violet-700">En proceso</span> son los
                pedidos que siguen vigentes en planta hoy (aún a tiempo vs ya pasados de
                fecha). Meta: {META_PCT}%.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
