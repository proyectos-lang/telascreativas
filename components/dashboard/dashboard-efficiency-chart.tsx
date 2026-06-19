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
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { useDashboard } from "@/lib/dashboard-context"
import { Timer } from "lucide-react"

// JS colors per guidelines
const TEAL = "#14b8a6"
const ROSE = "#ef4444"
const AMBER = "#f59e0b"

const chartConfig = {
  dias: {
    label: "Dias promedio",
    color: TEAL,
  },
} satisfies ChartConfig

const SLOW_THRESHOLD = 3
const WARN_THRESHOLD = 2

export function DashboardEfficiencyChart() {
  // Para el grafico de Eficiencia de Tiempos usamos `avgDaysByAreaAll`
  // (incluye ordenes Completadas) para reflejar el rendimiento real de
  // cada area sobre todo el historial, en lugar de solo las activas.
  const { avgDaysByAreaAll, isLoading } = useDashboard()

  return (
    <Card className="h-full bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-100 flex items-center justify-center">
            <Timer className="size-4 text-teal-600" />
          </div>
          <div>
            <CardTitle className="text-base">Eficiencia de Tiempos</CardTitle>
            <CardDescription className="text-xs">
              Promedio de dias por departamento - meta &lt;{SLOW_THRESHOLD}d
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart
              accessibilityLayer
              data={avgDaysByAreaAll}
              layout="vertical"
              margin={{ top: 8, right: 44, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
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
                x={SLOW_THRESHOLD}
                stroke={ROSE}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{
                  value: "Meta",
                  position: "top",
                  fill: ROSE,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="dias" radius={[0, 6, 6, 0]}>
                {avgDaysByAreaAll.map((row, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      row.dias > SLOW_THRESHOLD
                        ? ROSE
                        : row.dias > WARN_THRESHOLD
                          ? AMBER
                          : TEAL
                    }
                  />
                ))}
                <LabelList
                  dataKey="dias"
                  position="right"
                  fontSize={11}
                  fontWeight={700}
                  fill="#334155"
                  formatter={(value: number) => `${value} d`}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
