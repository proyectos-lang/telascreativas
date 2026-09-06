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
  // En segundo plano el navegador suspende el AudioContext, asi que este tono
  // no suena: ahi el sonido lo pone la notificacion del sistema (ver
  // `notificarEscritorio`, que la emite sin `silent`). No se fuerza el resume
  // para no pelear con la politica de autoplay.
  if (ctx.state === "suspended") return
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

/** True si la app corre instalada (ventana propia, sin barra del navegador). */
export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Muestra una notificación del sistema.
 *
 * Se emite por el Service Worker cuando hay uno: `new Notification()` lanza
 * "Illegal constructor" en Android y no aparece de forma fiable en una PWA
 * instalada, que es justo el caso en el que más se necesita. El constructor
 * directo queda solo como respaldo para escritorio sin SW.
 *
 * Por defecto solo avisa si la pestaña NO está visible (si el usuario está
 * mirando la app ya tiene el banner y la campana). Con la app instalada eso
 * no basta: la ventana puede estar detrás de otra y seguir reportándose
 * "visible", así que ahí sí se emite siempre.
 */
export function notificarEscritorio(
  titulo: string,
  texto: string,
  opts?: { tag?: string; forzar?: boolean; onClick?: () => void }
) {
  if (!soportaNotificaciones()) return
  if (Notification.permission !== "granted") return

  const enPrimerPlano =
    document.visibilityState === "visible" && document.hasFocus()
  if (!opts?.forzar && enPrimerPlano) return

  const cuerpo: NotificationOptions & { renotify?: boolean } = {
    body: texto,
    icon: "/images/telas-creativas-logo.png",
    badge: "/icon-light-32x32.png",
    tag: opts?.tag,
    // `renotify` obliga a volver a sonar/vibrar cuando llega otro aviso con
    // el mismo tag; sin el, el segundo cambio de una misma orden es mudo.
    renotify: !!opts?.tag,
    silent: estaSilenciado(),
    vibrate: estaSilenciado() ? undefined : [80, 40, 80],
    data: { url: "/" },
  } as NotificationOptions & { renotify?: boolean }

  // Ruta principal: Service Worker.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(titulo, cuerpo))
      .catch(() => notificacionDirecta(titulo, cuerpo, opts?.onClick))
    return
  }
  notificacionDirecta(titulo, cuerpo, opts?.onClick)
}

/** Respaldo para escritorio sin Service Worker. */
function notificacionDirecta(
  titulo: string,
  cuerpo: NotificationOptions,
  onClick?: () => void
) {
  try {
    const n = new Notification(titulo, cuerpo)
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        /* ignore */
      }
      onClick?.()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sonido + notificación del sistema en una sola llamada.
 *
 * `forzar` emite la notificación aunque el usuario tenga la app al frente;
 * se usa para lo que no se puede perder (cambios de estado de Gestión de
 * Diseños). Sin él, solo avisa cuando la app está en segundo plano.
 */
export function alertar(
  titulo: string,
  texto: string,
  opts?: { tono?: TonoTipo; tag?: string; forzar?: boolean; onClick?: () => void }
) {
  reproducirTono(opts?.tono ?? "mensaje")
  notificarEscritorio(titulo, texto, {
    tag: opts?.tag,
    forzar: opts?.forzar,
    onClick: opts?.onClick,
  })
}
