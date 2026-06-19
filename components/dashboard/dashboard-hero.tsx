"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, RefreshCw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"
import { useDashboard } from "@/lib/dashboard-context"

// Compute colors in JS (guideline: don't pass CSS vars to Recharts)
const EMERALD = "#10b981"
const AMBER = "#f59e0b"
const ROSE = "#f43f5e"
const SLATE_800 = "#1e293b"

function formatTime(d: Date | null): string {
  if (!d) return "-"
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDate(d: Date | null): string {
  if (!d) return ""
  return d.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

interface MiniStatProps {
  label: string
  value: string
  sub?: string
  accent: string
}

function MiniStat({ label, value, sub, accent }: MiniStatProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {label}
      </span>
      <span
        className={["text-2xl font-bold tabular-nums leading-tight", accent].join(
          " "
        )}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-slate-400 truncate">{sub}</span>
      )}
    </div>
  )
}

export function DashboardHero() {
  const {
    healthScore,
    onTimeCount,
    mediumRiskCount,
    overdueCount,
    criticalAlerts,
    totalOrders,
    activeOrdersCount,
    totalPcs,
    lastUpdated,
    refresh,
    isLoading,
  } = useDashboard()

  // Ticking clock for "live" feel
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Health bar color by score
  const healthColor =
    healthScore >= 75 ? EMERALD : healthScore >= 50 ? AMBER : ROSE
  const healthLabel =
    healthScore >= 75
      ? "Excelente"
      : healthScore >= 50
        ? "Atencion"
        : "Critico"

  const gaugeData = [
    {
      name: "health",
      value: healthScore,
      fill: healthColor,
    },
  ]

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-slate-950 text-white">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_auto] items-center">
        {/* LEFT: Title + Live + stats */}
        <div className="min-w-0 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                </span>
                <span className="text-[11px] uppercase tracking-widest font-semibold text-emerald-300">
                  En vivo
                </span>
              </div>

              <span className="h-4 w-px bg-slate-700" />

              <span className="text-xs text-slate-400 capitalize">
                {formatDate(now)}
              </span>

              <span className="h-4 w-px bg-slate-700 hidden sm:block" />

              <span className="text-xs text-slate-400 font-mono tabular-nums hidden sm:inline">
                {formatTime(now)}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
              Centro de Mando de Produccion
            </h1>
          </div>

          {/* Mini-stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
            <MiniStat
              label="Pedidos totales"
              value={new Intl.NumberFormat("es-CO").format(totalOrders)}
              sub={`${activeOrdersCount} activos`}
              accent="text-white"
            />
            <MiniStat
              label="Piezas activas"
              value={new Intl.NumberFormat("es-CO").format(totalPcs)}
              sub="En planta"
              accent="text-sky-300"
            />
            <MiniStat
              label="A tiempo"
              value={new Intl.NumberFormat("es-CO").format(onTimeCount)}
              sub="Sin riesgo"
              accent="text-emerald-300"
            />
            <MiniStat
              label="Alertas"
              value={new Intl.NumberFormat("es-CO").format(criticalAlerts)}
              sub={`${overdueCount} vencidos / ${mediumRiskCount} medio`}
              accent={
                criticalAlerts > 0 ? "text-rose-300" : "text-slate-300"
              }
            />
          </div>

          {/* Footer row: last update + refresh */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Activity className="size-3.5 text-emerald-400" />
              <span>
                Ultima actualizacion:{" "}
                <span className="font-mono text-slate-200 tabular-nums">
                  {formatTime(lastUpdated)}
                </span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={isLoading}
              className="h-8 bg-white/5 border-slate-700 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw
                className={[
                  "size-3.5 mr-1.5",
                  isLoading ? "animate-spin" : "",
                ].join(" ")}
              />
              Actualizar
            </Button>
          </div>
        </div>

        {/* RIGHT: Health gauge */}
        <div className="flex items-center justify-center lg:justify-end">
          {isLoading ? (
            <Skeleton className="size-52 rounded-full bg-slate-800" />
          ) : (
            <div className="relative">
              <div className="w-52 h-52 md:w-56 md:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="78%"
                    outerRadius="100%"
                    data={gaugeData}
                    startAngle={90}
                    endAngle={-270}
                    barSize={14}
                  >
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />
                    <RadialBar
                      background={{ fill: SLATE_800 }}
                      dataKey="value"
                      cornerRadius={12}
                      fill={healthColor}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Zap
                  className="size-4 mb-1"
                  style={{ color: healthColor }}
                />
                <span
                  className="text-5xl font-bold tabular-nums leading-none"
                  style={{ color: healthColor }}
                >
                  {healthScore}
                </span>
                <span className="text-xs text-slate-400 font-semibold mt-1">
                  Health Score
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider font-bold mt-0.5"
                  style={{ color: healthColor }}
                >
                  {healthLabel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
