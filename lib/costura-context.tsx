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

interface CosturaContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const CosturaContext = createContext<CosturaContextType | undefined>(undefined)

export function CosturaProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // No filtramos omite_corte_costura en el query: cualquier orden
      // aprobada debe ser visible en Costura.
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("*")

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        const hasValue = (v: unknown) =>
          v !== null && v !== undefined && String(v).trim() !== ""

        const isYardaje = (o: Orden) =>
          (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
          "YARDAJE"

        // Etapa previa a Costura segun el flujo:
        //   - flujo normal: Sublimacion (seta_sublimacion).
        //   - Solo Corte/Costura y YARDAJE: Corte (cfecha_de_corte). En
        //     YARDAJE el corte ocurre DESPUES de Sublimacion, por lo que
        //     Costura debe esperar a que el corte termine.
        const isReadyForCostura = (o: Orden) =>
          o.solo_corte_costura === true || isYardaje(o)
            ? hasValue(o.cfecha_de_corte)
            : hasValue(o.seta_sublimacion)

        // Reglas de exclusión:
        // 1. Ordenes rechazadas por el planner no aparecen en producción.
        // 2. Costura acepta PRODUCCION_NORMAL y YARDAJE. null/undefined se
        //    trata como normal por compatibilidad hacia atrás.
        // 3. Si costura_si_no = false (boolean o string "false") la orden
        //    no requiere Costura y se excluye del módulo.
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
          // Excluir si la orden no requiere costura
          const costuraSiNo = String(o.costura_si_no ?? "true").trim().toLowerCase()
          if (costuraSiNo === "false") return false
          return true
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Ready for costura always on top
          const aReady = isReadyForCostura(a) ? 0 : 1
          const bReady = isReadyForCostura(b) ? 0 : 1
          if (aReady !== bReady) {
            return aReady - bReady
          }

          // 2. Urgent before non-urgent in same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By costura target date ascending (nulls last)
          const aDate = a.cosfecha_objetivo_cs
            ? new Date(a.cosfecha_objetivo_cs).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.cosfecha_objetivo_cs
            ? new Date(b.cosfecha_objetivo_cs).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Costura - Error al consultar:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las ordenes de costura"
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
      console.error("[v0] Costura - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <CosturaContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </CosturaContext.Provider>
  )
}

export function useCostura() {
  const context = useContext(CosturaContext)
  if (!context) {
    throw new Error("useCostura must be used within a CosturaProvider")
  }
  return context
}
