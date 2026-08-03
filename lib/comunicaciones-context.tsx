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
}

export interface ChatNotificacion {
  id: string
  conversacionId: string
  titulo: string
  texto: string
  timestamp: number
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
    }
  ) => Promise<{ success: boolean; error?: string }>
  marcarLeido: (conversacionId: string) => Promise<void>
  setActiva: (id: string | null) => void
  abrirConversacionDirecta: (otroEmail: string) => Promise<string | null>
  enviarReferencia: (
    otroEmail: string,
    ref: ReferenciaInput
  ) => Promise<{ success: boolean; conversacionId?: string; error?: string }>
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

  // Refs para leer estado dentro del handler de realtime sin re-suscribir.
  const emailRef = useRef(email)
  const convIdsRef = useRef<Set<string>>(new Set())
  const activaRef = useRef<string | null>(null)
  const usuariosRef = useRef<DirectorioUsuario[]>([])
  useEffect(() => {
    emailRef.current = email
  }, [email])
  useEffect(() => {
    usuariosRef.current = usuarios
  }, [usuarios])

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
                      !esMio && !esActiva ? c.noLeidos + 1 : esActiva ? 0 : c.noLeidos,
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
            } else {
              // Notificación in-app.
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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // --- Cargar mensajes de una conversación ---
  const cargarMensajes = useCallback(async (conversacionId: string) => {
    const { data } = await fetchAll<Mensaje>((from, to) =>
      supabase
        .schema("telas")
        .from("chat_mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true })
        .range(from, to)
    )
    setMensajesPorConv((prev) => ({ ...prev, [conversacionId]: (data ?? []) as Mensaje[] }))
  }, [])

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
      }
    ) => {
      const yo = emailRef.current
      if (!yo) return { success: false, error: "Sin sesión" }
      const { data, error } = await supabase
        .schema("telas")
        .from("chat_mensajes")
        .insert({
          conversacion_id: conversacionId,
          remitente_email: yo,
          contenido,
          tipo: opts?.tipo ?? "texto",
          reply_to: opts?.reply_to ?? null,
          referencia_tipo: opts?.referencia_tipo ?? null,
          referencia_valor: opts?.referencia_valor ?? null,
        })
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      // Optimista local (el realtime deduplica por id).
      const m = data as Mensaje
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
        enviarMensaje,
        marcarLeido,
        setActiva,
        abrirConversacionDirecta,
        enviarReferencia,
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
