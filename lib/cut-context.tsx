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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface CutContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const CutContext = createContext<CutContextType | undefined>(undefined)

export function CutProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all orders - sorting is applied client-side below.
      // No filtramos omite_corte_costura en el query: cualquier orden
      // aprobada debe ser visible en Corte.
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("*")

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        const isApproved = (o: Orden) => {
          const estado = (o.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          return estado === "aprobado"
        }

        const isYardaje = (o: Orden) =>
          (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
          "YARDAJE"

        // YARDAJE: Corte espera a que Sublimacion termine (seta_sublimacion).
        // El sort usa esta funcion para priorizar las listas.
        const isReadyForCut = (o: Orden) => {
          if (isYardaje(o)) return Boolean(o.seta_sublimacion)
          return isApproved(o)
        }

        // Reglas de exclusión:
        // 1. Ordenes rechazadas por el planner no aparecen en producción.
        // 2. Corte acepta PRODUCCION_NORMAL y YARDAJE. null/undefined
        //    se trata como normal por compatibilidad hacia atrás.
        // 3. Si costura_si_no = false (boolean o string "false") la orden
        //    no requiere Corte ni Costura y se excluye de ambas áreas.
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
          // Excluir si la orden no requiere costura/corte
          const costuraSiNo = String(o.costura_si_no ?? "true").trim().toLowerCase()
          if (costuraSiNo === "false") return false
          return true
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Ready for cut orders always on top (YARDAJE: after sublimation;
          //    normal flow: after approval)
          const aApproved = isReadyForCut(a) ? 0 : 1
          const bApproved = isReadyForCut(b) ? 0 : 1
          if (aApproved !== bApproved) {
            return aApproved - bApproved
          }

          // 2. Urgent before non-urgent in same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By cut target date ascending (nulls last)
          const aDate = a.cfecha_objetivo_c
            ? new Date(a.cfecha_objetivo_c).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.cfecha_objetivo_c
            ? new Date(b.cfecha_objetivo_c).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Cut - Error al consultar:", err)
      setError(
        err instanceof Error ? err.message : "Error al cargar las ordenes de corte"
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
      console.error("[v0] Cut - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <CutContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </CutContext.Provider>
  )
}

export function useCut() {
  const context = useContext(CutContext)
  if (!context) {
    throw new Error("useCut must be used within a CutProvider")
  }
  return context
}
