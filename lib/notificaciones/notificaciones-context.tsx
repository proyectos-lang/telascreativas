"use client"

/**
 * Centro de notificaciones global de la app.
 *
 * Unifica en una sola lista lo que hoy vive disperso (chat, tareas, noticias,
 * reposiciones, gestión de diseños) y dispara las alertas sonoras y de
 * escritorio.
 *
 * Diseño: la campana muestra ESTADO ACTUAL, no un log de eventos. Los items se
 * derivan de los datos reales (conversaciones con no leídos, tareas vencidas,
 * noticias obligatorias sin confirmar, …), así que:
 *   - sobreviven a un refresco de página,
 *   - desaparecen solos cuando el pendiente se resuelve (leer el chat, entregar
 *     la tarea, confirmar la noticia).
 * Los eventos realtime existentes (`notificaciones` de chat y `gdNotifications`)
 * se usan solo como disparador del sonido / notificación del sistema.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/lib/auth-context"
import { useComunicaciones, type TareaVistaRow } from "@/lib/comunicaciones-context"
import { useGD } from "@/lib/gestion-disenos-context"
import { useAppNavigation } from "@/lib/app-navigation"
import { useReposicionesPendientes } from "@/lib/reposiciones-pendientes"
import {
  alertar,
  desbloquearAudio,
  estaSilenciado,
  setSilenciado as persistirSilencio,
  pedirPermisoNotificaciones,
  permisoNotificaciones,
  reproducirTono,
} from "./alertas"

export type AlertaTipo = "chat" | "tarea" | "noticia" | "operativo"

export interface AlertaItem {
  id: string
  tipo: AlertaTipo
  titulo: string
  texto: string
  /** Marca visual de prioridad (vencidas, urgentes). */
  urgente?: boolean
  /** Timestamp para ordenar (ms). */
  ts?: number
  /** Acción al hacer clic en el item. */
  onClick?: () => void
}

interface NotificacionesContextType {
  items: AlertaItem[]
  total: number
  porTipo: Record<AlertaTipo, number>
  silenciado: boolean
  toggleSilencio: () => void
  permisoEscritorio: NotificationPermission | "unsupported"
  solicitarPermiso: () => Promise<void>
  refrescar: () => Promise<void>
  cargandoTareas: boolean
}

const Ctx = createContext<NotificacionesContextType | undefined>(undefined)

/** Días de anticipación para avisar que una tarea está por vencer. */
const DIAS_POR_VENCER = 2

function hoy0(): number {
  return new Date(new Date().toDateString()).getTime()
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const t = new Date(fecha).getTime()
  if (Number.isNaN(t)) return null
  return Math.round((new Date(new Date(fecha).toDateString()).getTime() - hoy0()) / 86400000)
}

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()
  const {
    conversaciones,
    usuarios,
    notificaciones,
    noticiasPendientes,
    cargarTareasVista,
    abrirEnChat,
  } = useComunicaciones()
  const { solicitudes, gdNotifications } = useGD()
  const { navigateTo } = useAppNavigation()
  const { mapa: reposMapa } = useReposicionesPendientes()

  const [tareas, setTareas] = useState<TareaVistaRow[]>([])
  const [cargandoTareas, setCargandoTareas] = useState(false)
  const [silenciado, setSilenciadoState] = useState(false)
  const [permisoEscritorio, setPermisoEscritorio] = useState<
    NotificationPermission | "unsupported"
  >("default")

  // Refs para no re-crear efectos ni re-suscribir.
  const cargarTareasRef = useRef(cargarTareasVista)
  cargarTareasRef.current = cargarTareasVista
  const navigateRef = useRef(navigateTo)
  navigateRef.current = navigateTo
  const abrirEnChatRef = useRef(abrirEnChat)
  abrirEnChatRef.current = abrirEnChat

  useEffect(() => {
    setSilenciadoState(estaSilenciado())
    setPermisoEscritorio(permisoNotificaciones())
    // Los navegadores bloquean el audio hasta que hay un gesto del usuario:
    // preparamos el contexto en la primera interacción con la app.
    const desbloquear = () => desbloquearAudio()
    window.addEventListener("pointerdown", desbloquear, { once: true })
    window.addEventListener("keydown", desbloquear, { once: true })
    return () => {
      window.removeEventListener("pointerdown", desbloquear)
      window.removeEventListener("keydown", desbloquear)
    }
  }, [])

  const toggleSilencio = useCallback(() => {
    setSilenciadoState((prev) => {
      const next = !prev
      persistirSilencio(next)
      // Confirmación audible al reactivar el sonido.
      if (!next) setTimeout(() => reproducirTono("mensaje"), 60)
      return next
    })
  }, [])

  const solicitarPermiso = useCallback(async () => {
    const p = await pedirPermisoNotificaciones()
    setPermisoEscritorio(p)
  }, [])

  // ---------------------------------------------------------------------
  // Tareas: no hay realtime, así que se refrescan al montar y por polling.
  // ---------------------------------------------------------------------
  const refrescarTareas = useCallback(async () => {
    if (!email) return
    setCargandoTareas(true)
    try {
      const r = await cargarTareasRef.current(false)
      setTareas(r?.rows ?? [])
    } finally {
      setCargandoTareas(false)
    }
  }, [email])

  useEffect(() => {
    if (!email) return
    void refrescarTareas()
    const id = setInterval(() => void refrescarTareas(), 120_000) // 2 min
    // También al volver a la pestaña.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refrescarTareas()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [email, refrescarTareas])

  // ---------------------------------------------------------------------
  // Items derivados del estado real
  // ---------------------------------------------------------------------
  const nombreDe = useCallback(
    (em: string) => usuarios.find((u) => u.email === em)?.nombre || em,
    [usuarios]
  )

  const items = useMemo<AlertaItem[]>(() => {
    const out: AlertaItem[] = []

    // 1) Conversaciones con mensajes sin leer.
    for (const c of conversaciones) {
      if (!c.noLeidos) continue
      const otro =
        c.tipo === "grupo"
          ? c.nombre || "Grupo"
          : nombreDe(
              c.participantes.find((p) => p.usuario_email !== email)?.usuario_email ?? ""
            )
      out.push({
        id: `chat-${c.id}`,
        tipo: "chat",
        titulo: otro,
        texto:
          c.ultimoMensaje ??
          `${c.noLeidos} mensaje${c.noLeidos !== 1 ? "s" : ""} sin leer`,
        ts: c.ultimoMensajeAt ? new Date(c.ultimoMensajeAt).getTime() : undefined,
        onClick: () => {
          abrirEnChatRef.current(c.id)
          navigateRef.current("comunicaciones")
        },
      })
    }

    // 2) Tareas donde soy responsable: vencidas, vencen hoy/pronto, o nuevas.
    const mias = tareas.filter((t) => t.responsableEmail?.toLowerCase() === email)
    for (const t of mias) {
      if (t.estado === "aceptada" || t.estado === "entregada") continue
      const d = diasHasta(t.fechaEntrega)
      const vencida = d != null && d < 0
      const venceHoy = d === 0
      const porVencer = d != null && d > 0 && d <= DIAS_POR_VENCER
      const devuelta = t.estado === "devuelta"
      if (!vencida && !venceHoy && !porVencer && !devuelta) continue
      const texto = devuelta
        ? "Te devolvieron la tarea con observaciones"
        : vencida
        ? `Venció hace ${Math.abs(d!)} día${Math.abs(d!) !== 1 ? "s" : ""}`
        : venceHoy
        ? "Vence hoy"
        : `Vence en ${d} día${d !== 1 ? "s" : ""}`
      out.push({
        id: `tarea-${t.responsableId}`,
        tipo: "tarea",
        titulo: `Tarea #${t.consecutivo} — ${t.titulo}`,
        texto,
        urgente: vencida || venceHoy || devuelta,
        ts: t.fechaEntrega ? new Date(t.fechaEntrega).getTime() : undefined,
        onClick: () => navigateRef.current("com-tareas"),
      })
    }

    // 3) Noticias obligatorias sin confirmar.
    if (noticiasPendientes > 0) {
      out.push({
        id: "noticias-pendientes",
        tipo: "noticia",
        titulo: "Noticias por confirmar",
        texto: `${noticiasPendientes} noticia${
          noticiasPendientes !== 1 ? "s" : ""
        } de lectura obligatoria pendiente${noticiasPendientes !== 1 ? "s" : ""}`,
        urgente: true,
        onClick: () => navigateRef.current("com-noticias"),
      })
    }

    // 4) Operativos: reposiciones pendientes y gestiones de diseño en curso.
    const repos = reposMapa.size
    if (repos > 0) {
      out.push({
        id: "reposiciones",
        tipo: "operativo",
        titulo: "Reposiciones pendientes",
        texto: `${repos} pedido${repos !== 1 ? "s" : ""} con reposición sin confirmar`,
        urgente: true,
        onClick: () => navigateRef.current("incidencias"),
      })
    }

    const gdActivas = solicitudes.filter(
      (s) => s.estado_turno !== "Finalizado" && s.estado !== "Rechazado"
    ).length
    if (gdActivas > 0) {
      out.push({
        id: "gd-activas",
        tipo: "operativo",
        titulo: "Gestión de Diseños",
        texto: `${gdActivas} solicitud${gdActivas !== 1 ? "es" : ""} en proceso`,
        onClick: () => navigateRef.current("gestion-disenos"),
      })
    }

    // Urgentes primero, luego lo más reciente.
    return out.sort((a, b) => {
      if (!!b.urgente !== !!a.urgente) return b.urgente ? 1 : -1
      return (b.ts ?? 0) - (a.ts ?? 0)
    })
  }, [
    conversaciones,
    tareas,
    email,
    nombreDe,
    noticiasPendientes,
    reposMapa,
    solicitudes,
  ])

  const porTipo = useMemo(() => {
    const acc: Record<AlertaTipo, number> = { chat: 0, tarea: 0, noticia: 0, operativo: 0 }
    for (const i of items) acc[i.tipo]++
    return acc
  }, [items])

  // ---------------------------------------------------------------------
  // Disparadores de alerta (sonido + notificación del sistema)
  // ---------------------------------------------------------------------

  // Chat / noticias: eventos realtime del contexto de comunicaciones.
  const vistosChat = useRef<Set<string>>(new Set())
  const primeraCargaChat = useRef(true)
  useEffect(() => {
    if (primeraCargaChat.current) {
      // No sonar por lo que ya estaba al montar.
      for (const n of notificaciones) vistosChat.current.add(n.id)
      primeraCargaChat.current = false
      return
    }
    for (const n of notificaciones) {
      if (vistosChat.current.has(n.id)) continue
      vistosChat.current.add(n.id)
      alertar(n.titulo, n.texto, {
        tono: n.vista === "com-noticias" ? "tarea" : "mensaje",
        tag: n.id,
        onClick: () => {
          if (n.conversacionId) abrirEnChatRef.current(n.conversacionId)
          navigateRef.current(n.vista ?? "comunicaciones")
        },
      })
    }
  }, [notificaciones])

  // Gestión de Diseños: cambios de turno/estado.
  const vistosGD = useRef<Set<string>>(new Set())
  const primeraCargaGD = useRef(true)
  useEffect(() => {
    if (primeraCargaGD.current) {
      for (const n of gdNotifications) vistosGD.current.add(n.id)
      primeraCargaGD.current = false
      return
    }
    for (const n of gdNotifications) {
      if (vistosGD.current.has(n.id)) continue
      vistosGD.current.add(n.id)
      alertar(`Gestión ${n.numero}`, `${n.cliente} — ${n.nuevoEstado} · ${n.nuevoTurno}`, {
        tono: "tarea",
        tag: `gd-${n.numero}`,
        onClick: () => navigateRef.current("gestion-disenos"),
      })
    }
  }, [gdNotifications])

  // Tareas: al refrescar, avisa de las nuevas urgentes (vencidas / vencen hoy /
  // devueltas) que no se habían visto antes.
  const vistosTarea = useRef<Set<string>>(new Set())
  const primeraCargaTarea = useRef(true)
  useEffect(() => {
    const urgentes = items.filter((i) => i.tipo === "tarea" && i.urgente)
    if (primeraCargaTarea.current) {
      if (tareas.length === 0) return // aún sin cargar
      for (const i of urgentes) vistosTarea.current.add(i.id)
      primeraCargaTarea.current = false
      return
    }
    for (const i of urgentes) {
      if (vistosTarea.current.has(i.id)) continue
      vistosTarea.current.add(i.id)
      alertar(i.titulo, i.texto, {
        tono: "urgente",
        tag: i.id,
        onClick: () => navigateRef.current("com-tareas"),
      })
    }
  }, [items, tareas.length])

  const refrescar = useCallback(async () => {
    await refrescarTareas()
  }, [refrescarTareas])

  const value = useMemo<NotificacionesContextType>(
    () => ({
      items,
      total: items.length,
      porTipo,
      silenciado,
      toggleSilencio,
      permisoEscritorio,
      solicitarPermiso,
      refrescar,
      cargandoTareas,
    }),
    [
      items,
      porTipo,
      silenciado,
      toggleSilencio,
      permisoEscritorio,
      solicitarPermiso,
      refrescar,
      cargandoTareas,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotificaciones() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useNotificaciones debe usarse dentro de NotificacionesProvider")
  return ctx
}
