"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GD_BUCKET = "gd-archivos"

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
  autoAssignDesigner: () => Promise<string | null>
}

const GDContext = createContext<GDContextType | undefined>(undefined)

export function GestionDisenosProvider({ children }: { children: ReactNode }) {
  const [solicitudes, setSolicitudes] = useState<GestionDiseno[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSolicitudes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .schema("telas")
        .from("gestion_disenos")
        .select("*, propuestas:gestion_disenos_propuestas(*)")
        .order("fecha_creacion", { ascending: false })

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
  }, [fetchSolicitudes])

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

  const autoAssignDesigner = useCallback(async (): Promise<string | null> => {
    const [{ data: designers }, { data: actives }] = await Promise.all([
      supabase.schema("telas").from("disenadores").select("nombre").order("nombre"),
      supabase
        .schema("telas")
        .from("gestion_disenos")
        .select("disenador")
        .not("estado", "in", '("Finalizado","Rechazado")'),
    ])

    if (!designers?.length) return null

    const counts: Record<string, number> = {}
    designers.forEach((d: { nombre: string }) => {
      counts[d.nombre] = 0
    })
    actives?.forEach((a: { disenador: string | null }) => {
      if (a.disenador && counts[a.disenador] !== undefined) {
        counts[a.disenador]++
      }
    })

    return Object.entries(counts).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null
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
        autoAssignDesigner,
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
