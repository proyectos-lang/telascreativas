"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  Flame,
  Palette,
  PackageCheck,
  Printer,
  Scissors,
  Shirt,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { useDashboard } from "@/lib/dashboard-context"
import type { AreaKey } from "@/lib/dashboard-context"

interface StageMeta {
  key: AreaKey
  label: string
  short: string
  icon: LucideIcon
  accent: string // text color for icon
  ring: string // ring color when bottleneck
  bg: string // soft bg for icon chip
}

const STAGES: StageMeta[] = [
  {
    key: "diseno",
    label: "Diseno",
    short: "DIS",
    icon: Palette,
    accent: "text-amber-600",
    ring: "ring-amber-300",
    bg: "bg-amber-50",
  },
  {
    key: "corte",
    label: "Corte",
    short: "COR",
    icon: Scissors,
    accent: "text-emerald-600",
    ring: "ring-emerald-300",
    bg: "bg-emerald-50",
  },
  {
    key: "impresion",
    label: "Impresion",
    short: "IMP",
    icon: Printer,
    accent: "text-sky-600",
    ring: "ring-sky-300",
    bg: "bg-sky-50",
  },
  {
    key: "sublimacion",
    label: "Sublimacion",
    short: "SUB",
    icon: Flame,
    accent: "text-rose-600",
    ring: "ring-rose-300",
    bg: "bg-rose-50",
  },
  {
    key: "costura",
    label: "Costura",
    short: "COS",
    icon: Shirt,
    accent: "text-purple-600",
    ring: "ring-purple-300",
    bg: "bg-purple-50",
  },
  {
    key: "empaque",
    label: "Empaque",
    short: "EMP",
    icon: PackageCheck,
    accent: "text-teal-600",
    ring: "ring-teal-300",
    bg: "bg-teal-50",
  },
]

export function DashboardPipeline() {
  const { workloadByArea, bottleneckKey, isLoading } = useDashboard()

  const byKey = new Map(workloadByArea.map((w) => [w.key, w]))

  return (
    <Card className="bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Workflow className="size-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Flujo de la Planta</CardTitle>
              <CardDescription className="text-xs">
                Ordenes activas por cada etapa del proceso
              </CardDescription>
            </div>
          </div>
          {bottleneckKey && !isLoading && (
            <Badge className="bg-rose-600 hover:bg-rose-600 text-white border-0 shadow-sm">
              Cuello de botella:{" "}
              {STAGES.find((s) => s.key === bottleneckKey)?.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 min-w-[150px] flex-1 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {STAGES.map((stage, idx) => {
              const w = byKey.get(stage.key)
              const recibido = w?.Recibido || 0
              const pendiente = w?.Pendiente || 0
              const enEspera = w?.EnEspera || 0
              const total = recibido + pendiente + enEspera
              const isBottleneck = bottleneckKey === stage.key
              const Icon = stage.icon

              return (
                <div
                  key={stage.key}
                  className="flex items-center shrink-0"
                  style={{ minWidth: 0 }}
                >
                  <div
                    className={[
                      "relative flex flex-col gap-2 rounded-xl border p-3 w-[150px] md:w-[165px] transition-all bg-white",
                      isBottleneck
                        ? `ring-2 ${stage.ring} border-transparent shadow-md`
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
                    ].join(" ")}
                  >
                    {/* Icon + name */}
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          stage.bg,
                        ].join(" ")}
                      >
                        <Icon className={`size-4 ${stage.accent}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                          {stage.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {stage.short}
                        </p>
                      </div>
                    </div>

                    {/* Big active count */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                        {total}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        activas
                      </span>
                    </div>

                    {/* Breakdown: Recibido (azul) / Pendiente listo p/ recibir
                        (ambar, cuello de botella) / En espera (gris suave). */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                      <div
                        className="flex items-center gap-1"
                        title="Recibido: en mesa"
                      >
                        <span className="size-1.5 rounded-full bg-blue-500" />
                        <span className="text-slate-600 font-medium tabular-nums">
                          {recibido}
                        </span>
                        <span className="text-muted-foreground">recib.</span>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        title="Pendiente: listo para recibir en esta area"
                      >
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        <span className="text-slate-600 font-medium tabular-nums">
                          {pendiente}
                        </span>
                        <span className="text-muted-foreground">pend.</span>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        title="En espera: aun viene en camino"
                      >
                        <span className="size-1.5 rounded-full border border-slate-300 bg-slate-100" />
                        <span className="text-slate-600 font-medium tabular-nums">
                          {enEspera}
                        </span>
                        <span className="text-muted-foreground">esp.</span>
                      </div>
                    </div>

                    {isBottleneck && (
                      <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                        Critico
                      </span>
                    )}
                  </div>

                  {idx < STAGES.length - 1 && (
                    <ChevronRight className="size-4 text-slate-300 mx-1 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
