"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts"
import { useDashboard } from "@/lib/dashboard-context"
import { Activity } from "lucide-react"

// Colors computed in JS per charts guidelines.
// Mapeo semantico:
//  - Recibido (azul)   -> el area tiene la orden en mesa trabajandola.
//  - Pendiente (ambar) -> listo para recibir en esta area pero aun no la toman
//                         (cuello de botella potencial).
//  - En espera (gris)  -> la orden aun esta en un proceso anterior; se muestra
//                         para anticipar la carga que viene en camino.
const BLUE = "#3b82f6"
const AMBER = "#f59e0b"
const SLATE_200 = "#e2e8f0"
const SLATE_300 = "#cbd5e1"

const chartConfig = {
  Recibido: {
    label: "Recibido",
    color: BLUE,
  },
  Pendiente: {
    label: "Pendiente (listo p/ recibir)",
    color: AMBER,
  },
  EnEspera: {
    label: "En espera (viene en camino)",
    color: SLATE_200,
  },
} satisfies ChartConfig

export function DashboardWorkloadChart() {
  const { workloadByArea, bottleneckKey, isLoading } = useDashboard()

  // Enriquecemos cada fila con un total para label superior
  const data = workloadByArea.map((w) => ({
    ...w,
    total: w.Recibido + w.Pendiente + w.EnEspera,
  }))

  const bottleneckLabel = bottleneckKey
    ? workloadByArea.find((w) => w.key === bottleneckKey)?.area
    : null

  return (
    <Card className="h-full bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Activity className="size-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                Embudos de Carga
              </CardTitle>
              <CardDescription className="text-xs">
                Ordenes activas por departamento
              </CardDescription>
            </div>
          </div>
          {bottleneckLabel && !isLoading && (
            <Badge
              variant="outline"
              className="bg-rose-50 border-rose-200 text-rose-700 text-[10px] h-5"
            >
              Max: {bottleneckLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ top: 22, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="area"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="Recibido"
                stackId="a"
                fill={BLUE}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="Pendiente"
                stackId="a"
                fill={AMBER}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="EnEspera"
                stackId="a"
                fill={SLATE_200}
                stroke={SLATE_300}
                strokeWidth={1}
                radius={[6, 6, 0, 0]}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  fontSize={11}
                  fontWeight={700}
                  fill="#0f172a"
                  formatter={(v: number) => (v > 0 ? `${v}` : "")}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
