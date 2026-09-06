"use client"

/**
 * Aviso global para activar las notificaciones del sistema.
 *
 * Antes esto solo existía dentro de Gestión de Diseños, así que quien no
 * entraba a ese módulo nunca concedía el permiso y no recibía NINGÚN aviso
 * (chat, tareas, incidencias, cambios de estado). Vive en el shell para que
 * se ofrezca una sola vez y aplique a toda la app.
 *
 * El navegador exige un gesto del usuario para pedir el permiso: por eso hay
 * un botón y no una llamada automática al cargar.
 */

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  estaInstalada,
  pedirPermisoNotificaciones,
  reproducirTono,
  soportaNotificaciones,
} from "@/lib/notificaciones/alertas"

const DISMISS_KEY = "notif-permiso-pospuesto"
// Igual que el aviso de instalación: posponer no es rechazar para siempre.
const DISMISS_TTL = 12 * 60 * 60 * 1000 // 12 horas

export function PermisoNotificaciones() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!soportaNotificaciones()) return
    if (Notification.permission !== "default") return
    const pospuesto = localStorage.getItem(DISMISS_KEY)
    if (pospuesto && Date.now() - Number(pospuesto) < DISMISS_TTL) return
    const t = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const posponer = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  const activar = async () => {
    const permiso = await pedirPermisoNotificaciones()
    if (permiso === "granted") {
      // Confirmación audible: además de avisar, deja el AudioContext listo,
      // porque este clic es el gesto de usuario que desbloquea el audio.
      reproducirTono("mensaje")
      toast.success("Notificaciones activadas", {
        description: estaInstalada()
          ? "Recibirás aviso con sonido aunque la app esté en segundo plano."
          : "Para que lleguen con la app cerrada, instálala desde el aviso de instalación.",
      })
    } else if (permiso === "denied") {
      toast.error("Notificaciones bloqueadas", {
        description:
          "Habilítalas en la configuración del navegador → Permisos del sitio.",
      })
    }
    posponer()
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Activar notificaciones"
      className="fixed bottom-6 left-6 z-50 w-80 rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xl shadow-indigo-200/60"
    >
      <button
        type="button"
        onClick={posponer}
        aria-label="Cerrar"
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-300">
          <Bell className="size-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Activar notificaciones</p>
          <p className="text-xs text-slate-500">Con sonido y aviso en pantalla</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Te avisamos de mensajes, tareas, incidencias y de cada cambio de estado
        en Gestión de Diseños, aunque estés en otra aplicación.
      </p>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={posponer}
          className="flex-1 text-xs text-slate-600"
        >
          Ahora no
        </Button>
        <Button
          size="sm"
          onClick={activar}
          className="flex-1 gap-1.5 bg-indigo-600 text-xs font-semibold hover:bg-indigo-700"
        >
          <Bell className="size-3.5" />
          Activar
        </Button>
      </div>
    </div>
  )
}
