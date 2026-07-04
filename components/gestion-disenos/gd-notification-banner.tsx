"use client"

import { useEffect, useRef } from "react"
import { X, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGD, GDNotification } from "@/lib/gestion-disenos-context"
import { ESTADO_GD_COLORS, ESTADO_TURNO_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

const AUTO_DISMISS_MS = 10_000

interface GDNotificationBannerProps {
  onSelectSolicitud: (id: number) => void
}

function NotificationCard({
  notification,
  onDismiss,
  onSelect,
}: {
  notification: GDNotification
  onDismiss: () => void
  onSelect: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onDismiss])

  return (
    <div
      className="relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg min-w-[300px] max-w-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: "#6366f1" }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="absolute right-2 top-2 h-6 w-6 text-slate-400 hover:text-slate-600"
      >
        <X className="size-3.5" />
      </Button>

      <div className="flex items-center gap-2 pr-6">
        <Bell className="size-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800">Actualización de diseño</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">
          <span className="font-mono text-indigo-700">{notification.numero}</span>
          {" · "}
          {notification.cliente}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge className={cn("text-xs", ESTADO_GD_COLORS[notification.nuevoEstado])}>
            {notification.nuevoEstado}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-xs", ESTADO_TURNO_COLORS[notification.nuevoTurno])}
          >
            {notification.nuevoTurno}
          </Badge>
        </div>
      </div>

      <Button
        size="sm"
        onClick={onSelect}
        className="mt-1 h-7 bg-indigo-600 hover:bg-indigo-700 text-xs"
      >
        Ver solicitud
      </Button>
    </div>
  )
}

export function GDNotificationBanner({ onSelectSolicitud }: GDNotificationBannerProps) {
  const { gdNotifications, dismissGDNotification } = useGD()

  if (!gdNotifications.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {gdNotifications.map((n) => (
        <NotificationCard
          key={n.id}
          notification={n}
          onDismiss={() => dismissGDNotification(n.id)}
          onSelect={() => {
            onSelectSolicitud(n.solicitudId)
            dismissGDNotification(n.id)
          }}
        />
      ))}
    </div>
  )
}
