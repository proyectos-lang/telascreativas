"use client"

/**
 * Line chart: tendencia historica de incidencias.
 * - Si el rango filtrado es <= 60 dias se muestra granularidad diaria.
 * - Si es > 60 dias el contexto agrupa por mes para evitar saturacion.
 *
 * El chart formatea el eje X de forma humana ("12 abr" / "abr 2026").
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
  type ChartConfig,
} from "@/components/ui/chart"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingUp } from "lucide-react"
import { useIncidenciasReporte } from "@/lib/incidencias-reporte-context"

const ROSE = "#e11d48"

const chartConfig = {
  count: {
    label: "Incidencias",
    color: ROSE,
  },
} satisfies ChartConfig

/** Detecta si la cadena es "YYYY-MM" (mensual) o "YYYY-MM-DD" (diaria). */
function isMonthly(s: string): boolean {
  return s.length === 7
}

/** Formatea la etiqueta del eje X. */
function formatTick(s: string): string {
  if (isMonthly(s)) {
    const [y, m] = s.split("-").map(Number)
    const d = new Date(Date.UTC(y, (m || 1) - 1, 1))
    return d.toLocaleDateString("es-CO", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
  }
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  return dt.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

export function IncidenciasLineChart() {
  const { porFechaSerie, isLoading } = useIncidenciasReporte()

  const monthly = porFechaSerie.length > 0 && isMonthly(porFechaSerie[0].fecha)

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-rose-100 flex items-center justify-center">
            <TrendingUp className="size-3.5 text-rose-600" />
          </div>
          <div>
            <CardTitle className="text-sm">Tendencia Historica</CardTitle>
            <CardDescription className="text-xs">
              {monthly
                ? "Granularidad mensual (rango > 60 dias)"
                : "Incidencias registradas por dia"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : porFechaSerie.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground italic">
            No hay datos en el periodo seleccionado.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <LineChart
              accessibilityLayer
              data={porFechaSerie}
              margin={{ top: 14, right: 14, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="fecha"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTick}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent labelFormatter={(label: string) => formatTick(label)} />
                }
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={ROSE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: ROSE }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
