"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import { useAuth } from "@/lib/auth-context"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const CHAT_BUCKET = "chat-adjuntos"
const MAX_ADJUNTO_BYTES = 50 * 1024 * 1024 // 50 MB por archivo

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DirectorioUsuario {
  email: string
  nombre: string | null
  cargo: string | null
  area: string | null
  foto_url: string | null
}

export interface Participante {
  usuario_email: string
  rol: string
  joined_at: string | null
  left_at: string | null
  last_read_at: string | null
  last_delivered_at: string | null
}

export interface Conversacion {
  id: string
  tipo: string // 'directa' | 'grupo'
  nombre: string | null
  descripcion: string | null
  foto_url: string | null
  creado_por: string | null
  updated_at: string
  participantes: Participante[]
  ultimoMensaje: string | null
  ultimoMensajeAt: string | null
  noLeidos: number
}

export interface Adjunto {
  id: string
  mensaje_id: string
  conversacion_id: string | null
  url: string
  nombre: string | null
  tamano: number | null
  mime: string | null
  es_imagen: boolean
  created_at?: string
}

export interface Mensaje {
  id: string
  conversacion_id: string
  remitente_email: string
  contenido: string | null
  tipo: string // texto | imagen | archivo | tarea | referencia | evento
  reply_to: string | null
  referencia_tipo: string | null
  referencia_valor: string | null
  created_at: string
  adjuntos?: Adjunto[]
}

export interface ChatNotificacion {
  id: string
  conversacionId: string
  titulo: string
  texto: string
  timestamp: number
  vista?: "comunicaciones" | "com-noticias"
}

export interface Tarea {
  id: string
  consecutivo: number
  conversacion_id: string | null
  mensaje_origen_id: string | null
  titulo: string
  descripcion: string | null
  prioridad: string
  tipo_entregable: string // archivo | texto | imagen | confirmacion
  fecha_entrega: string | null
  creado_por: string | null
  created_at: string
}

export interface TareaResponsable {
  id: string
  tarea_id: string
  usuario_email: string
  estado: string // pendiente | en_proceso | entregada | aceptada | devuelta | vencida
  entregable_texto: string | null
  entregable_url: string | null
  entregable_nombre: string | null
  fecha_entregable: string | null
  observaciones: string | null
  updated_at: string | null
}

export interface TareaEvento {
  id: string
  tarea_id: string
  responsable_email: string | null
  tipo: string
  detalle: string | null
  usuario: string | null
  created_at: string
}

export interface CrearTareaInput {
  conversacionId: string
  mensajeOrigenId?: string | null
  titulo: string
  descripcion?: string
  prioridad?: string
  tipoEntregable?: string
  fechaEntrega?: string | null
  responsables: string[]
}

export interface NoticiaAdjunto {
  id: string
  noticia_id: string
  url: string
  nombre: string | null
  tamano: number | null
  mime: string | null
  es_imagen: boolean
}
export interface NoticiaSegmento {
  tipo: string // org | area | grupo
  valor: string | null
}
export interface Noticia {
  id: string
  titulo: string
  cuerpo: string | null
  categoria: string | null
  autor: string | null
  destacada: boolean
  obligatoria: boolean
  reacciones_habilitadas: boolean
  comentarios_habilitados: boolean
  publicar_at: string
  vigencia_hasta: string | null
  created_at: string
  segmentos: NoticiaSegmento[]
  adjuntos: NoticiaAdjunto[]
  confirmada: boolean
  miReaccion: string | null
  reacciones: Record<string, number>
  comentariosCount: number
}
export interface NoticiaComentario {
  id: string
  usuario_email: string | null
  texto: string | null
  created_at: string
}
export interface PublicarNoticiaInput {
  titulo: string
  cuerpo: string
  categoria: string
  destacada: boolean
  obligatoria: boolean
  reaccionesHabilitadas: boolean
  comentariosHabilitados: boolean
  publicarAt?: string | null
  vigenciaHasta?: string | null
  segmentos: { tipo: string; valor?: string | null }[]
  archivos?: File[]
}

// Fila aplanada (una por tarea × responsable) para la Vista de Tareas.
export interface TareaVistaRow {
  tareaId: string
  responsableId: string
  consecutivo: number
  titulo: string
  descripcion: string | null
  prioridad: string
  tipoEntregable: string
  fechaEntrega: string | null
  conversacionId: string | null
  creadoPor: string | null
  responsableEmail: string
  estado: string
  entregableUrl: string | null
  entregableTexto: string | null
  entregableNombre: string | null
  fechaEntregable: string | null
  observaciones: string | null
}

interface ReferenciaInput {
  tipo: "pedido" | "gestion"
  valor: string
  nota?: string
}

interface ComunicacionesContextType {
  usuarios: DirectorioUsuario[]
  conversaciones: Conversacion[]
  mensajesPorConv: Record<string, Mensaje[]>
  unreadTotal: number
  isLoading: boolean
  notificaciones: ChatNotificacion[]
  dismissNotificacion: (id: string) => void
  cargarMensajes: (conversacionId: string) => Promise<void>
  enviarMensaje: (
    conversacionId: string,
    contenido: string,
    opts?: {
      tipo?: string
      reply_to?: string | null
      referencia_tipo?: string | null
      referencia_valor?: string | null
      archivos?: File[]
    }
  ) => Promise<{ success: boolean; error?: string }>
  cargarAdjuntosConversacion: (conversacionId: string) => Promise<Adjunto[]>
  marcarLeido: (conversacionId: string) => Promise<void>
  setActiva: (id: string | null) => void
  abrirConversacionDirecta: (otroEmail: string) => Promise<string | null>
  enviarReferencia: (
    otroEmail: string,
    ref: ReferenciaInput
  ) => Promise<{ success: boolean; conversacionId?: string; error?: string }>
  // Grupos (Fase 3)
  crearGrupo: (
    nombre: string,
    descripcion: string,
    participantes: string[]
  ) => Promise<string | null>
  agregarParticipantes: (
    conversacionId: string,
    emails: string[]
  ) => Promise<{ success: boolean; error?: string }>
  quitarParticipante: (
    conversacionId: string,
    email: string
  ) => Promise<{ success: boolean; error?: string }>
  renombrarGrupo: (
    conversacionId: string,
    nombre: string,
    descripcion: string
  ) => Promise<{ success: boolean; error?: string }>
  eliminarGrupo: (conversacionId: string) => Promise<{ success: boolean; error?: string }>
  salirGrupo: (conversacionId: string) => Promise<{ success: boolean; error?: string }>
  // Búsqueda global (Fase 4)
  buscarGlobal: (filtros: {
    texto?: string
    desde?: string
    hasta?: string
    tipo?: string
  }) => Promise<{ conversacionId: string; mensajes: Mensaje[] }[]>
  // Tareas (Fase 5)
  crearTarea: (
    input: CrearTareaInput
  ) => Promise<{ success: boolean; error?: string; tareaId?: string }>
  cargarTarea: (
    tareaId: string
  ) => Promise<{
    tarea: Tarea
    responsables: TareaResponsable[]
    eventos: TareaEvento[]
  } | null>
  iniciarTarea: (tareaId: string) => Promise<{ success: boolean; error?: string }>
  entregarTarea: (
    tareaId: string,
    entregable: { texto?: string; archivo?: File }
  ) => Promise<{ success: boolean; error?: string }>
  aceptarTarea: (
    tareaId: string,
    responsableEmail: string
  ) => Promise<{ success: boolean; error?: string }>
  devolverTarea: (
    tareaId: string,
    responsableEmail: string,
    observaciones: string
  ) => Promise<{ success: boolean; error?: string }>
  // Vista de tareas (Fase 6)
  cargarTareasVista: (
    todas: boolean
  ) => Promise<{
    rows: TareaVistaRow[]
    convInfo: Map<string, { tipo: string; nombre: string | null }>
  }>
  reasignarResponsable: (
    tareaId: string,
    oldEmail: string,
    newEmail: string
  ) => Promise<{ success: boolean; error?: string }>
  cambiarFechaEntrega: (
    tareaId: string,
    fecha: string
  ) => Promise<{ success: boolean; error?: string }>
  conversacionPendiente: string | null
  abrirEnChat: (conversacionId: string) => void
  limpiarPendiente: () => void
  // Noticias (Fase 7)
  noticiasPendientes: number
  cargarNoticias: (filtros?: {
    soloActivas?: boolean
    texto?: string
    categoria?: string
    desde?: string
    hasta?: string
  }) => Promise<Noticia[]>
  publicarNoticia: (
    input: PublicarNoticiaInput
  ) => Promise<{ success: boolean; error?: string; noticiaId?: string }>
  confirmarLecturaNoticia: (noticiaId: string) => Promise<{ success: boolean; error?: string }>
  reaccionarNoticia: (
    noticiaId: string,
    emoji: string
  ) => Promise<{ success: boolean; error?: string }>
  comentarNoticia: (
    noticiaId: string,
    texto: string
  ) => Promise<{ success: boolean; error?: string }>
  cargarComentariosNoticia: (noticiaId: string) => Promise<NoticiaComentario[]>
  pendientesConfirmacionNoticia: (noticiaId: string) => Promise<string[]>
  refrescar: () => Promise<void>
}

const ComunicacionesContext = createContext<ComunicacionesContextType | undefined>(
  undefined
)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ComunicacionesProvider({ children }: { children: ReactNode }) {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()

  const [usuarios, setUsuarios] = useState<DirectorioUsuario[]>([])
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [mensajesPorConv, setMensajesPorConv] = useState<Record<string, Mensaje[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [notificaciones, setNotificaciones] = useState<ChatNotificacion[]>([])
  const [conversacionPendiente, setConversacionPendiente] = useState<string | null>(null)
  const [noticiasPendientes, setNoticiasPendientes] = useState(0)
  const miArea = ((usuarioActual?.area as string | undefined) ?? "").trim()
  const areaRef = useRef(miArea)
  useEffect(() => {
    areaRef.current = miArea
  }, [miArea])
  const recalcNoticiasRef = useRef<() => void>(() => {})

  // Refs para leer estado dentro del handler de realtime sin re-suscribir.
  const emailRef = useRef(email)
  const convIdsRef = useRef<Set<string>>(new Set())
  const activaRef = useRef<string | null>(null)
  const usuariosRef = useRef<DirectorioUsuario[]>([])
  const conversacionesRef = useRef<Conversacion[]>([])
  useEffect(() => {
    emailRef.current = email
  }, [email])
  useEffect(() => {
    usuariosRef.current = usuarios
  }, [usuarios])
  useEffect(() => {
    conversacionesRef.current = conversaciones
  }, [conversaciones])

  const nombreDe = useCallback((em: string) => {
    const u = usuariosRef.current.find((x) => x.email === em)
    return u?.nombre || em
  }, [])

  // --- Cargar directorio de usuarios ---
  const cargarUsuarios = useCallback(async () => {
    const { data } = await supabase
      .schema("telas")
      .from("usuarios")
      .select("email, nombre, cargo, area, foto_url")
      .order("nombre", { ascending: true })
    setUsuarios((data ?? []) as DirectorioUsuario[])
  }, [])

  // --- Cargar mis conversaciones con metadata ---
  const cargarConversaciones = useCallback(async () => {
    if (!email) {
      setConversaciones([])
      convIdsRef.current = new Set()
      return
    }
    // 1) Conversaciones donde participo (no dejadas).
    const { data: misParts } = await supabase
      .schema("telas")
      .from("chat_participantes")
      .select("conversacion_id, last_read_at")
      .eq("usuario_email", email)
      .is("left_at", null)
    const convIds = (misParts ?? []).map((p) => p.conversacion_id as string)
    convIdsRef.current = new Set(convIds)
    if (convIds.length === 0) {
      setConversaciones([])
      return
    }
    const lastReadByConv = new Map<string, string | null>()
    for (const p of misParts ?? [])
      lastReadByConv.set(p.conversacion_id as string, p.last_read_at as string | null)

    // 2) Datos de las conversaciones + participantes + último mensaje + no leídos.
    const [{ data: convs }, { data: parts }] = await Promise.all([
      supabase
        .schema("telas")
        .from("chat_conversaciones")
        .select("*")
        .in("id", convIds),
      supabase
        .schema("telas")
        .from("chat_participantes")
        .select("*")
        .in("conversacion_id", convIds),
    ])

    const partsByConv = new Map<string, Participante[]>()
    for (const p of (parts ?? []) as Participante[] & { conversacion_id?: string }[]) {
      const cid = (p as { conversacion_id: string }).conversacion_id
      const arr = partsByConv.get(cid) ?? []
      arr.push(p as Participante)
      partsByConv.set(cid, arr)
    }

    // Último mensaje por conversación (una consulta por lote, ordenada).
    const { data: msgs } = await supabase
      .schema("telas")
      .from("chat_mensajes")
      .select("id, conversacion_id, remitente_email, contenido, tipo, created_at")
      .in("conversacion_id", convIds)
      .order("created_at", { ascending: false })
      .limit(1000)
    const ultimoByConv = new Map<string, { texto: string; at: string }>()
    const noLeidosByConv = new Map<string, number>()
    for (const m of msgs ?? []) {
      const cid = m.conversacion_id as string
      if (!ultimoByConv.has(cid)) {
        ultimoByConv.set(cid, {
          texto: resumenMensaje(m.tipo as string, m.contenido as string | null),
          at: m.created_at as string,
        })
      }
      const lr = lastReadByConv.get(cid)
      const esMio = (m.remitente_email as string)?.toLowerCase() === email
      if (!esMio && (!lr || new Date(m.created_at as string) > new Date(lr))) {
        noLeidosByConv.set(cid, (noLeidosByConv.get(cid) ?? 0) + 1)
      }
    }

    const lista: Conversacion[] = ((convs ?? []) as Conversacion[]).map((c) => {
      const ult = ultimoByConv.get(c.id)
      return {
        ...c,
        participantes: partsByConv.get(c.id) ?? [],
        ultimoMensaje: ult?.texto ?? null,
        ultimoMensajeAt: ult?.at ?? c.updated_at,
        noLeidos: noLeidosByConv.get(c.id) ?? 0,
      }
    })
    lista.sort(
      (a, b) =>
        new Date(b.ultimoMensajeAt ?? b.updated_at).getTime() -
        new Date(a.ultimoMensajeAt ?? a.updated_at).getTime()
    )
    setConversaciones(lista)
  }, [email])

  const refrescar = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([cargarUsuarios(), cargarConversaciones()])
    setIsLoading(false)
  }, [cargarUsuarios, cargarConversaciones])

  useEffect(() => {
    refrescar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // --- Realtime: nuevos mensajes + receipts de participantes ---
  useEffect(() => {
    if (!email) return
    const channel = supabase
      .channel("comunicaciones_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "telas", table: "chat_mensajes" },
        (payload) => {
          const m = payload.new as Mensaje
          const yo = emailRef.current
          if (!convIdsRef.current.has(m.conversacion_id)) {
            // Puede ser una conversación nueva conmigo → recargar lista.
            cargarConversaciones()
            return
          }
          const esMio = (m.remitente_email ?? "").toLowerCase() === yo
          // Merge en el hilo si está cargado (dedup por id).
          setMensajesPorConv((prev) => {
            const arr = prev[m.conversacion_id]
            if (!arr) return prev
            if (arr.some((x) => x.id === m.id)) return prev
            return { ...prev, [m.conversacion_id]: [...arr, m] }
          })
          // Actualizar metadata de la conversación (último mensaje + no leídos).
          const esActiva = activaRef.current === m.conversacion_id
          setConversaciones((prev) => {
            const next = prev.map((c) =>
              c.id === m.conversacion_id
                ? {
                    ...c,
                    ultimoMensaje: resumenMensaje(m.tipo, m.contenido),
                    ultimoMensajeAt: m.created_at,
                    noLeidos:
                      !esMio && !esActiva && m.tipo !== "evento"
                        ? c.noLeidos + 1
                        : esActiva
                        ? 0
                        : c.noLeidos,
                  }
                : c
            )
            next.sort(
              (a, b) =>
                new Date(b.ultimoMensajeAt ?? b.updated_at).getTime() -
                new Date(a.ultimoMensajeAt ?? a.updated_at).getTime()
            )
            return next
          })
          if (!esMio) {
            // Marcar "recibido" (last_delivered_at) para el remitente.
            void supabase
              .schema("telas")
              .from("chat_participantes")
              .update({ last_delivered_at: new Date().toISOString() })
              .eq("conversacion_id", m.conversacion_id)
              .eq("usuario_email", yo)
            if (esActiva) {
              void marcarLeidoInterno(m.conversacion_id)
            } else if (m.tipo !== "evento") {
              // Notificación in-app (los eventos de grupo no notifican).
              setNotificaciones((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  conversacionId: m.conversacion_id,
                  titulo: nombreDe(m.remitente_email),
                  texto: resumenMensaje(m.tipo, m.contenido),
                  timestamp: Date.now(),
                },
              ])
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "telas", table: "chat_participantes" },
        (payload) => {
          const p = payload.new as Participante & { conversacion_id: string }
          if (!convIdsRef.current.has(p.conversacion_id)) return
          setConversaciones((prev) =>
            prev.map((c) =>
              c.id === p.conversacion_id
                ? {
                    ...c,
                    participantes: c.participantes.map((x) =>
                      x.usuario_email === p.usuario_email ? { ...x, ...p } : x
                    ),
                  }
                : c
            )
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "telas", table: "chat_participantes" },
        (payload) => {
          const p = payload.new as { usuario_email: string }
          if ((p.usuario_email ?? "").toLowerCase() === emailRef.current) {
            cargarConversaciones()
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "telas", table: "chat_adjuntos" },
        (payload) => {
          const a = payload.new as Adjunto
          if (a.conversacion_id && !convIdsRef.current.has(a.conversacion_id)) return
          setMensajesPorConv((prev) => {
            const cid = a.conversacion_id
            if (!cid) return prev
            const arr = prev[cid]
            if (!arr) return prev
            let changed = false
            const next = arr.map((m) => {
              if (m.id !== a.mensaje_id) return m
              const yaTiene = (m.adjuntos ?? []).some((x) => x.id === a.id)
              if (yaTiene) return m
              changed = true
              return { ...m, adjuntos: [...(m.adjuntos ?? []), a] }
            })
            return changed ? { ...prev, [cid]: next } : prev
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "telas", table: "noticias" },
        (payload) => {
          const n = payload.new as {
            id: string
            titulo: string
            autor: string | null
            publicar_at: string
            vigencia_hasta: string | null
          }
          // Los segmentos se insertan justo después; esperamos un momento.
          setTimeout(async () => {
            const { data: segs } = await supabase
              .schema("telas")
              .from("noticia_segmentos")
              .select("tipo, valor")
              .eq("noticia_id", n.id)
            const now = Date.now()
            const activa =
              new Date(n.publicar_at).getTime() <= now &&
              (!n.vigencia_hasta || new Date(n.vigencia_hasta).getTime() >= now)
            if (
              activa &&
              (n.autor ?? "").toLowerCase() !== emailRef.current &&
              dirigidaAMi(n.autor, (segs ?? []) as NoticiaSegmento[])
            ) {
              setNotificaciones((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  conversacionId: "",
                  titulo: "Nueva noticia",
                  texto: n.titulo,
                  timestamp: Date.now(),
                  vista: "com-noticias",
                },
              ])
            }
            recalcNoticiasRef.current()
          }, 800)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // --- Cargar mensajes de una conversación (con sus adjuntos) ---
  const cargarMensajes = useCallback(async (conversacionId: string) => {
    // En grupos, el usuario solo ve el historial desde que ingresó (joined_at).
    const conv = conversacionesRef.current.find((c) => c.id === conversacionId)
    const miPart = conv?.participantes.find((p) => p.usuario_email === emailRef.current)
    const desde = miPart?.joined_at ?? null
    const { data } = await fetchAll<Mensaje>((from, to) => {
      let q = supabase
        .schema("telas")
        .from("chat_mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId)
      if (desde) q = q.gte("created_at", desde)
      return q.order("created_at", { ascending: true }).range(from, to)
    })
    const mensajes = (data ?? []) as Mensaje[]
    const { data: adjs } = await supabase
      .schema("telas")
      .from("chat_adjuntos")
      .select("*")
      .eq("conversacion_id", conversacionId)
      .order("created_at", { ascending: true })
    const porMensaje = new Map<string, Adjunto[]>()
    for (const a of (adjs ?? []) as Adjunto[]) {
      const arr = porMensaje.get(a.mensaje_id) ?? []
      arr.push(a)
      porMensaje.set(a.mensaje_id, arr)
    }
    for (const m of mensajes) m.adjuntos = porMensaje.get(m.id) ?? []
    setMensajesPorConv((prev) => ({ ...prev, [conversacionId]: mensajes }))
  }, [])

  // --- Todos los adjuntos de una conversación (vista consolidada) ---
  const cargarAdjuntosConversacion = useCallback(
    async (conversacionId: string): Promise<Adjunto[]> => {
      const { data } = await supabase
        .schema("telas")
        .from("chat_adjuntos")
        .select("*")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: false })
      return (data ?? []) as Adjunto[]
    },
    []
  )

  // --- Marcar leído (interno, usable desde el handler) ---
  const marcarLeidoInterno = useCallback(
    async (conversacionId: string) => {
      const yo = emailRef.current
      if (!yo) return
      const now = new Date().toISOString()
      await supabase
        .schema("telas")
        .from("chat_participantes")
        .update({ last_read_at: now, last_delivered_at: now })
        .eq("conversacion_id", conversacionId)
        .eq("usuario_email", yo)
      setConversaciones((prev) =>
        prev.map((c) => (c.id === conversacionId ? { ...c, noLeidos: 0 } : c))
      )
    },
    []
  )
  const marcarLeido = marcarLeidoInterno

  // La conversación "activa" se marca vía este setter para el handler realtime.
  const setActiva = useCallback((id: string | null) => {
    activaRef.current = id
    if (id) void marcarLeidoInterno(id)
  }, [marcarLeidoInterno])

  // --- Enviar mensaje ---
  const enviarMensaje = useCallback(
    async (
      conversacionId: string,
      contenido: string,
      opts?: {
        tipo?: string
        reply_to?: string | null
        referencia_tipo?: string | null
        referencia_valor?: string | null
        archivos?: File[]
      }
    ) => {
      const yo = emailRef.current
      if (!yo) return { success: false, error: "Sin sesión" }
      const archivos = opts?.archivos ?? []
      // El tipo se deriva de los archivos si no viene explícito.
      const tipo =
        opts?.tipo ??
        (archivos.length
          ? archivos.every((f) => f.type.startsWith("image/"))
            ? "imagen"
            : "archivo"
          : "texto")
      const { data, error } = await supabase
        .schema("telas")
        .from("chat_mensajes")
        .insert({
          conversacion_id: conversacionId,
          remitente_email: yo,
          contenido,
          tipo,
          reply_to: opts?.reply_to ?? null,
          referencia_tipo: opts?.referencia_tipo ?? null,
          referencia_valor: opts?.referencia_valor ?? null,
        })
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      const m = data as Mensaje

      // Subir adjuntos (si hay) y registrarlos.
      if (archivos.length) {
        const filas: Omit<Adjunto, "id" | "created_at">[] = []
        for (const file of archivos) {
          if (file.size > MAX_ADJUNTO_BYTES) {
            return { success: false, error: `"${file.name}" supera 50 MB` }
          }
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
          const path = `${conversacionId}/${m.id}/${Date.now()}_${safe}`
          const { error: upErr } = await supabase.storage
            .from(CHAT_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: true })
          if (upErr) return { success: false, error: upErr.message }
          const { data: pub } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
          filas.push({
            mensaje_id: m.id,
            conversacion_id: conversacionId,
            url: pub.publicUrl,
            nombre: file.name,
            tamano: file.size,
            mime: file.type,
            es_imagen: file.type.startsWith("image/"),
          })
        }
        const { data: insertados } = await supabase
          .schema("telas")
          .from("chat_adjuntos")
          .insert(filas)
          .select()
        m.adjuntos = (insertados ?? []) as Adjunto[]
      }

      // Optimista local (el realtime deduplica por id).
      setMensajesPorConv((prev) => {
        const arr = prev[conversacionId]
        if (!arr) return prev
        if (arr.some((x) => x.id === m.id)) return prev
        return { ...prev, [conversacionId]: [...arr, m] }
      })
      await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversacionId)
      setConversaciones((prev) => {
        const next = prev.map((c) =>
          c.id === conversacionId
            ? {
                ...c,
                ultimoMensaje: resumenMensaje(m.tipo, m.contenido),
                ultimoMensajeAt: m.created_at,
              }
            : c
        )
        next.sort(
          (a, b) =>
            new Date(b.ultimoMensajeAt ?? b.updated_at).getTime() -
            new Date(a.ultimoMensajeAt ?? a.updated_at).getTime()
        )
        return next
      })
      return { success: true }
    },
    []
  )

  // --- Buscar o crear conversación directa 1:1 ---
  const abrirConversacionDirecta = useCallback(
    async (otroEmail: string): Promise<string | null> => {
      const yo = emailRef.current
      const otro = (otroEmail ?? "").toLowerCase()
      if (!yo || !otro || otro === yo) return null
      // Buscar una conversación 'directa' donde ambos participen.
      const existente = conversaciones.find(
        (c) =>
          c.tipo === "directa" &&
          c.participantes.length === 2 &&
          c.participantes.some((p) => p.usuario_email === yo) &&
          c.participantes.some((p) => p.usuario_email === otro)
      )
      if (existente) return existente.id
      // Crear.
      const { data: conv, error } = await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .insert({ tipo: "directa", creado_por: yo })
        .select("id")
        .single()
      if (error || !conv) return null
      const convId = conv.id as string
      await supabase
        .schema("telas")
        .from("chat_participantes")
        .insert([
          { conversacion_id: convId, usuario_email: yo, rol: "miembro" },
          { conversacion_id: convId, usuario_email: otro, rol: "miembro" },
        ])
      await cargarConversaciones()
      return convId
    },
    [conversaciones, cargarConversaciones]
  )

  // --- Enviar una referencia (pedido/gestión) a un usuario ---
  const enviarReferencia = useCallback(
    async (otroEmail: string, ref: ReferenciaInput) => {
      const convId = await abrirConversacionDirecta(otroEmail)
      if (!convId) return { success: false, error: "No se pudo abrir la conversación" }
      const r = await enviarMensaje(convId, ref.nota ?? "", {
        tipo: "referencia",
        referencia_tipo: ref.tipo,
        referencia_valor: ref.valor,
      })
      if (!r.success) return { success: false, error: r.error }
      return { success: true, conversacionId: convId }
    },
    [abrirConversacionDirecta, enviarMensaje]
  )

  // --- Eventos de grupo (líneas de sistema) ---
  const registrarEvento = useCallback(async (conversacionId: string, texto: string) => {
    const yo = emailRef.current
    await supabase.schema("telas").from("chat_mensajes").insert({
      conversacion_id: conversacionId,
      remitente_email: yo,
      contenido: texto,
      tipo: "evento",
    })
    await supabase
      .schema("telas")
      .from("chat_conversaciones")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversacionId)
  }, [])

  // --- Crear grupo ---
  const crearGrupo = useCallback(
    async (nombre: string, descripcion: string, participantes: string[]) => {
      const yo = emailRef.current
      if (!yo || !nombre.trim()) return null
      const { data: conv, error } = await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .insert({
          tipo: "grupo",
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          creado_por: yo,
        })
        .select("id")
        .single()
      if (error || !conv) return null
      const convId = conv.id as string
      const miembros = Array.from(
        new Set([yo, ...participantes.map((e) => e.toLowerCase())])
      )
      await supabase.schema("telas").from("chat_participantes").insert(
        miembros.map((em) => ({
          conversacion_id: convId,
          usuario_email: em,
          rol: em === yo ? "admin" : "miembro",
        }))
      )
      await registrarEvento(convId, `${nombreDe(yo)} creó el grupo "${nombre.trim()}"`)
      await cargarConversaciones()
      return convId
    },
    [registrarEvento, nombreDe, cargarConversaciones]
  )

  const agregarParticipantes = useCallback(
    async (conversacionId: string, emails: string[]) => {
      const yo = emailRef.current
      const nuevos = emails.map((e) => e.toLowerCase()).filter(Boolean)
      if (!nuevos.length) return { success: true }
      const rows = nuevos.map((em) => ({
        conversacion_id: conversacionId,
        usuario_email: em,
        rol: "miembro",
        joined_at: new Date().toISOString(),
        left_at: null,
      }))
      const { error } = await supabase
        .schema("telas")
        .from("chat_participantes")
        .upsert(rows, { onConflict: "conversacion_id,usuario_email" })
      if (error) return { success: false, error: error.message }
      for (const em of nuevos)
        await registrarEvento(conversacionId, `${nombreDe(yo)} agregó a ${nombreDe(em)}`)
      await cargarConversaciones()
      return { success: true }
    },
    [registrarEvento, nombreDe, cargarConversaciones]
  )

  const quitarParticipante = useCallback(
    async (conversacionId: string, email: string) => {
      const yo = emailRef.current
      const em = email.toLowerCase()
      const { error } = await supabase
        .schema("telas")
        .from("chat_participantes")
        .update({ left_at: new Date().toISOString() })
        .eq("conversacion_id", conversacionId)
        .eq("usuario_email", em)
      if (error) return { success: false, error: error.message }
      await registrarEvento(conversacionId, `${nombreDe(yo)} retiró a ${nombreDe(em)}`)
      await cargarConversaciones()
      return { success: true }
    },
    [registrarEvento, nombreDe, cargarConversaciones]
  )

  const renombrarGrupo = useCallback(
    async (conversacionId: string, nombre: string, descripcion: string) => {
      const yo = emailRef.current
      const { error } = await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null })
        .eq("id", conversacionId)
      if (error) return { success: false, error: error.message }
      await registrarEvento(conversacionId, `${nombreDe(yo)} renombró el grupo a "${nombre.trim()}"`)
      await cargarConversaciones()
      return { success: true }
    },
    [registrarEvento, nombreDe, cargarConversaciones]
  )

  const eliminarGrupo = useCallback(
    async (conversacionId: string) => {
      const { error } = await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .delete()
        .eq("id", conversacionId)
      if (error) return { success: false, error: error.message }
      await cargarConversaciones()
      return { success: true }
    },
    [cargarConversaciones]
  )

  const salirGrupo = useCallback(
    async (conversacionId: string) => {
      const yo = emailRef.current
      await registrarEvento(conversacionId, `${nombreDe(yo)} salió del grupo`)
      const { error } = await supabase
        .schema("telas")
        .from("chat_participantes")
        .update({ left_at: new Date().toISOString() })
        .eq("conversacion_id", conversacionId)
        .eq("usuario_email", yo)
      if (error) return { success: false, error: error.message }
      await cargarConversaciones()
      return { success: true }
    },
    [registrarEvento, nombreDe, cargarConversaciones]
  )

  // --- Búsqueda global sobre todas mis conversaciones ---
  const buscarGlobal = useCallback(
    async (filtros: { texto?: string; desde?: string; hasta?: string; tipo?: string }) => {
      const convIds = Array.from(convIdsRef.current)
      if (!convIds.length) return []
      let q = supabase
        .schema("telas")
        .from("chat_mensajes")
        .select("*")
        .in("conversacion_id", convIds)
      if (filtros.texto?.trim()) q = q.ilike("contenido", `%${filtros.texto.trim()}%`)
      if (filtros.desde) q = q.gte("created_at", filtros.desde)
      if (filtros.hasta) q = q.lte("created_at", `${filtros.hasta}T23:59:59`)
      if (filtros.tipo) q = q.eq("tipo", filtros.tipo)
      else q = q.neq("tipo", "evento")
      const { data } = await q.order("created_at", { ascending: false }).limit(500)

      // Respetar joined_at por conversación (grupos).
      const joinedByConv = new Map<string, string | null>()
      for (const c of conversacionesRef.current) {
        const mp = c.participantes.find((p) => p.usuario_email === emailRef.current)
        joinedByConv.set(c.id, mp?.joined_at ?? null)
      }
      const grupos = new Map<string, Mensaje[]>()
      for (const m of (data ?? []) as Mensaje[]) {
        const jd = joinedByConv.get(m.conversacion_id)
        if (jd && new Date(m.created_at) < new Date(jd)) continue
        const arr = grupos.get(m.conversacion_id) ?? []
        arr.push(m)
        grupos.set(m.conversacion_id, arr)
      }
      return Array.from(grupos.entries()).map(([conversacionId, mensajes]) => ({
        conversacionId,
        mensajes: mensajes.reverse(),
      }))
    },
    []
  )

  // ------------------------- Tareas (Fase 5) -------------------------

  // Publica en la conversación de la tarea un aviso de cambio de estado.
  const notificarEstadoTarea = useCallback(
    async (tareaId: string, textoEstado: string) => {
      const { data: t } = await supabase
        .schema("telas")
        .from("chat_tareas")
        .select("consecutivo, titulo, conversacion_id")
        .eq("id", tareaId)
        .single()
      if (t?.conversacion_id) {
        await enviarMensaje(
          t.conversacion_id as string,
          `📌 Tarea #${t.consecutivo} “${t.titulo}”: ${textoEstado}`
        )
      }
    },
    [enviarMensaje]
  )

  const crearTarea = useCallback(
    async (input: CrearTareaInput) => {
      const yo = emailRef.current
      if (!yo || !input.titulo.trim() || input.responsables.length === 0)
        return { success: false, error: "Faltan campos obligatorios" }
      const { data: t, error } = await supabase
        .schema("telas")
        .from("chat_tareas")
        .insert({
          conversacion_id: input.conversacionId,
          mensaje_origen_id: input.mensajeOrigenId ?? null,
          titulo: input.titulo.trim(),
          descripcion: input.descripcion?.trim() || null,
          prioridad: input.prioridad || "media",
          tipo_entregable: input.tipoEntregable || "confirmacion",
          fecha_entrega: input.fechaEntrega || null,
          creado_por: yo,
        })
        .select()
        .single()
      if (error || !t) return { success: false, error: error?.message }
      const tarea = t as Tarea
      const resp = Array.from(new Set(input.responsables.map((e) => e.toLowerCase())))
      await supabase.schema("telas").from("chat_tarea_responsables").insert(
        resp.map((em) => ({ tarea_id: tarea.id, usuario_email: em, estado: "pendiente" }))
      )
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tarea.id,
        tipo: "creada",
        usuario: yo,
        detalle: `Creó la tarea #${tarea.consecutivo} “${tarea.titulo}”`,
      })
      // Publicar en la conversación (notifica a los participantes/responsables).
      await enviarMensaje(input.conversacionId, tarea.titulo, {
        tipo: "tarea",
        referencia_tipo: "tarea",
        referencia_valor: tarea.id,
      })
      return { success: true, tareaId: tarea.id }
    },
    [enviarMensaje]
  )

  const cargarTarea = useCallback(async (tareaId: string) => {
    const [{ data: t }, { data: r }, { data: e }] = await Promise.all([
      supabase.schema("telas").from("chat_tareas").select("*").eq("id", tareaId).single(),
      supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .select("*")
        .eq("tarea_id", tareaId),
      supabase
        .schema("telas")
        .from("chat_tarea_eventos")
        .select("*")
        .eq("tarea_id", tareaId)
        .order("created_at", { ascending: true }),
    ])
    if (!t) return null
    return {
      tarea: t as Tarea,
      responsables: (r ?? []) as TareaResponsable[],
      eventos: (e ?? []) as TareaEvento[],
    }
  }, [])

  const iniciarTarea = useCallback(async (tareaId: string) => {
    const yo = emailRef.current
    const { error } = await supabase
      .schema("telas")
      .from("chat_tarea_responsables")
      .update({ estado: "en_proceso", updated_at: new Date().toISOString() })
      .eq("tarea_id", tareaId)
      .eq("usuario_email", yo)
    if (error) return { success: false, error: error.message }
    await supabase.schema("telas").from("chat_tarea_eventos").insert({
      tarea_id: tareaId,
      responsable_email: yo,
      tipo: "estado",
      detalle: "Marcó la tarea en proceso",
      usuario: yo,
    })
    return { success: true }
  }, [])

  const entregarTarea = useCallback(
    async (tareaId: string, entregable: { texto?: string; archivo?: File }) => {
      const yo = emailRef.current
      let url: string | null = null
      let nombre: string | null = null
      const texto = entregable.texto?.trim() || null
      if (entregable.archivo) {
        const file = entregable.archivo
        if (file.size > MAX_ADJUNTO_BYTES)
          return { success: false, error: "El archivo supera 50 MB" }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `tareas/${tareaId}/${yo}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from(CHAT_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: true })
        if (upErr) return { success: false, error: upErr.message }
        const { data: pub } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
        url = pub.publicUrl
        nombre = file.name
      }
      const { error } = await supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .update({
          estado: "entregada",
          entregable_texto: texto,
          entregable_url: url,
          entregable_nombre: nombre,
          fecha_entregable: new Date().toISOString(),
          observaciones: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tarea_id", tareaId)
        .eq("usuario_email", yo)
      if (error) return { success: false, error: error.message }
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tareaId,
        responsable_email: yo,
        tipo: "entregable",
        detalle: nombre ? `Cargó el entregable: ${nombre}` : "Cargó el entregable",
        usuario: yo,
      })
      await notificarEstadoTarea(tareaId, `entregada por ${nombreDe(yo)}`)
      return { success: true }
    },
    [notificarEstadoTarea, nombreDe]
  )

  const aceptarTarea = useCallback(
    async (tareaId: string, responsableEmail: string) => {
      const yo = emailRef.current
      const { error } = await supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .update({ estado: "aceptada", updated_at: new Date().toISOString() })
        .eq("tarea_id", tareaId)
        .eq("usuario_email", responsableEmail)
      if (error) return { success: false, error: error.message }
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tareaId,
        responsable_email: responsableEmail,
        tipo: "estado",
        detalle: `Aceptó el entregable de ${nombreDe(responsableEmail)}`,
        usuario: yo,
      })
      await notificarEstadoTarea(tareaId, `aceptada (${nombreDe(responsableEmail)})`)
      return { success: true }
    },
    [notificarEstadoTarea, nombreDe]
  )

  const devolverTarea = useCallback(
    async (tareaId: string, responsableEmail: string, observaciones: string) => {
      const yo = emailRef.current
      const { error } = await supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .update({
          estado: "devuelta",
          observaciones: observaciones.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tarea_id", tareaId)
        .eq("usuario_email", responsableEmail)
      if (error) return { success: false, error: error.message }
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tareaId,
        responsable_email: responsableEmail,
        tipo: "observacion",
        detalle: observaciones.trim() || "Devuelta con observaciones",
        usuario: yo,
      })
      await notificarEstadoTarea(tareaId, `devuelta con observaciones (${nombreDe(responsableEmail)})`)
      return { success: true }
    },
    [notificarEstadoTarea, nombreDe]
  )

  // --- Vista de tareas (Fase 6) ---
  const cargarTareasVista = useCallback(async (todas: boolean) => {
    const yo = emailRef.current
    let tareas: Tarea[] = []
    if (todas) {
      const { data } = await fetchAll<Tarea>((from, to) =>
        supabase.schema("telas").from("chat_tareas").select("*").range(from, to)
      )
      tareas = (data ?? []) as Tarea[]
    } else {
      const { data: creadas } = await supabase
        .schema("telas")
        .from("chat_tareas")
        .select("*")
        .eq("creado_por", yo)
      const { data: misResp } = await supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .select("tarea_id")
        .eq("usuario_email", yo)
      const ids = Array.from(
        new Set([
          ...((creadas ?? []) as Tarea[]).map((t) => t.id),
          ...((misResp ?? []) as { tarea_id: string }[]).map((r) => r.tarea_id),
        ])
      )
      if (ids.length) {
        const { data } = await supabase
          .schema("telas")
          .from("chat_tareas")
          .select("*")
          .in("id", ids)
        tareas = (data ?? []) as Tarea[]
      }
    }
    if (!tareas.length)
      return { rows: [] as TareaVistaRow[], convInfo: new Map<string, { tipo: string; nombre: string | null }>() }

    const tareaIds = tareas.map((t) => t.id)
    const { data: resp } = await supabase
      .schema("telas")
      .from("chat_tarea_responsables")
      .select("*")
      .in("tarea_id", tareaIds)
    const tareaById = new Map(tareas.map((t) => [t.id, t]))
    const rows: TareaVistaRow[] = []
    for (const r of (resp ?? []) as TareaResponsable[]) {
      const t = tareaById.get(r.tarea_id)
      if (!t) continue
      if (!todas && !(r.usuario_email === yo || t.creado_por?.toLowerCase() === yo)) continue
      rows.push({
        tareaId: t.id,
        responsableId: r.id,
        consecutivo: t.consecutivo,
        titulo: t.titulo,
        descripcion: t.descripcion,
        prioridad: t.prioridad,
        tipoEntregable: t.tipo_entregable,
        fechaEntrega: t.fecha_entrega,
        conversacionId: t.conversacion_id,
        creadoPor: t.creado_por,
        responsableEmail: r.usuario_email,
        estado: r.estado,
        entregableUrl: r.entregable_url,
        entregableTexto: r.entregable_texto,
        entregableNombre: r.entregable_nombre,
        fechaEntregable: r.fecha_entregable,
        observaciones: r.observaciones,
      })
    }
    const convIds = Array.from(
      new Set(tareas.map((t) => t.conversacion_id).filter(Boolean))
    ) as string[]
    const convInfo = new Map<string, { tipo: string; nombre: string | null }>()
    if (convIds.length) {
      const { data: convs } = await supabase
        .schema("telas")
        .from("chat_conversaciones")
        .select("id, tipo, nombre")
        .in("id", convIds)
      for (const c of (convs ?? []) as { id: string; tipo: string; nombre: string | null }[])
        convInfo.set(c.id, { tipo: c.tipo, nombre: c.nombre })
    }
    return { rows, convInfo }
  }, [])

  const reasignarResponsable = useCallback(
    async (tareaId: string, oldEmail: string, newEmail: string) => {
      const yo = emailRef.current
      const { error } = await supabase
        .schema("telas")
        .from("chat_tarea_responsables")
        .update({
          usuario_email: newEmail.toLowerCase(),
          estado: "pendiente",
          entregable_texto: null,
          entregable_url: null,
          entregable_nombre: null,
          fecha_entregable: null,
          observaciones: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tarea_id", tareaId)
        .eq("usuario_email", oldEmail)
      if (error) return { success: false, error: error.message }
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tareaId,
        tipo: "estado",
        detalle: `Reasignó de ${nombreDe(oldEmail)} a ${nombreDe(newEmail)}`,
        usuario: yo,
      })
      return { success: true }
    },
    [nombreDe]
  )

  const cambiarFechaEntrega = useCallback(
    async (tareaId: string, fecha: string) => {
      const yo = emailRef.current
      const { error } = await supabase
        .schema("telas")
        .from("chat_tareas")
        .update({ fecha_entrega: fecha || null })
        .eq("id", tareaId)
      if (error) return { success: false, error: error.message }
      await supabase.schema("telas").from("chat_tarea_eventos").insert({
        tarea_id: tareaId,
        tipo: "estado",
        detalle: `Cambió la fecha de entrega a ${fecha}`,
        usuario: yo,
      })
      return { success: true }
    },
    []
  )

  const abrirEnChat = useCallback((conversacionId: string) => {
    setConversacionPendiente(conversacionId)
  }, [])
  const limpiarPendiente = useCallback(() => setConversacionPendiente(null), [])

  // ------------------------- Noticias (Fase 7) -------------------------

  const dirigidaAMi = useCallback(
    (autor: string | null, segmentos: NoticiaSegmento[]): boolean => {
      const yo = emailRef.current
      if (autor?.toLowerCase() === yo) return true
      const grupos = new Set(
        conversacionesRef.current.filter((c) => c.tipo === "grupo").map((c) => c.id)
      )
      for (const s of segmentos) {
        if (s.tipo === "org") return true
        if (
          s.tipo === "area" &&
          s.valor &&
          s.valor.trim().toLowerCase() === areaRef.current.toLowerCase()
        )
          return true
        if (s.tipo === "grupo" && s.valor && grupos.has(s.valor)) return true
      }
      return false
    },
    []
  )

  const noticiaActiva = (publicar_at: string, vigencia_hasta: string | null): boolean => {
    const now = Date.now()
    if (new Date(publicar_at).getTime() > now) return false
    if (vigencia_hasta && new Date(vigencia_hasta).getTime() < now) return false
    return true
  }

  const cargarNoticias = useCallback(
    async (filtros?: {
      soloActivas?: boolean
      texto?: string
      categoria?: string
      desde?: string
      hasta?: string
    }): Promise<Noticia[]> => {
      const yo = emailRef.current
      let q = supabase
        .schema("telas")
        .from("noticias")
        .select("*")
        .order("publicar_at", { ascending: false })
        .limit(500)
      if (filtros?.categoria) q = q.eq("categoria", filtros.categoria)
      if (filtros?.desde) q = q.gte("publicar_at", filtros.desde)
      if (filtros?.hasta) q = q.lte("publicar_at", `${filtros.hasta}T23:59:59`)
      const { data } = await q
      const base = (data ?? []) as Noticia[]
      if (!base.length) return []
      const ids = base.map((n) => n.id)
      const [segsR, adjsR, lectR, reacR, comR] = await Promise.all([
        supabase.schema("telas").from("noticia_segmentos").select("*").in("noticia_id", ids),
        supabase.schema("telas").from("noticia_adjuntos").select("*").in("noticia_id", ids),
        supabase
          .schema("telas")
          .from("noticia_lecturas")
          .select("noticia_id")
          .eq("usuario_email", yo)
          .in("noticia_id", ids),
        supabase
          .schema("telas")
          .from("noticia_reacciones")
          .select("noticia_id, usuario_email, emoji")
          .in("noticia_id", ids),
        supabase.schema("telas").from("noticia_comentarios").select("noticia_id").in("noticia_id", ids),
      ])
      const segByN = new Map<string, NoticiaSegmento[]>()
      for (const s of (segsR.data ?? []) as (NoticiaSegmento & { noticia_id: string })[]) {
        const arr = segByN.get(s.noticia_id) ?? []
        arr.push({ tipo: s.tipo, valor: s.valor })
        segByN.set(s.noticia_id, arr)
      }
      const adjByN = new Map<string, NoticiaAdjunto[]>()
      for (const a of (adjsR.data ?? []) as NoticiaAdjunto[]) {
        const arr = adjByN.get(a.noticia_id) ?? []
        arr.push(a)
        adjByN.set(a.noticia_id, arr)
      }
      const confirmadas = new Set((lectR.data ?? []).map((l) => l.noticia_id as string))
      const reacByN = new Map<string, { counts: Record<string, number>; mine: string | null }>()
      for (const r of (reacR.data ?? []) as { noticia_id: string; usuario_email: string; emoji: string }[]) {
        const e = reacByN.get(r.noticia_id) ?? { counts: {}, mine: null }
        e.counts[r.emoji] = (e.counts[r.emoji] ?? 0) + 1
        if (r.usuario_email === yo) e.mine = r.emoji
        reacByN.set(r.noticia_id, e)
      }
      const comCount = new Map<string, number>()
      for (const c of (comR.data ?? []) as { noticia_id: string }[])
        comCount.set(c.noticia_id, (comCount.get(c.noticia_id) ?? 0) + 1)

      const tx = filtros?.texto?.trim().toLowerCase()
      const out: Noticia[] = []
      for (const n of base) {
        const segmentos = segByN.get(n.id) ?? []
        if (!dirigidaAMi(n.autor, segmentos)) continue
        if (filtros?.soloActivas && !noticiaActiva(n.publicar_at, n.vigencia_hasta)) continue
        if (tx && !(`${n.titulo} ${n.cuerpo ?? ""}`.toLowerCase().includes(tx))) continue
        const rc = reacByN.get(n.id)
        out.push({
          ...n,
          segmentos,
          adjuntos: adjByN.get(n.id) ?? [],
          confirmada: confirmadas.has(n.id),
          miReaccion: rc?.mine ?? null,
          reacciones: rc?.counts ?? {},
          comentariosCount: comCount.get(n.id) ?? 0,
        })
      }
      // Destacadas primero, luego por publicar_at desc.
      out.sort((a, b) => {
        if (a.destacada !== b.destacada) return a.destacada ? -1 : 1
        return new Date(b.publicar_at).getTime() - new Date(a.publicar_at).getTime()
      })
      return out
    },
    [dirigidaAMi]
  )

  const publicarNoticia = useCallback(async (input: PublicarNoticiaInput) => {
    const yo = emailRef.current
    if (!yo || !input.titulo.trim()) return { success: false, error: "El título es obligatorio" }
    const { data: n, error } = await supabase
      .schema("telas")
      .from("noticias")
      .insert({
        titulo: input.titulo.trim(),
        cuerpo: input.cuerpo?.trim() || null,
        categoria: input.categoria || null,
        autor: yo,
        destacada: input.destacada,
        obligatoria: input.obligatoria,
        reacciones_habilitadas: input.reaccionesHabilitadas,
        comentarios_habilitados: input.comentariosHabilitados,
        publicar_at: input.publicarAt || new Date().toISOString(),
        vigencia_hasta: input.vigenciaHasta || null,
      })
      .select()
      .single()
    if (error || !n) return { success: false, error: error?.message }
    const noticiaId = n.id as string
    if (input.segmentos.length)
      await supabase.schema("telas").from("noticia_segmentos").insert(
        input.segmentos.map((s) => ({ noticia_id: noticiaId, tipo: s.tipo, valor: s.valor ?? null }))
      )
    if (input.archivos?.length) {
      const filas: Omit<NoticiaAdjunto, "id">[] = []
      for (const file of input.archivos) {
        if (file.size > MAX_ADJUNTO_BYTES) return { success: false, error: `"${file.name}" supera 50 MB` }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `noticias/${noticiaId}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from(CHAT_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: true })
        if (upErr) return { success: false, error: upErr.message }
        const { data: pub } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
        filas.push({
          noticia_id: noticiaId,
          url: pub.publicUrl,
          nombre: file.name,
          tamano: file.size,
          mime: file.type,
          es_imagen: file.type.startsWith("image/"),
        })
      }
      await supabase.schema("telas").from("noticia_adjuntos").insert(filas)
    }
    return { success: true, noticiaId }
  }, [])

  const confirmarLecturaNoticia = useCallback(async (noticiaId: string) => {
    const yo = emailRef.current
    const { error } = await supabase
      .schema("telas")
      .from("noticia_lecturas")
      .upsert(
        { noticia_id: noticiaId, usuario_email: yo, confirmada_at: new Date().toISOString() },
        { onConflict: "noticia_id,usuario_email", ignoreDuplicates: true }
      )
    if (error) return { success: false, error: error.message }
    recalcNoticiasRef.current()
    return { success: true }
  }, [])

  const reaccionarNoticia = useCallback(async (noticiaId: string, emoji: string) => {
    const yo = emailRef.current
    const { data: mine } = await supabase
      .schema("telas")
      .from("noticia_reacciones")
      .select("emoji")
      .eq("noticia_id", noticiaId)
      .eq("usuario_email", yo)
      .maybeSingle()
    if (mine?.emoji === emoji) {
      await supabase
        .schema("telas")
        .from("noticia_reacciones")
        .delete()
        .eq("noticia_id", noticiaId)
        .eq("usuario_email", yo)
    } else {
      await supabase
        .schema("telas")
        .from("noticia_reacciones")
        .upsert(
          { noticia_id: noticiaId, usuario_email: yo, emoji },
          { onConflict: "noticia_id,usuario_email" }
        )
    }
    return { success: true }
  }, [])

  const comentarNoticia = useCallback(async (noticiaId: string, texto: string) => {
    const yo = emailRef.current
    if (!texto.trim()) return { success: false, error: "Comentario vacío" }
    const { error } = await supabase
      .schema("telas")
      .from("noticia_comentarios")
      .insert({ noticia_id: noticiaId, usuario_email: yo, texto: texto.trim() })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }, [])

  const cargarComentariosNoticia = useCallback(async (noticiaId: string) => {
    const { data } = await supabase
      .schema("telas")
      .from("noticia_comentarios")
      .select("id, usuario_email, texto, created_at")
      .eq("noticia_id", noticiaId)
      .order("created_at", { ascending: true })
    return (data ?? []) as NoticiaComentario[]
  }, [])

  const pendientesConfirmacionNoticia = useCallback(async (noticiaId: string) => {
    const [{ data: segs }, { data: lect }] = await Promise.all([
      supabase.schema("telas").from("noticia_segmentos").select("tipo, valor").eq("noticia_id", noticiaId),
      supabase.schema("telas").from("noticia_lecturas").select("usuario_email").eq("noticia_id", noticiaId),
    ])
    const aud = new Set<string>()
    const gruposIds: string[] = []
    for (const s of (segs ?? []) as NoticiaSegmento[]) {
      const tipo = String(s.tipo)
      const valor = s.valor
      if (tipo === "org") {
        for (const u of usuariosRef.current) aud.add(u.email)
      } else if (tipo === "area" && valor) {
        for (const u of usuariosRef.current)
          if ((u.area ?? "").trim().toLowerCase() === valor.trim().toLowerCase())
            aud.add(u.email)
      } else if (tipo === "grupo" && valor) {
        gruposIds.push(valor)
      }
    }
    if (gruposIds.length) {
      const { data: parts } = await supabase
        .schema("telas")
        .from("chat_participantes")
        .select("usuario_email")
        .in("conversacion_id", gruposIds)
        .is("left_at", null)
      for (const p of (parts ?? []) as { usuario_email: string }[]) aud.add(p.usuario_email)
    }
    const confirmados = new Set((lect ?? []).map((l) => (l.usuario_email as string)))
    return Array.from(aud)
      .filter((em) => !confirmados.has(em))
      .sort()
  }, [])

  const recargarNoticiasPendientes = useCallback(async () => {
    const yo = emailRef.current
    if (!yo) {
      setNoticiasPendientes(0)
      return
    }
    const { data } = await supabase
      .schema("telas")
      .from("noticias")
      .select("id, autor, publicar_at, vigencia_hasta")
      .eq("obligatoria", true)
      .lte("publicar_at", new Date().toISOString())
      .limit(500)
    const activas = ((data ?? []) as {
      id: string
      autor: string | null
      publicar_at: string
      vigencia_hasta: string | null
    }[]).filter((n) => !n.vigencia_hasta || new Date(n.vigencia_hasta).getTime() >= Date.now())
    if (!activas.length) {
      setNoticiasPendientes(0)
      return
    }
    const ids = activas.map((n) => n.id)
    const [{ data: segs }, { data: lect }] = await Promise.all([
      supabase.schema("telas").from("noticia_segmentos").select("noticia_id, tipo, valor").in("noticia_id", ids),
      supabase
        .schema("telas")
        .from("noticia_lecturas")
        .select("noticia_id")
        .eq("usuario_email", yo)
        .in("noticia_id", ids),
    ])
    const segByN = new Map<string, NoticiaSegmento[]>()
    for (const s of (segs ?? []) as (NoticiaSegmento & { noticia_id: string })[]) {
      const arr = segByN.get(s.noticia_id) ?? []
      arr.push({ tipo: s.tipo, valor: s.valor })
      segByN.set(s.noticia_id, arr)
    }
    const confirmadas = new Set((lect ?? []).map((l) => l.noticia_id as string))
    const pend = activas.filter(
      (n) => dirigidaAMi(n.autor, segByN.get(n.id) ?? []) && !confirmadas.has(n.id)
    )
    setNoticiasPendientes(pend.length)
  }, [dirigidaAMi])

  useEffect(() => {
    recalcNoticiasRef.current = recargarNoticiasPendientes
  }, [recargarNoticiasPendientes])
  useEffect(() => {
    if (email) void recargarNoticiasPendientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const dismissNotificacion = useCallback((id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const unreadTotal = conversaciones.reduce((acc, c) => acc + c.noLeidos, 0)

  return (
    <ComunicacionesContext.Provider
      value={{
        usuarios,
        conversaciones,
        mensajesPorConv,
        unreadTotal,
        isLoading,
        notificaciones,
        dismissNotificacion,
        cargarMensajes,
        cargarAdjuntosConversacion,
        enviarMensaje,
        marcarLeido,
        setActiva,
        abrirConversacionDirecta,
        enviarReferencia,
        crearGrupo,
        agregarParticipantes,
        quitarParticipante,
        renombrarGrupo,
        eliminarGrupo,
        salirGrupo,
        buscarGlobal,
        crearTarea,
        cargarTarea,
        iniciarTarea,
        entregarTarea,
        aceptarTarea,
        devolverTarea,
        cargarTareasVista,
        reasignarResponsable,
        cambiarFechaEntrega,
        conversacionPendiente,
        abrirEnChat,
        limpiarPendiente,
        noticiasPendientes,
        cargarNoticias,
        publicarNoticia,
        confirmarLecturaNoticia,
        reaccionarNoticia,
        comentarNoticia,
        cargarComentariosNoticia,
        pendientesConfirmacionNoticia,
        refrescar,
      }}
    >
      {children}
    </ComunicacionesContext.Provider>
  )
}

// Resumen corto de un mensaje para la lista/preview.
function resumenMensaje(tipo: string, contenido: string | null): string {
  if (tipo === "imagen") return "📷 Imagen"
  if (tipo === "archivo") return "📎 Archivo"
  if (tipo === "referencia") return "🔗 Referencia"
  if (tipo === "tarea") return "✅ Tarea"
  if (tipo === "evento") return contenido || "Evento"
  return contenido || ""
}

export function useComunicaciones() {
  const ctx = useContext(ComunicacionesContext)
  if (!ctx) {
    throw new Error("useComunicaciones debe usarse dentro de ComunicacionesProvider")
  }
  return ctx
}
