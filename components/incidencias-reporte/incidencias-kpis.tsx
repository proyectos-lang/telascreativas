"use client"

/**
 * KPIs superiores del Reporte de Incidencias.
 *
 * Diseno: 4 tarjetas con franja izquierda de color, icono cuadrado a la
 * derecha, cifra grande tabular y subtitulo con contexto. Mismo patron
 * visual que `dashboard-kpis.tsx` para mantener coherencia entre los
 * dashboards analiticos del sistema.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertOctagon,
  CalendarClock,
  CalendarDays,
  Timer,
  type LucideIcon,
} from "lucide-react"
import { useIncidenciasReporte } from "@/lib/incidencias-reporte-context"

interface KpiCardProps {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  /** clase de Tailwind aplicada al stripe izquierdo y al cuadrado del icono */
  accentClass: string
  /** color de la cifra; si se omite usa text-foreground */
  valueClass?: string
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accentClass,
  valueClass,
}: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden border bg-white shadow-sm transition-all hover:shadow-md group">
      <div
        className={`absolute left-0 top-0 h-full w-1 ${accentClass}`}
        aria-hidden
      />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {label}
            </p>
            <p
              className={`text-lg md:text-xl font-bold tabular-nums leading-tight mt-1 break-words ${
                valueClass ?? "text-foreground"
              }`}
            >
              {value}
            </p>
          </div>
          <div
            className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${accentClass}`}
          >
            <Icon className="size-5 text-white" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground truncate">{sub}</p>
      </CardContent>
    </Card>
  )
}

/** Formatea un promedio en horas a una etiqueta humana ("3.4 h" o "1.2 d"). */
function formatHoras(horas: number | null): {
  value: string
  sub: string
} {
  if (horas == null) {
    return { value: "—", sub: "Sin datos resueltos" }
  }
  if (horas < 24) {
    return {
      value: `${horas.toFixed(1)} h`,
      sub: "Reporte → Procesado",
    }
  }
  return {
    value: `${(horas / 24).toFixed(1)} d`,
    sub: "Reporte → Procesado",
  }
}

export function IncidenciasKpis() {
  const { kpis, isLoading } = useIncidenciasReporte()

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const tiempo = formatHoras(kpis.tiempoRespuestaHoras)

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Mas reportes (origen)"
        value={kpis.topReporta?.area ?? "—"}
        sub={
          kpis.topReporta
            ? `${kpis.topReporta.count} incidencias reportadas`
            : "Sin datos en el periodo"
        }
        icon={AlertOctagon}
        accentClass="bg-rose-500"
      />
      <KpiCard
        label="Mas errores (responsable)"
        value={kpis.topGenera?.area ?? "—"}
        sub={
          kpis.topGenera
            ? `${kpis.topGenera.count} incidencias atribuidas`
            : "Sin datos en el periodo"
        }
        icon={AlertOctagon}
        accentClass="bg-amber-500"
        valueClass="text-amber-700"
      />
      <KpiCard
        label="Acumuladas"
        value={String(kpis.totalMes)}
        sub={`Mes actual · Hoy: ${kpis.totalHoy}`}
        icon={CalendarDays}
        accentClass="bg-slate-700"
      />
      <KpiCard
        label="Tiempo de respuesta"
        value={tiempo.value}
        sub={
          kpis.resueltasCount > 0
            ? `${tiempo.sub} (n=${kpis.resueltasCount})`
            : tiempo.sub
        }
        icon={kpis.tiempoRespuestaHoras == null ? CalendarClock : Timer}
        accentClass="bg-emerald-600"
      />
    </div>
  )
}
