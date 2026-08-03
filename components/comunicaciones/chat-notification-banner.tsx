"use client"

import { useEffect } from "react"
import { MessageSquare, X } from "lucide-react"
import { useComunicaciones, type ChatNotificacion } from "@/lib/comunicaciones-context"
import { useAppNavigation } from "@/lib/app-navigation"

const AUTO_DISMISS_MS = 8000

function Card({
  n,
  onOpen,
  onDismiss,
}: {
  n: ChatNotificacion
  onOpen: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="flex w-72 items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <MessageSquare className="size-4 text-indigo-600" />
      </div>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-slate-800">{n.titulo}</p>
        <p className="truncate text-xs text-slate-500">{n.texto}</p>
      </button>
      <button onClick={onDismiss} className="text-slate-300 hover:text-slate-500">
        <X className="size-4" />
      </button>
    </div>
  )
}

export function ChatNotificationBanner() {
  const { notificaciones, dismissNotificacion } = useComunicaciones()
  const { navigateTo } = useAppNavigation()

  if (notificaciones.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {notificaciones.slice(-4).map((n) => (
        <Card
          key={n.id}
          n={n}
          onOpen={() => {
            navigateTo(n.vista ?? "comunicaciones")
            dismissNotificacion(n.id)
          }}
          onDismiss={() => dismissNotificacion(n.id)}
        />
      ))}
    </div>
  )
}
