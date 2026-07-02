"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GestionDiseno, EstadoGD } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS, ESTADO_TURNO_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const rows = solicitudes
    .filter((s) => ACTIVE_ESTADOS.has(s.estado))
    .map((s) => ({ ...s, _last: getLastActivity(s) }))
    .sort((a, b) => a._last.getTime() - b._last.getTime())

  const alertCount = rows.filter((r) => now - r._last.getTime() > 24 * 60 * 60 * 1000).length

  if (!rows.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        No hay solicitudes activas.
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-indigo-700">
                    {s.numero}
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
