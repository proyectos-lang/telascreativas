"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import type {
  GestionDiseno,
  GestionDisenoProposal,
  CatalogoSimbolo,
  EstadoGD,
  EstadoTurno,
} from "@/lib/gestion-disenos-types"
import { useAuth } from "@/lib/auth-context"
import { fetchAll } from "@/lib/fetch-all"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GD_BUCKET = "gd-archivos"
const GD_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export interface GDNotification {
  id: string
  solicitudId: number
  numero: string
  cliente: string
  nuevoEstado: EstadoGD
  nuevoTurno: EstadoTurno
  /** Estado/turno previos. `null` cuando la solicitud acaba de crearse. */
  estadoAnterior: EstadoGD | null
  turnoAnterior: EstadoTurno | null
  /** True si el evento es el alta de la solicitud. */
  esNueva: boolean
  timestamp: number
}

interface GDContextType {
  solicitudes: GestionDiseno[]
  isLoading: boolean
  error: string | null
  refreshSolicitudes: () => Promise<void>
  createSolicitud: (
    data: Omit<GestionDiseno, "id" | "numero" | "fecha_creacion" | "estado" | "estado_turno" | "total_propuestas" | "propuestas">
  ) => Promise<{ success: boolean; error?: string; id?: number }>
  updateSolicitud: (
    id: number,
    updates: Partial<GestionDiseno>
  ) => Promise<{ success: boolean; error?: string }>
  deleteSolicitud: (
    id: number
  ) => Promise<{ success: boolean; error?: string }>
  addProposal: (
    gestId: number,
    data: Partial<GestionDisenoProposal>
  ) => Promise<{ success: boolean; error?: string; proposal?: GestionDisenoProposal }>
  updateProposal: (
    propId: number,
    updates: Partial<GestionDisenoProposal>
  ) => Promise<{ success: boolean; error?: string }>
  generateClientToken: (
    propId: number
  ) => Promise<{ success: boolean; error?: string; token?: string }>
  uploadFile: (
    file: File,
    path: string
  ) => Promise<{ success: boolean; url?: string; error?: string }>
  getCatalogoSimbolos: () => Promise<CatalogoSimbolo[]>
  getNextNumero: () => Promise<string>
  gdNotifications: GDNotification[]
  dismissGDNotification: (id: string) => void
}

const GDContext = createContext<GDContextType | undefined>(undefined)

// El aviso de escritorio y el sonido los emite el centro de notificaciones
// (lib/notificaciones), que respeta la preferencia de silencio del usuario.
// Aquí solo publicamos el evento en `gdNotifications`.

export function GestionDisenosProvider({ children }: { children: ReactNode }) {
  const [solicitudes, setSolicitudes] = useState<GestionDiseno[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gdNotifications, setGdNotifications] = useState<GDNotification[]>([])

  const { usuarioActual } = useAuth()
  const usuarioActualRef = useRef(usuarioActual)
  useEffect(() => { usuarioActualRef.current = usuarioActual }, [usuarioActual])

  // Ultimo estado/turno conocido por solicitud. Permite saber si un UPDATE
  // realmente movio el estado y con que valor venia (Supabase no manda el
  // registro anterior con la replica identity por defecto).
  const estadoPrevioRef = useRef<
    Map<number, { estado: EstadoGD; turno: EstadoTurno }>
  >(new Map())

  const fetchSolicitudes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await fetchAll((from, to) =>
        supabase
          .schema("telas")
          .from("gestion_disenos")
          .select("*, propuestas:gestion_disenos_propuestas(*)")
          .order("fecha_creacion", { ascending: false })
          .range(from, to)
      )

      if (dbError) {
        setError(dbError.message)
        setSolicitudes([])
      } else {
        const rows = (data as GestionDiseno[]) || []
        setSolicitudes(rows)
        // Semilla del snapshot: la primera carga fija el "estado conocido"
        // para que no se alerte por lo que ya existia al abrir la app.
        for (const s of rows) {
          if (!estadoPrevioRef.current.has(s.id)) {
            estadoPrevioRef.current.set(s.id, {
              estado: s.estado,
              turno: s.estado_turno,
            })
          }
        }
      }
    } catch (err) {
      console.error("[GD] fetchSolicitudes error:", err)
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes")
      setSolicitudes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSolicitudes()

    const channel = supabase
      .channel("gd_state_changes")
      .on(
        // INSERT ademas de UPDATE: el alta de una solicitud tambien es un
        // cambio de estado que debe avisarse (antes solo se oia el UPDATE).
        "postgres_changes",
        { event: "*", schema: "telas", table: "gestion_disenos" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            fetchSolicitudes()
            return
          }
          fetchSolicitudes()

          const updated = payload.new as {
            id: number
            numero: string
            cliente: string
            estado: EstadoGD
            estado_turno: EstadoTurno
            disenador: string | null
          }

          const u = usuarioActualRef.current
          if (!u) return

          // `payload.old` solo trae la PK salvo que la tabla tenga REPLICA
          // IDENTITY FULL, asi que el estado previo lo sacamos del ultimo
          // snapshot conocido en memoria.
          const previo = estadoPrevioRef.current.get(updated.id)
          const esNueva = payload.eventType === "INSERT" || !previo
          const cambioEstado =
            esNueva ||
            previo!.estado !== updated.estado ||
            previo!.turno !== updated.estado_turno

          estadoPrevioRef.current.set(updated.id, {
            estado: updated.estado,
            turno: updated.estado_turno,
          })

          // Un UPDATE que no movio estado ni turno (editar un comentario,
          // subir un archivo) no es una actualizacion de estado: no alerta.
          if (!cambioEstado) return

          const esVentas = !!u.gd_ventas
          const esDiseno = !!u.gd_diseno
          const esAdmin = !!u.gd_admin

          // Diseno tambien debe enterarse de las solicitudes que llegan SIN
          // disenador asignado: son las que estan a la espera de que alguien
          // las acepte, y antes no le avisaban a nadie.
          const enDiseno = updated.estado_turno === "En Diseño"
          const esMia = updated.disenador === u.nombre
          const sinAsignar = !updated.disenador

          const shouldNotify =
            esAdmin ||
            // "En Cliente" tambien es lado Ventas: Ventas registra la respuesta.
            (esVentas &&
              (updated.estado_turno === "En Ventas" ||
                updated.estado_turno === "En Cliente")) ||
            (esDiseno && enDiseno && (esMia || sinAsignar))

          if (shouldNotify) {
            setGdNotifications((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                solicitudId: updated.id,
                numero: updated.numero,
                cliente: updated.cliente,
                nuevoEstado: updated.estado,
                nuevoTurno: updated.estado_turno,
                estadoAnterior: esNueva ? null : previo!.estado,
                turnoAnterior: esNueva ? null : previo!.turno,
                esNueva,
                timestamp: Date.now(),
              },
            ])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSolicitudes])

  const dismissGDNotification = useCallback((id: string) => {
    setGdNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const getNextNumero = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .schema("telas")
      .from("gestion_disenos")
      .select("numero")
      .order("id", { ascending: false })
      .limit(1)
      .single()

    if (!data?.numero) return "GD-0001"
    const lastNum = parseInt(data.numero.replace("GD-", ""), 10) || 0
    return `GD-${String(lastNum + 1).padStart(4, "0")}`
  }, [])

  const createSolicitud = useCallback(
    async (
      data: Omit<GestionDiseno, "id" | "numero" | "fecha_creacion" | "estado" | "estado_turno" | "total_propuestas" | "propuestas">
    ) => {
      try {
        const numero = await getNextNumero()
        const { data: created, error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos")
          .insert({ ...data, numero, estado: "Borrador", estado_turno: "En Ventas", total_propuestas: 0 })
          .select()
          .single()

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true, id: (created as GestionDiseno).id }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al crear" }
      }
    },
    [getNextNumero, fetchSolicitudes]
  )

  const updateSolicitud = useCallback(
    async (id: number, updates: Partial<GestionDiseno>) => {
      try {
        const { error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos")
          .update(updates)
          .eq("id", id)

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al actualizar" }
      }
    },
    [fetchSolicitudes]
  )

  const deleteSolicitud = useCallback(
    async (id: number) => {
      try {
        const { error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos")
          .delete()
          .eq("id", id)

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al eliminar" }
      }
    },
    [fetchSolicitudes]
  )

  const addProposal = useCallback(
    async (gestId: number, data: Partial<GestionDisenoProposal>) => {
      try {
        const { data: created, error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos_propuestas")
          .insert({ ...data, gestion_id: gestId })
          .select()
          .single()

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true, proposal: created as GestionDisenoProposal }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al agregar propuesta" }
      }
    },
    [fetchSolicitudes]
  )

  const updateProposal = useCallback(
    async (propId: number, updates: Partial<GestionDisenoProposal>) => {
      try {
        const { error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos_propuestas")
          .update(updates)
          .eq("id", propId)

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al actualizar propuesta" }
      }
    },
    [fetchSolicitudes]
  )

  const generateClientToken = useCallback(
    async (propId: number) => {
      try {
        const token = crypto.randomUUID()
        const { error: dbError } = await supabase
          .schema("telas")
          .from("gestion_disenos_propuestas")
          .update({ cliente_token: token, cliente_token_creado: new Date().toISOString(), estado: "En Cliente" })
          .eq("id", propId)

        if (dbError) return { success: false, error: dbError.message }
        await fetchSolicitudes()
        return { success: true, token }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Error al generar token" }
      }
    },
    [fetchSolicitudes]
  )

  const uploadFile = useCallback(async (file: File, path: string) => {
    try {
      // Límite central de tamaño (50 MB). Cubre también los uploads que suben
      // File crudo sin pasar por GDFileUploader (logos, diseño base manual).
      if (file.size > GD_MAX_UPLOAD_BYTES) {
        return { success: false, error: "Archivo demasiado grande. Máximo 50 MB por archivo." }
      }

      const { error: upErr } = await supabase.storage
        .from(GD_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true })

      if (upErr) return { success: false, error: upErr.message }

      const { data } = supabase.storage.from(GD_BUCKET).getPublicUrl(path)
      return { success: true, url: data.publicUrl }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Error al subir archivo" }
    }
  }, [])

  const getCatalogoSimbolos = useCallback(async (): Promise<CatalogoSimbolo[]> => {
    const { data } = await supabase
      .schema("telas")
      .from("gd_catalogo_simbolos")
      .select("*")
      .eq("activo", true)
      .order("orden")
    return (data as CatalogoSimbolo[]) || []
  }, [])

  return (
    <GDContext.Provider
      value={{
        solicitudes,
        isLoading,
        error,
        refreshSolicitudes: fetchSolicitudes,
        createSolicitud,
        updateSolicitud,
        deleteSolicitud,
        addProposal,
        updateProposal,
        generateClientToken,
        uploadFile,
        getCatalogoSimbolos,
        getNextNumero,
        gdNotifications,
        dismissGDNotification,
      }}
    >
      {children}
    </GDContext.Provider>
  )
}

export function useGD() {
  const ctx = useContext(GDContext)
  if (!ctx) throw new Error("useGD must be used within GestionDisenosProvider")
  return ctx
}
