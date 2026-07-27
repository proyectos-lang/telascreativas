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
import { useState } from "react"
import { useDashboard, type AreaEfficiency } from "@/lib/dashboard-context"
import type { AreaLT } from "@/lib/lead-time-unificado"
import { Info, Timer, MousePointerClick } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DashboardEfficiencyDetailModal } from "./dashboard-efficiency-detail-modal"

const TEAL = "#14b8a6"
const AMBER = "#f59e0b"
const ROSE = "#ef4444"

// Meta: días objetivo que cada área debería tardar en procesar un pedido.
const META_DIAS = 3

type Universo = "enProceso" | "general"

const chartConfig = {
  enProceso: { label: "En proceso (vigentes)", color: AMBER },
  general: { label: "General (con cerrados)", color: TEAL },
} satisfies ChartConfig

export function DashboardEfficiencyChart() {
  const { efficiencyByArea, leadRows, isLoading } = useDashboard()

  const [selected, setSelected] = useState<{
    key: AreaLT
    label: string
    universo: Universo
    avg: number
  } | null>(null)

  const totalGeneral = leadRows.length
  const totalEnProceso = leadRows.filter((r) => r.en_proceso === true).length

  const openAudit = (row: AreaEfficiency, universo: Universo) => {
    setSelected({
      key: row.key,
      label: row.area,
      universo,
      avg: universo === "enProceso" ? row.enProceso : row.general,
    })
  }

  return (
    <Card className="h-full bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-100 flex items-center justify-center">
            <Timer className="size-4 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-base">Eficiencia de Tiempos</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-slate-400 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-72 text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Dos cálculos por área</p>
                    <p>
                      <strong>En proceso</strong>: solo los pedidos vigentes en
                      planta (aprobados y aún no empacados).
                    </p>
                    <p className="mt-1.5">
                      <strong>General</strong>: todos los pedidos, incluidos los
                      ya cerrados — refleja el desempeño real del área.
                    </p>
                    <p className="mt-1.5">
                      Días calendario desde que el área recibe hasta que termina
                      su parte (incluye trabajos del mismo día). Las órdenes
                      vigentes que siguen en el proceso cuentan su tiempo actual
                      (hoy − recepción).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription className="text-xs">
              Días que cada área tarda en procesar un pedido · vigentes vs total · meta &lt;{META_DIAS}d
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : leadRows.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Info className="size-5 text-slate-300" />
            <p>
              No hay datos de la vista unificada.
              <br />
              Ejecuta{" "}
              <code className="rounded bg-slate-100 px-1 text-[11px]">
                scripts/vista_lead_times_unificado.sql
              </code>{" "}
              en Supabase.
            </p>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart
                accessibilityLayer
                data={efficiencyByArea}
                layout="vertical"
                margin={{ top: 8, right: 44, left: 8, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  allowDecimals
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
                  x={META_DIAS}
                  stroke={ROSE}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Meta ${META_DIAS}d`,
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
                  fill={AMBER}
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(d: { payload?: AreaEfficiency }) =>
                    d?.payload && openAudit(d.payload, "enProceso")
                  }
                >
                  <LabelList
                    dataKey="enProceso"
                    position="right"
                    fontSize={10}
                    fontWeight={700}
                    fill="#b45309"
                    formatter={(v: number) => `${v} d`}
                  />
                </Bar>
                <Bar
                  dataKey="general"
                  name="General (con cerrados)"
                  fill={TEAL}
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(d: { payload?: AreaEfficiency }) =>
                    d?.payload && openAudit(d.payload, "general")
                  }
                >
                  <LabelList
                    dataKey="general"
                    position="right"
                    fontSize={10}
                    fontWeight={700}
                    fill="#0f766e"
                    formatter={(v: number) => `${v} d`}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Hint: clic para auditar */}
            <div className="mt-3 flex items-center gap-1.5 rounded-md bg-teal-50 px-3 py-2">
              <MousePointerClick className="size-3.5 text-teal-500 shrink-0" />
              <p className="text-[11px] text-teal-700 leading-snug">
                Haz clic en cualquier barra para auditar orden por orden los días que la componen.
              </p>
            </div>

            {/* Pie: universos */}
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-2">
              <Info className="size-3 text-slate-400 shrink-0" />
              <p className="text-[11px] text-slate-500 leading-snug">
                <span className="font-semibold text-amber-700">{totalEnProceso}</span> pedidos en proceso ·{" "}
                <span className="font-semibold text-teal-700">{totalGeneral}</span> pedidos en total (con cerrados)
              </p>
            </div>
          </>
        )}
      </CardContent>

      {selected && (
        <DashboardEfficiencyDetailModal
          areaKey={selected.key}
          areaLabel={selected.label}
          universo={selected.universo}
          avg={selected.avg}
          rows={leadRows}
          open
          onClose={() => setSelected(null)}
        />
      )}
    </Card>
  )
}
