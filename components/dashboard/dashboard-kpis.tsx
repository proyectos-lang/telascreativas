"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { useDashboard } from "@/lib/dashboard-context"

interface KpiCardProps {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  accentClass: string // tailwind color stripe + icon bg/text
  trend?: {
    direction: "up" | "down" | "neutral"
    text: string
  }
  emphasis?: boolean
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accentClass,
  trend,
  emphasis,
}: KpiCardProps) {
  return (
    <Card
      className={[
        "relative overflow-hidden border bg-white shadow-sm transition-all hover:shadow-md group",
        emphasis ? "border-rose-200 ring-1 ring-rose-200" : "",
      ].join(" ")}
    >
      {/* Left color stripe */}
      <div
        className={["absolute left-0 top-0 h-full w-1", accentClass].join(" ")}
      />

      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {label}
            </p>
            <p
              className={[
                "text-3xl md:text-4xl font-bold tabular-nums leading-tight mt-1",
                emphasis ? "text-rose-600" : "text-foreground",
              ].join(" ")}
            >
              {value}
            </p>
          </div>
          <div
            className={[
              "size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
              accentClass,
            ].join(" ")}
          >
            <Icon className="size-5 text-white" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">{sub}</p>
          {trend && (
            <div
              className={[
                "flex items-center gap-0.5 text-[10px] font-semibold shrink-0",
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-rose-600"
                    : "text-muted-foreground",
              ].join(" ")}
            >
              {trend.direction === "up" && <TrendingUp className="size-3" />}
              {trend.direction === "down" && <TrendingDown className="size-3" />}
              {trend.text}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardKpis() {
  const {
    totalPcs,
    totalOrders,
    criticalAlerts,
    avgLeadTime,
    onTimeCount,
    isLoading,
  } = useDashboard()

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  const onTimePct =
    totalOrders > 0 ? Math.round((onTimeCount / totalOrders) * 100) : 0

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total en Produccion"
        value={new Intl.NumberFormat("es-CO").format(totalPcs)}
        sub="Piezas activas en planta"
        icon={Boxes}
        accentClass="bg-sky-500"
      />
      <KpiCard
        label="Ordenes Activas"
        value={new Intl.NumberFormat("es-CO").format(totalOrders)}
        sub="Pedidos en seguimiento"
        icon={ClipboardList}
        accentClass="bg-indigo-500"
        trend={{
          direction: onTimePct >= 75 ? "up" : "down",
          text: `${onTimePct}% a tiempo`,
        }}
      />
      <KpiCard
        label="Alertas Criticas"
        value={new Intl.NumberFormat("es-CO").format(criticalAlerts)}
        sub="Vencidos + Riesgo Critico"
        icon={AlertTriangle}
        accentClass="bg-rose-500"
        emphasis={criticalAlerts > 0}
        trend={
          criticalAlerts === 0
            ? {
                direction: "up",
                text: "Todo OK",
              }
            : undefined
        }
      />
      <KpiCard
        label="Lead Time Promedio"
        value={`${avgLeadTime} d`}
        sub="Dias de produccion por orden"
        icon={CheckCircle2}
        accentClass="bg-emerald-500"
      />
    </div>
  )
}
