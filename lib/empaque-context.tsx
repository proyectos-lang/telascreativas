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

interface EmpaqueContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const EmpaqueContext = createContext<EmpaqueContextType | undefined>(undefined)

export function EmpaqueProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: supabaseError } = await fetchAll((from, to) =>
        supabase.schema("telas").from("cabecera").select("*").range(from, to)
      )



      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        // Determina si la orden puede pasar por Empaque según su flujo:
        // - PRODUCCION_NORMAL / flujo estándar: requiere coseta_costura (Costura terminó).
        // - VENTA_INVENTARIO: llega directo a Empaque sin pasar por ninguna
        //   etapa de producción previa; se considera lista desde que está aprobada.
        const isVentaInventario = (o: Orden) =>
          (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
          "VENTA_INVENTARIO"

        const isReadyForEmpaque = (o: Orden) => {
          if (isVentaInventario(o)) {
            // Lista en cuanto está aprobada por el planner.
            return (
              (o.estado_aprobado_rechazado ?? "")
                .toString()
                .trim()
                .toLowerCase() === "aprobado"
            )
          }
          return (
            o.coseta_costura !== null &&
            o.coseta_costura !== undefined &&
            String(o.coseta_costura).trim() !== ""
          )
        }

        const hasAccesorios = (v: string | undefined | null) =>
          typeof v === "string" && v.trim().length > 0

        // Excluir rechazadas. Empaque acepta PRODUCCION_NORMAL, YARDAJE y
        // VENTA_INVENTARIO (sin accesorios). COMPRA_EXTERNA queda fuera.
        // VENTA_INVENTARIO con accesorios_inventario pasa por Sublimación,
        // no por Empaque.
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
          if (
            flujo &&
            flujo !== "PRODUCCION_NORMAL" &&
            flujo !== "VENTA_INVENTARIO" &&
            flujo !== "YARDAJE"
          )
            return false
          // VENTA_INVENTARIO con accesorios va a Sublimación → Entregas, no a Empaque.
          if (flujo === "VENTA_INVENTARIO" && hasAccesorios(o.accesorios_inventario))
            return false
          // YARDAJE sin costura (costura_si_no = false) NO pasa por Empaque:
          // va directo de Sublimacion a Entregas, asi que se excluye aqui.
          const sinCostura =
            String(o.costura_si_no ?? "true").trim().toLowerCase() === "false"
          if (flujo === "YARDAJE" && sinCostura) return false
          return true
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Ready for empaque (Costura finished) always on top
          const aReady = isReadyForEmpaque(a) ? 0 : 1
          const bReady = isReadyForEmpaque(b) ? 0 : 1
          if (aReady !== bReady) {
            return aReady - bReady
          }

          // 2. Urgent before non-urgent in same group
          const aUrgent = a.es_urgente === true ? 0 : 1
          const bUrgent = b.es_urgente === true ? 0 : 1
          if (aUrgent !== bUrgent) {
            return aUrgent - bUrgent
          }

          // 3. By empaque target date ascending (nulls last)
          const aDate = a.efecha_objetivo_e
            ? new Date(a.efecha_objetivo_e).getTime()
            : Number.POSITIVE_INFINITY
          const bDate = b.efecha_objetivo_e
            ? new Date(b.efecha_objetivo_e).getTime()
            : Number.POSITIVE_INFINITY
          return aDate - bDate
        })

        console.log(
          "[v0] Empaque - YARDAJE en data cruda:",
          (data || [])
            .filter(
              (o) =>
                (o.tipo_flujo_especial ?? "")
                  .toString()
                  .trim()
                  .toUpperCase() === "YARDAJE"
            )
            .map((o) => ({
              pedido: o.pedido,
              costura_si_no: o.costura_si_no,
              tipo_costura_si_no: typeof o.costura_si_no,
            }))
        )
        console.log(
          "[v0] Empaque - YARDAJE que pasaron el filtro:",
          sorted
            .filter(
              (o) =>
                (o.tipo_flujo_especial ?? "")
                  .toString()
                  .trim()
                  .toUpperCase() === "YARDAJE"
            )
            .map((o) => ({ pedido: o.pedido, costura_si_no: o.costura_si_no }))
        )
        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Empaque - Error al consultar:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las ordenes de empaque"
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
      console.error("[v0] Empaque - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <EmpaqueContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </EmpaqueContext.Provider>
  )
}

export function useEmpaque() {
  const context = useContext(EmpaqueContext)
  if (!context) {
    throw new Error("useEmpaque must be used within a EmpaqueProvider")
  }
  return context
}
