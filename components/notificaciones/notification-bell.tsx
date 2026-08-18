"use client"

/**
 * Campana global de notificaciones (header de la app).
 *
 * Muestra el total de pendientes del usuario y, al expandirse, el detalle
 * agrupado: mensajes sin leer, tareas (vencidas / por vencer / devueltas),
 * noticias obligatorias y pendientes operativos. Incluye control de sonido
 * y solicitud de permiso para notificaciones del sistema.
 */

import { useState } from "react"
import {
  Bell,
  BellOff,
  BellRing,
  MessageSquare,
  ClipboardList,
  Newspaper,
  AlertTriangle,
  Palette,
  Volume2,
  VolumeX,
  RefreshCw,
  MonitorSmartphone,
  CheckCircle2,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  useNotificaciones,
  type AlertaItem,
  type AlertaTipo,
} from "@/lib/notificaciones/notificaciones-context"

const ICONO: Record<AlertaTipo, typeof Bell> = {
  chat: MessageSquare,
  tarea: ClipboardList,
  noticia: Newspaper,
  diseno: Palette,
  operativo: AlertTriangle,
}

const COLOR: Record<AlertaTipo, string> = {
  chat: "text-icon-cyan",
  tarea: "text-icon-green",
  noticia: "text-icon-magenta",
  diseno: "text-indigo-500",
  operativo: "text-rose-500",
}

const GRUPOS: { tipo: AlertaTipo; label: string }[] = [
  { tipo: "chat", label: "Mensajes sin leer" },
  { tipo: "tarea", label: "Tareas" },
  { tipo: "noticia", label: "Noticias" },
  { tipo: "diseno", label: "Gestión de Diseños" },
  { tipo: "operativo", label: "Pendientes operativos" },
]

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const {
    items,
    total,
    porTipo,
    silenciado,
    toggleSilencio,
    permisoEscritorio,
    solicitarPermiso,
    refrescar,
    cargandoTareas,
  } = useNotificaciones()

  const hayUrgentes = items.some((i) => i.urgente)

  const renderItem = (i: AlertaItem) => {
    const Icono = ICONO[i.tipo]
    return (
      <button
        key={i.id}
        onClick={() => {
          i.onClick?.()
          setOpen(false)
        }}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <Icono className={cn("mt-0.5 size-4 shrink-0", COLOR[i.tipo])} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{i.titulo}</p>
          <p
            className={cn(
              "truncate text-xs",
              i.urgente ? "font-medium text-rose-600" : "text-slate-500"
            )}
          >
            {i.texto}
          </p>
        </div>
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          title={
            total > 0
              ? `${total} notificación${total !== 1 ? "es" : ""} pendiente${total !== 1 ? "s" : ""}`
              : "Sin notificaciones pendientes"
          }
        >
          {total > 0 ? (
            <BellRing className={cn("size-4", hayUrgentes && "text-rose-500")} />
          ) : (
            <Bell className="size-4 text-slate-400" />
          )}
          <span className="ml-2 hidden sm:inline">Alertas</span>
          {total > 0 && (
            <span
              className={cn(
                "absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow",
                hayUrgentes ? "bg-rose-500" : "bg-indigo-500"
              )}
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] p-0">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
            <p className="text-[11px] text-slate-400">
              {total > 0
                ? `${total} pendiente${total !== 1 ? "s" : ""}`
                : "Todo al día"}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => void refrescar()}
              title="Actualizar"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw className={cn("size-4", cargandoTareas && "animate-spin")} />
            </button>
            <button
              onClick={toggleSilencio}
              title={silenciado ? "Activar sonido" : "Silenciar sonido"}
              className={cn(
                "rounded p-1.5 hover:bg-slate-100",
                silenciado ? "text-rose-500" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {silenciado ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* Permiso de notificaciones del sistema */}
        {permisoEscritorio === "default" && (
          <button
            onClick={() => void solicitarPermiso()}
            className="flex w-full items-center gap-2 border-b border-indigo-100 bg-indigo-50/70 px-3 py-2 text-left text-xs text-indigo-800 hover:bg-indigo-100"
          >
            <MonitorSmartphone className="size-4 shrink-0" />
            <span>
              <strong>Activar avisos de escritorio</strong> — recibe alertas aunque estés en
              otra pestaña.
            </span>
          </button>
        )}
        {permisoEscritorio === "denied" && (
          <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            Los avisos de escritorio están bloqueados en este navegador. Actívalos en la
            configuración del sitio si los quieres.
          </p>
        )}
        {silenciado && (
          <p className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            <BellOff className="size-3.5" /> Sonido silenciado
          </p>
        )}

        {/* Lista */}
        <div className="max-h-[60vh] overflow-auto p-1.5">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <p className="text-sm font-medium text-slate-600">No tienes pendientes</p>
              <p className="text-xs text-slate-400">
                Te avisaremos aquí cuando llegue algo nuevo.
              </p>
            </div>
          ) : (
            GRUPOS.map((g) => {
              const delGrupo = items.filter((i) => i.tipo === g.tipo)
              if (delGrupo.length === 0) return null
              return (
                <div key={g.tipo} className="mb-1">
                  <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {g.label} ({porTipo[g.tipo]})
                  </p>
                  {delGrupo.map(renderItem)}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
