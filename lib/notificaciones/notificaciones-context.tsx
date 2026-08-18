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
 * Los eventos realtime de chat (`notificaciones`) se usan solo como disparador
 * del sonido / notificación del sistema.
 *
 * Excepción: los cambios de estado de Gestión de Diseños (`gdNotifications`)
 * SÍ se listan como items además de sonar, porque son transiciones puntuales
 * ("Pendiente Revisión → En Progreso") que no se pueden reconstruir mirando el
 * estado actual. Se acumulan por sesión y conviven con los pendientes por rol,
 * que sí son derivados y persistentes.
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
import type { GDNotification } from "@/lib/gestion-disenos-context"
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

export type AlertaTipo = "chat" | "tarea" | "noticia" | "diseno" | "operativo"

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
  const nombre = usuarioActual?.nombre ?? ""

  // Roles de Gestión de Diseños: cada uno solo recibe los pendientes de su
  // lado del flujo (Ventas no ve el turno de Diseño y viceversa).
  const esVentas = !!usuarioActual?.gd_ventas
  const esDiseno = !!usuarioActual?.gd_diseno
  const esAdminGD = !!usuarioActual?.gd_admin
  const verGD = esVentas || esDiseno || esAdminGD
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
  // Cambios de estado de GD ocurridos en esta sesión. Se acumulan aparte de
  // `gdNotifications` para que descartar el banner del módulo no los borre
  // de la campana.
  const [cambiosGD, setCambiosGD] = useState<GDNotification[]>([])
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

    // 4) Operativos: reposiciones pendientes.
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

    // 5) Gestión de Diseños.
    //    (a) Pendientes por rol, derivados del estado real: sobreviven al
    //        refresco y desaparecen cuando la solicitud cambia de turno.
    //    (b) Cambios de estado recientes, uno por evento (ver `cambiosGD`).
    if (verGD) {
      const activas = solicitudes.filter(
        (s) =>
          s.estado_turno !== "Finalizado" &&
          s.estado !== "Finalizado" &&
          s.estado !== "Rechazado"
      )
      const irAGD = () => navigateRef.current("gestion-disenos")

      if (esDiseno || esAdminGD) {
        // Sin diseñador asignado = a la espera de que Diseño las acepte.
        // Son de todo el equipo, no de una persona.
        const porAceptar = activas.filter(
          (s) =>
            s.estado_turno === "En Diseño" &&
            s.estado === "Pendiente Revision" &&
            !s.disenador
        ).length
        if (porAceptar > 0) {
          out.push({
            id: "gd-por-aceptar",
            tipo: "diseno",
            titulo: "Solicitudes por aceptar",
            texto: `${porAceptar} solicitud${
              porAceptar !== 1 ? "es" : ""
            } esperan que Diseño las tome`,
            urgente: true,
            onClick: irAGD,
          })
        }
        const mias = activas.filter(
          (s) =>
            s.estado_turno === "En Diseño" &&
            (esAdminGD ? true : s.disenador === nombre) &&
            s.estado !== "Pendiente Revision"
        ).length
        if (mias > 0) {
          out.push({
            id: "gd-turno-diseno",
            tipo: "diseno",
            titulo: esAdminGD ? "En turno de Diseño" : "En tu turno (Diseño)",
            texto: `${mias} solicitud${mias !== 1 ? "es" : ""} por trabajar`,
            urgente: !esAdminGD,
            onClick: irAGD,
          })
        }
      }

      if (esVentas || esAdminGD) {
        const propias = (s: (typeof activas)[number]) =>
          esAdminGD ? true : s.vendedora === nombre
        const enVentas = activas.filter(
          (s) => s.estado_turno === "En Ventas" && propias(s)
        ).length
        if (enVentas > 0) {
          out.push({
            id: "gd-turno-ventas",
            tipo: "diseno",
            titulo: esAdminGD ? "En turno de Ventas" : "En tu turno (Ventas)",
            texto: `${enVentas} solicitud${
              enVentas !== 1 ? "es" : ""
            } esperan respuesta de Ventas`,
            urgente: !esAdminGD,
            onClick: irAGD,
          })
        }
        const enCliente = activas.filter(
          (s) => s.estado_turno === "En Cliente" && propias(s)
        ).length
        if (enCliente > 0) {
          out.push({
            id: "gd-en-cliente",
            tipo: "diseno",
            titulo: "Esperando al cliente",
            texto: `${enCliente} propuesta${
              enCliente !== 1 ? "s" : ""
            } sin respuesta del cliente`,
            onClick: irAGD,
          })
        }
      }

      // (b) Cambios de estado ocurridos en esta sesión.
      for (const c of cambiosGD) {
        out.push({
          id: `gd-cambio-${c.id}`,
          tipo: "diseno",
          titulo: `${c.numero} — ${c.cliente}`,
          texto: c.esNueva
            ? `Nueva solicitud · ${c.nuevoEstado}`
            : `${c.estadoAnterior ?? "—"} → ${c.nuevoEstado} · ${c.nuevoTurno}`,
          ts: c.timestamp,
          onClick: irAGD,
        })
      }
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
    cambiosGD,
    verGD,
    esVentas,
    esDiseno,
    esAdminGD,
    nombre,
  ])

  const porTipo = useMemo(() => {
    const acc: Record<AlertaTipo, number> = {
      chat: 0,
      tarea: 0,
      noticia: 0,
      diseno: 0,
      operativo: 0,
    }
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

  // Gestión de Diseños: cualquier cambio de estado o de turno.
  // El evento llega ya filtrado por rol desde gestion-disenos-context.
  const vistosGD = useRef<Set<string>>(new Set())
  const primeraCargaGD = useRef(true)
  useEffect(() => {
    if (primeraCargaGD.current) {
      for (const n of gdNotifications) vistosGD.current.add(n.id)
      primeraCargaGD.current = false
      return
    }
    const nuevos = gdNotifications.filter((n) => !vistosGD.current.has(n.id))
    if (nuevos.length === 0) return
    for (const n of nuevos) {
      vistosGD.current.add(n.id)
      const detalle = n.esNueva
        ? `Nueva solicitud · ${n.nuevoEstado}`
        : `${n.estadoAnterior ?? "—"} → ${n.nuevoEstado} · ${n.nuevoTurno}`
      alertar(`${n.numero} — ${n.cliente}`, detalle, {
        tono: "tarea",
        // Tag por solicitud: si cambia dos veces seguidas, el segundo aviso
        // reemplaza al primero en vez de apilarse.
        tag: `gd-${n.numero}`,
        onClick: () => navigateRef.current("gestion-disenos"),
      })
    }
    // Los más recientes primero, con tope para no crecer sin límite.
    setCambiosGD((prev) => [...nuevos.reverse(), ...prev].slice(0, 25))
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
