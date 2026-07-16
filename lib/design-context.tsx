"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import { fetchAll } from "@/lib/fetch-all"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface DesignContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const DesignContext = createContext<DesignContextType | undefined>(undefined)

export function DesignProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch orders - sorting is applied client-side below.
      // Ya NO filtramos por solo_corte_costura en el query: cualquier
      // orden aprobada debe ser visible en Diseño independientemente de
      // ese flag. El filtro anterior ocultaba ordenes legítimas como la 1061.
      const { data, error: supabaseError } = await fetchAll((from, to) =>
        supabase.schema("telas").from("cabecera").select("*").range(from, to)
      )

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        // Hierarchical sort (top -> bottom):
        // 1. Programmed orders first (those already approved / scheduled by the planner)
        //    -> estado_aprobado_rechazado = 'Aprobado' (normalized) OR has fecha_programacion
        // 2. Within each group: urgent orders (es_urgente = true) above non-urgent
        // 3. Within each group: by target design date ascending (nulls last)
        const isProgrammed = (o: Orden) => {
          const estado = (o.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          const hasFechaProgramacion =
            o.fecha_programacion !== null &&
            o.fecha_programacion !== undefined &&
            String(o.fecha_programacion).trim() !== ""
          return estado === "aprobado" || hasFechaProgramacion
        }

        // Reglas de exclusión:
        // 1. Ordenes rechazadas por el planner no aparecen en producción.
        // 2. Diseño acepta PRODUCCION_NORMAL y YARDAJE. null/undefined
        //    se trata como normal por compatibilidad hacia atrás.
        // 3. Si solo_corte_costura = true la orden salta Diseño,
        //    Impresión y Sublimación — va directo a Corte y Costura.
        const notRejected = (data || []).filter((o) => {
          const estado = (o.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          if (estado === "rechazado" || estado === "cancelado") return false
          const flujo = (o.tipo_flujo_especial ?? "")
            .toString()
            .trim()
            .toUpperCase()
          if (flujo && flujo !== "PRODUCCION_NORMAL" && flujo !== "YARDAJE")
            return false
          if (o.solo_corte_costura === true) return false
          return true
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Programmed (approved/scheduled) orders always on top
          const aProgrammed = isProgrammed(a) ? 0 : 1
          const bProgrammed = isProgrammed(b) ? 0 : 1
          if (aProgrammed !== bProgrammed) {
            return aProgrammed - bProgrammed
          }

          // 2. Urgent orders before non-urgent within the same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By target design date ascending (nulls last)
          const aDate = a.dfecha_objetivo_d
            ? new Date(a.dfecha_objetivo_d).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.dfecha_objetivo_d
            ? new Date(b.dfecha_objetivo_d).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Design - Error al consultar:", err)
      setError(
        err instanceof Error ? err.message : "Error al cargar las ordenes de diseno"
      )
      setOrdenes([])
    } finally {
      setIsLoading(false)
    }
  }

  const updateOrden = async (
    pedido: string,
    updates: Partial<Orden>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .update(updates)
        .eq("pedido", pedido)
        .select()

      if (supabaseError) {
        return { success: false, error: supabaseError.message }
      }

      await fetchOrdenes()
      return { success: true }
    } catch (err) {
      console.error("[v0] Design - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <DesignContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </DesignContext.Provider>
  )
}

export function useDesign() {
  const context = useContext(DesignContext)
  if (!context) {
    throw new Error("useDesign must be used within a DesignProvider")
  }
  return context
}
