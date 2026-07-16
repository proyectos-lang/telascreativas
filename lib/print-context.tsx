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

interface PrintContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const PrintContext = createContext<PrintContextType | undefined>(undefined)

export function PrintProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // No filtramos solo_corte_costura en el query: cualquier orden
      // aprobada debe ser visible en Impresion.
      const { data, error: supabaseError } = await fetchAll((from, to) =>
        supabase.schema("telas").from("cabecera").select("*").range(from, to)
      )

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        // Tanto PRODUCCION_NORMAL como YARDAJE arrancan con Diseño:
        // el orden es Diseño -> Impresion. Por lo tanto Impresion solo
        // queda lista cuando Diseño ha entregado (dentrega_diseno).
        const isReadyForPrint = (o: Orden) =>
          o.dentrega_diseno !== null &&
          o.dentrega_diseno !== undefined &&
          String(o.dentrega_diseno).trim() !== ""

        // Reglas de exclusión:
        // 1. Ordenes rechazadas por el planner no aparecen en producción.
        // 2. Impresión acepta PRODUCCION_NORMAL y YARDAJE. null/undefined
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
          // 1. Ready for print (design delivered) always on top
          const aReady = isReadyForPrint(a) ? 0 : 1
          const bReady = isReadyForPrint(b) ? 0 : 1
          if (aReady !== bReady) {
            return aReady - bReady
          }

          // 2. Urgent before non-urgent in same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By print target date ascending (nulls last)
          const aDate = a.ifecha_objetivo_i
            ? new Date(a.ifecha_objetivo_i).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.ifecha_objetivo_i
            ? new Date(b.ifecha_objetivo_i).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Print - Error al consultar:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las ordenes de impresion"
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
      console.error("[v0] Print - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <PrintContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  const context = useContext(PrintContext)
  if (!context) {
    throw new Error("usePrint must be used within a PrintProvider")
  }
  return context
}
