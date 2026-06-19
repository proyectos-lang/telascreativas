"use client"

/**
 * Bar chart: cantidad de incidencias por area responsable (area_genera).
 * Apila Pendientes (rosa) sobre Procesadas (slate) para que se vea de un
 * solo vistazo cuanto trabajo de reposicion sigue abierto por equipo.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { BarChart3 } from "lucide-react"
import { useIncidenciasReporte } from "@/lib/incidencias-reporte-context"

const ROSE = "#e11d48" // rose-600
const SLATE = "#cbd5e1" // slate-300

const chartConfig = {
  pendientes: {
    label: "Pendientes",
    color: ROSE,
  },
  resueltas: {
    label: "Procesadas / Sin reposicion",
    color: SLATE,
  },
} satisfies ChartConfig

export function IncidenciasBarChart() {
  const { porAreaGenera, isLoading } = useIncidenciasReporte()

  // Reshape: pendientes + resueltas (total - pendientes) para apilado.
  const data = porAreaGenera.map((row) => ({
    area: row.area,
    pendientes: row.pendientes,
    resueltas: Math.max(row.total - row.pendientes, 0),
    total: row.total,
  }))

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-rose-100 flex items-center justify-center">
            <BarChart3 className="size-3.5 text-rose-600" />
          </div>
          <div>
            <CardTitle className="text-sm">
              Incidencias por Area Responsable
            </CardTitle>
            <CardDescription className="text-xs">
              Apilado: pendientes vs procesadas / sin reposicion
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground italic">
            No hay incidencias en el periodo seleccionado.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
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
                dataKey="pendientes"
                stackId="a"
                fill={ROSE}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="resueltas"
                stackId="a"
                fill={SLATE}
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
