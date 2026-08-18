"use client"

/**
 * Línea de tiempo de una solicitud de diseño (Control Gerencia).
 *
 * Muestra por dónde pasó la solicitud, cuánto duró cada tramo y quién la tuvo,
 * más un resumen de tiempos. Reconstruye todo desde las fechas ya guardadas
 * (ver lib/gestion-disenos-tiempos.ts); no requiere columnas nuevas.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Clock, Timer, Layers, RefreshCcw } from "lucide-react"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS } from "@/lib/gestion-disenos-types"
import {
  construirTiempos,
  formatDuracion,
  type Responsable,
} from "@/lib/gestion-disenos-tiempos"

/** Color por responsable del tramo, para leer el recorrido de un vistazo. */
const COLOR_RESP: Record<Responsable, { dot: string; text: string; bg: string }> = {
  Ventas: { dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50" },
  "Diseño": { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  Cliente: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  "—": { dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50" },
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        <Icon className="size-3" />
        {label}
      </p>
      <p className="text-lg font-bold leading-tight text-slate-800">{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

export function GDTimelineModal({
  gestion,
  open,
  onClose,
}: {
  gestion: GestionDiseno | null
  open: boolean
  onClose: () => void
}) {
  if (!gestion) return null
  const t = construirTiempos(gestion)

  const totalPorResp = (["Ventas", "Diseño", "Cliente"] as Responsable[])
    .map((r) => ({ r, ms: t.porResponsable[r] }))
    .filter((x) => x.ms > 0)
  const sumaResp = totalPorResp.reduce((a, x) => a + x.ms, 0)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Timer className="size-5 text-indigo-600" />
            <span className="font-mono">{gestion.numero}</span>
            <span className="text-slate-400">·</span>
            <span className="truncate">{gestion.cliente}</span>
            <Badge className={cn("text-xs", ESTADO_GD_COLORS[gestion.estado])}>
              {gestion.estado}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Recorrido de la solicitud y tiempo de cada tramo.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi
            icon={Clock}
            label={t.enCurso ? "En curso" : "Ciclo total"}
            value={formatDuracion(t.totalMs)}
            hint={t.enCurso ? "desde la creación" : "creación → cierre"}
          />
          <Kpi
            icon={Timer}
            label="1ª propuesta"
            value={formatDuracion(t.msHastaPrimeraPropuesta)}
            hint="desde la creación"
          />
          <Kpi
            icon={Layers}
            label="Propuestas"
            value={String(t.propuestas)}
            hint={`de 5 máximo`}
          />
          <Kpi
            icon={RefreshCcw}
            label="Ciclos de cambio"
            value={String(t.ciclosCambio)}
            hint="respuestas con cambios"
          />
        </div>

        {/* Reparto del tiempo por responsable */}
        {sumaResp > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              ¿Dónde se fue el tiempo?
            </p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {totalPorResp.map((x) => (
                <div
                  key={x.r}
                  className={COLOR_RESP[x.r].dot}
                  style={{ width: `${(x.ms / sumaResp) * 100}%` }}
                  title={`${x.r}: ${formatDuracion(x.ms)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px]">
              {totalPorResp.map((x) => (
                <span key={x.r} className="flex items-center gap-1">
                  <span className={cn("inline-block size-2 rounded-full", COLOR_RESP[x.r].dot)} />
                  <span className="text-slate-500">{x.r}</span>
                  <strong className={COLOR_RESP[x.r].text}>
                    {formatDuracion(x.ms)}
                  </strong>
                  <span className="text-slate-400">
                    ({Math.round((x.ms / sumaResp) * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Línea de tiempo */}
        <div className="max-h-[45vh] overflow-auto pr-1">
          {t.hitos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Esta solicitud aún no registra movimientos.
            </p>
          ) : (
            <ol className="space-y-0">
              {t.hitos.map((h, i) => {
                const c = COLOR_RESP[h.responsable]
                const ultimo = i === t.hitos.length - 1
                return (
                  <li key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1 size-3 shrink-0 rounded-full ring-4 ring-white",
                          c.dot
                        )}
                      />
                      {!ultimo && <span className="w-0.5 flex-1 bg-slate-200" />}
                    </div>
                    <div className={cn("flex-1 pb-4", ultimo && "pb-1")}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {h.label}
                        </p>
                        {h.detalle && (
                          <span className="text-xs text-slate-500">{h.detalle}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {format(h.fecha, "dd MMM yyyy · HH:mm", { locale: es })}
                      </p>
                      {h.desdeAnterior != null && (
                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                            c.bg,
                            c.text
                          )}
                        >
                          <Clock className="size-3" />
                          {formatDuracion(h.desdeAnterior)}
                          {h.responsable !== "—" && ` en ${h.responsable}`}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {t.enCurso && (
          <p className="rounded-md bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            La solicitud sigue activa: el tiempo total corre contra hoy y el último
            tramo aún no cierra.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
