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

interface SublimationContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const SublimationContext = createContext<SublimationContextType | undefined>(
  undefined
)

export function SublimationProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // No filtramos solo_corte_costura en el query: cualquier orden
      // aprobada debe ser visible en Sublimacion.
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("*")

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        // YARDAJE: Sublimacion recibe de Impresion directamente (sin Corte previo).
        // Solo necesita ientrega_impresion para estar lista.
        // PRODUCCION_NORMAL: necesita cfecha_de_corte + ientrega_impresion.
        // VENTA_INVENTARIO con accesorios: no pasa por Impresion ni Corte;
        // lista en cuanto esta aprobada por el planner.
        const isYardaje = (o: Orden) =>
          (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
          "YARDAJE"

        const hasAccesorios = (v: string | undefined | null) =>
          typeof v === "string" && v.trim().length > 0

        const isReadyForSublimation = (o: Orden) => {
          const flujo = (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase()
          if (flujo === "VENTA_INVENTARIO" && hasAccesorios(o.accesorios_inventario)) {
            // No pasa por Impresión ni Corte: lista en cuanto está aprobada.
            return (
              (o.estado_aprobado_rechazado ?? "")
                .toString()
                .trim()
                .toLowerCase() === "aprobado"
            )
          }
          if (isYardaje(o)) {
            return Boolean(o.ientrega_impresion)
          }
          // Ordenes sin costura (costura_si_no = false) tampoco pasan por
          // Corte, por lo tanto cfecha_de_corte nunca se setea. Para estas
          // ordenes basta con que Impresion haya entregado.
          const costuraSiNo = String(o.costura_si_no ?? "true").trim().toLowerCase()
          if (costuraSiNo === "false") {
            return Boolean(o.ientrega_impresion)
          }
          return Boolean(o.cfecha_de_corte) && Boolean(o.ientrega_impresion)
        }

        // Reglas de exclusión:
        // 1. Ordenes rechazadas por el planner no aparecen en producción.
        // 2. Sublimación acepta PRODUCCION_NORMAL, YARDAJE y, como caso
        //    especial, VENTA_INVENTARIO si tiene accesorios_inventario.
        //    COMPRA_EXTERNA queda fuera. null/undefined se trata como
        //    normal por compatibilidad hacia atrás.
        const notRejected = (data || []).filter((o) => {
          const estado = (o.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          if (estado === "rechazado" || estado === "cancelado") return false
          // Si solo_corte_costura = true la orden salta Diseño,
          // Impresión y Sublimación — va directo a Corte y Costura.
          if (o.solo_corte_costura === true) return false
          const flujo = (o.tipo_flujo_especial ?? "")
            .toString()
            .trim()
            .toUpperCase()
          if (!flujo || flujo === "PRODUCCION_NORMAL" || flujo === "YARDAJE")
            return true
          if (
            flujo === "VENTA_INVENTARIO" &&
            hasAccesorios(o.accesorios_inventario)
          ) {
            return true
          }
          return false
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Ready for sublimation always on top
          const aReady = isReadyForSublimation(a) ? 0 : 1
          const bReady = isReadyForSublimation(b) ? 0 : 1
          if (aReady !== bReady) {
            return aReady - bReady
          }

          // 2. Urgent before non-urgent in same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By sublimation target date ascending (nulls last)
          const aDate = a.sfecha_objetivo_s
            ? new Date(a.sfecha_objetivo_s).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.sfecha_objetivo_s
            ? new Date(b.sfecha_objetivo_s).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Sublimation - Error al consultar:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las ordenes de sublimacion"
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
      console.error("[v0] Sublimation - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <SublimationContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </SublimationContext.Provider>
  )
}

export function useSublimation() {
  const context = useContext(SublimationContext)
  if (!context) {
    throw new Error(
      "useSublimation must be used within a SublimationProvider"
    )
  }
  return context
}
