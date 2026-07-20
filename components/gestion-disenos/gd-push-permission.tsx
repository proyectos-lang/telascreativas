"use client"

import { useState, useEffect } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const DISMISS_KEY = "gd-notif-dismissed"
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000 // 30 días

export function GDPushPermission() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!("Notification" in window)) return
    if (Notification.permission !== "default") return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_TTL) return

    const t = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  const handleActivate = async () => {
    if (!("Notification" in window)) return
    const perm = await Notification.requestPermission()
    if (perm === "granted") {
      toast.success("Notificaciones activadas", {
        description: "Recibirás alertas cuando cambien tus diseños, aunque el navegador esté en segundo plano.",
      })
    } else {
      toast.error("Notificaciones bloqueadas", {
        description: "Puedes habilitarlas en Configuración del navegador → Permisos.",
      })
    }
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (!visible) return null

  return (
    <div className="mb-3 flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
      <Bell className="mt-0.5 size-4 shrink-0 text-indigo-600" />
      <p className="flex-1 text-sm leading-snug text-indigo-800">
        Activa notificaciones para saber cuándo cambia el estado de tus diseños, incluso con el navegador minimizado.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          className="h-7 px-2 text-xs text-indigo-500 hover:text-indigo-700"
        >
          Ahora no
        </Button>
        <Button
          size="sm"
          onClick={handleActivate}
          className="h-7 gap-1.5 bg-indigo-600 text-xs hover:bg-indigo-700"
        >
          <Bell className="size-3" />
          Activar
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-0.5 text-indigo-400 hover:text-indigo-600"
          aria-label="Cerrar"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
