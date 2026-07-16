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

export interface GDNotification {
  id: string
  solicitudId: number
  numero: string
  cliente: string
  nuevoEstado: EstadoGD
  nuevoTurno: EstadoTurno
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

export function GestionDisenosProvider({ children }: { children: ReactNode }) {
  const [solicitudes, setSolicitudes] = useState<GestionDiseno[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gdNotifications, setGdNotifications] = useState<GDNotification[]>([])

  const { usuarioActual } = useAuth()
  const usuarioActualRef = useRef(usuarioActual)
  useEffect(() => { usuarioActualRef.current = usuarioActual }, [usuarioActual])

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
        setSolicitudes((data as GestionDiseno[]) || [])
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
        "postgres_changes",
        { event: "UPDATE", schema: "telas", table: "gestion_disenos" },
        (payload) => {
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

          const esVentas = !!u.gd_ventas
          const esDiseno = !!u.gd_diseno
          const esAdmin = !!u.gd_admin

          const shouldNotify =
            (esVentas && updated.estado_turno === "En Ventas") ||
            (esDiseno && updated.estado_turno === "En Diseño" && updated.disenador === u.nombre) ||
            esAdmin

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
