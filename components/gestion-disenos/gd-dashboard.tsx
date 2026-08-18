"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GestionDiseno, EstadoGD } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS, ESTADO_TURNO_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { GDTimelineModal } from "./gd-timeline-modal"
import { calcularIndicadores } from "@/lib/gestion-disenos-tiempos"

const ACTIVE_ESTADOS = new Set<EstadoGD>([
  "Borrador",
  "Pendiente Revision",
  "Rechazado",
  "En Progreso",
  "Esperando Retroalimentacion",
  "Pendiente Aprobacion",
  "Aprobado",
  "Finalizando",
])

function getLastActivity(s: GestionDiseno): Date {
  const dates: Date[] = [new Date(s.fecha_creacion)]
  if (s.fecha_asignacion) dates.push(new Date(s.fecha_asignacion))
  if (s.fecha_aprobacion) dates.push(new Date(s.fecha_aprobacion))
  for (const p of s.propuestas ?? []) {
    if (p.fecha_subida) dates.push(new Date(p.fecha_subida))
    if (p.fecha_respuesta_cliente) dates.push(new Date(p.fecha_respuesta_cliente))
    if (p.fecha_respuesta_ventas) dates.push(new Date(p.fecha_respuesta_ventas))
    if (p.fecha_archivos_finales) dates.push(new Date(p.fecha_archivos_finales))
  }
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function getResponsable(s: GestionDiseno): string {
  switch (s.estado_turno) {
    case "En Ventas":
      return s.vendedora
    case "En Diseño":
      return s.disenador || "Sin asignar"
    case "En Cliente":
      return s.cliente
    default:
      return "—"
  }
}

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

interface GDDashboardProps {
  solicitudes: GestionDiseno[]
  onSelect: (s: GestionDiseno) => void
}

export function GDDashboard({ solicitudes, onSelect }: GDDashboardProps) {
  const [now, setNow] = useState(() => Date.now())
  // Solicitud cuya linea de tiempo se esta viendo.
  const [timelineDe, setTimelineDe] = useState<GestionDiseno | null>(null)

  // Indicadores de tiempos sobre TODAS las solicitudes (no solo las activas),
  // para que los promedios incluyan los ciclos ya cerrados.
  const ind = useMemo(() => calcularIndicadores(solicitudes), [solicitudes])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const rows = solicitudes
    .filter((s) => ACTIVE_ESTADOS.has(s.estado))
    .map((s) => ({ ...s, _last: getLastActivity(s) }))
    .sort((a, b) => a._last.getTime() - b._last.getTime())

  const alertCount = rows.filter((r) => now - r._last.getTime() > 24 * 60 * 60 * 1000).length

  return (
    <div className="space-y-3">
      {/* Indicadores de tiempos del proceso de diseno */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Aceptacion", v: ind.diasAceptacion, hint: "creacion -> Diseno" },
          { label: "1a propuesta", v: ind.diasPrimeraPropuesta, hint: "creacion -> envio" },
          { label: "Aprobacion", v: ind.diasAprobacion, hint: "creacion -> aprobado" },
          { label: "Ciclo total", v: ind.diasTotal, hint: "solo finalizadas" },
          { label: "Propuestas", v: ind.propuestasPromedio, hint: "promedio", unidad: "" },
          { label: "Ciclos cambio", v: ind.ciclosPromedio, hint: "promedio", unidad: "" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{k.label}</p>
            <p className="text-base font-bold leading-tight text-slate-800">
              {k.v == null ? "—" : `${k.v.toFixed(1)}${k.unidad ?? "d"}`}
            </p>
            <p className="text-[10px] text-slate-400">{k.hint}</p>
          </div>
        ))}
      </div>
      {ind.diasPorResponsable.length > 0 && (
        <p className="text-[11px] text-slate-500">
          Tiempo promedio por responsable:{" "}
          {ind.diasPorResponsable
            .map((x) => `${x.responsable} ${x.dias.toFixed(1)}d`)
            .join(" · ")}
          {" "}· sobre {ind.n} solicitud{ind.n !== 1 ? "es" : ""}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
          No hay solicitudes activas.
        </div>
      ) : (
      <>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{rows.length} solicitudes activas</span>
        {alertCount > 0 && (
          <span className="flex items-center gap-1 font-semibold text-red-600">
            <AlertTriangle className="size-3.5" />
            {alertCount} sin movimiento +24h
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 text-left font-medium">N°</th>
              <th className="px-3 py-2.5 text-left font-medium">Cliente</th>
              <th className="px-3 py-2.5 text-left font-medium">Estado</th>
              <th className="px-3 py-2.5 text-left font-medium">Turno</th>
              <th className="px-3 py-2.5 text-left font-medium">Quién lo tiene</th>
              <th className="px-3 py-2.5 text-left font-medium">Último proceso</th>
              <th className="px-3 py-2.5 text-left font-medium">Tiempo</th>
              <th className="px-3 py-2.5 text-center font-medium">⚠️</th>
              <th className="px-3 py-2.5 text-center font-medium">Tiempos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((s) => {
              const elapsed = now - s._last.getTime()
              const isAlert = elapsed > 24 * 60 * 60 * 1000
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-slate-50",
                    isAlert && "bg-red-50 hover:bg-red-100"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs font-bold text-indigo-700">{s.numero}</span>
                      {s.pedido_vinculado && (
                        <span className="inline-flex w-fit items-center rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                          {s.pedido_vinculado}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{s.cliente}</td>
                  <td className="px-3 py-2.5">
                    <Badge className={cn("text-xs", ESTADO_GD_COLORS[s.estado])}>
                      {s.estado}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", ESTADO_TURNO_COLORS[s.estado_turno])}
                    >
                      {s.estado_turno}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{getResponsable(s)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {format(s._last, "dd MMM yy HH:mm", { locale: es })}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                    {formatElapsed(elapsed)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {isAlert ? (
                      <AlertTriangle className="inline size-4 text-red-500" />
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={(e) => {
                        // No abrir el detalle: esta accion es solo la linea de tiempo.
                        e.stopPropagation()
                        setTimelineDe(s)
                      }}
                      title="Ver linea de tiempo y tiempos entre procesos"
                    >
                      <Timer className="size-3.5" />
                      Ver
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      <GDTimelineModal
        gestion={timelineDe}
        open={timelineDe !== null}
        onClose={() => setTimelineDe(null)}
      />
    </div>
  )
}
