"use client"

/**
 * Utilidades de alerta para las notificaciones de la app:
 *  - Sonido: tono sintético con Web Audio (sin archivos ni dependencias),
 *    con preferencia de silencio recordada por usuario en localStorage.
 *  - Escritorio: Notification API del navegador, para avisar cuando la
 *    pestaña NO está visible (el usuario está en otra app/pestaña).
 *
 * Todo es best-effort: si el navegador bloquea el audio (autoplay policy)
 * o las notificaciones, las funciones fallan en silencio.
 */

const STORAGE_SILENCIO = "notif_silenciado"

// ---------------------------------------------------------------------------
// Preferencia de silencio
// ---------------------------------------------------------------------------

export function estaSilenciado(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_SILENCIO) === "1"
  } catch {
    return false
  }
}

export function setSilenciado(v: boolean) {
  try {
    localStorage.setItem(STORAGE_SILENCIO, v ? "1" : "0")
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Sonido (Web Audio API)
// ---------------------------------------------------------------------------

type Ctx = AudioContext & { webkitAudioContext?: never }
let audioCtx: Ctx | null = null

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      audioCtx = new AC() as Ctx
    }
    // Los navegadores suspenden el contexto hasta que hay interacción del
    // usuario; reanudarlo aquí lo deja listo tras el primer clic en la app.
    if (audioCtx.state === "suspended") void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** Una nota simple (seno con envolvente suave para que no "chasquee"). */
function nota(ctx: Ctx, freq: number, inicio: number, dur: number, volumen: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(freq, inicio)
  gain.gain.setValueAtTime(0, inicio)
  gain.gain.linearRampToValueAtTime(volumen, inicio + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(inicio)
  osc.stop(inicio + dur + 0.02)
}

export type TonoTipo = "mensaje" | "tarea" | "urgente"

/**
 * Reproduce el tono de notificación. Respeta la preferencia de silencio.
 * `mensaje` = ding de dos notas ascendentes; `tarea` = igual pero más grave;
 * `urgente` = triple nota descendente (más notoria).
 */
export function reproducirTono(tipo: TonoTipo = "mensaje") {
  if (estaSilenciado()) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    const t = ctx.currentTime + 0.01
    const vol = 0.09
    if (tipo === "urgente") {
      nota(ctx, 880, t, 0.12, vol)
      nota(ctx, 740, t + 0.13, 0.12, vol)
      nota(ctx, 587, t + 0.26, 0.2, vol)
    } else if (tipo === "tarea") {
      nota(ctx, 523, t, 0.13, vol)
      nota(ctx, 698, t + 0.11, 0.22, vol)
    } else {
      nota(ctx, 784, t, 0.12, vol)
      nota(ctx, 1047, t + 0.1, 0.22, vol)
    }
  } catch {
    /* ignore */
  }
}

/** Prepara el contexto de audio tras la primera interacción del usuario. */
export function desbloquearAudio() {
  getCtx()
}

// ---------------------------------------------------------------------------
// Notificaciones de escritorio (Notification API)
// ---------------------------------------------------------------------------

export function soportaNotificaciones(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function permisoNotificaciones(): NotificationPermission | "unsupported" {
  if (!soportaNotificaciones()) return "unsupported"
  return Notification.permission
}

/** Pide permiso (una sola vez). Devuelve el permiso resultante. */
export async function pedirPermisoNotificaciones(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!soportaNotificaciones()) return "unsupported"
  if (Notification.permission !== "default") return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/**
 * Muestra una notificación del sistema SOLO si la pestaña no está visible
 * (si el usuario está viendo la app, ya tiene el banner y la campana).
 * Al hacer clic, enfoca la ventana y ejecuta `onClick`.
 */
export function notificarEscritorio(
  titulo: string,
  texto: string,
  opts?: { tag?: string; forzar?: boolean; onClick?: () => void }
) {
  if (!soportaNotificaciones()) return
  if (Notification.permission !== "granted") return
  if (!opts?.forzar && document.visibilityState === "visible") return
  try {
    const n = new Notification(titulo, {
      body: texto,
      // Reutiliza el logo de la app como icono.
      icon: "/images/telas-creativas-logo.png",
      tag: opts?.tag,
      silent: estaSilenciado(),
    })
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        /* ignore */
      }
      opts?.onClick?.()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

/** Sonido + notificación de escritorio en una sola llamada. */
export function alertar(
  titulo: string,
  texto: string,
  opts?: { tono?: TonoTipo; tag?: string; onClick?: () => void }
) {
  reproducirTono(opts?.tono ?? "mensaje")
  notificarEscritorio(titulo, texto, { tag: opts?.tag, onClick: opts?.onClick })
}
