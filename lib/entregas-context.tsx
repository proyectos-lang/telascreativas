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

interface EntregasContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (
    pedido: string,
    updates: Partial<Orden>
  ) => Promise<{ success: boolean; error?: string }>
}

const EntregasContext = createContext<EntregasContextType | undefined>(
  undefined
)

export function EntregasProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Entregas recibe ordenes que ya terminaron su flujo de produccion.
      // En el caso normal eso significa Empaque cerrado (efecha_de_empaque).
      // PERO las ordenes YARDAJE sin costura (costura_si_no = false) NO pasan
      // por Costura ni Empaque: van directo de Sublimacion a Entregas. Por eso
      // se traen todas las ordenes y se filtra del lado del cliente.
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("*")

      console.log("[v0] Entregas - Datos de Supabase:", data)
      console.log("[v0] Entregas - Error de Supabase:", supabaseError)

      if (supabaseError) {
        setError(supabaseError.message)
        setOrdenes([])
      } else {
        const hasValue = (v: unknown) =>
          v !== null && v !== undefined && String(v).trim() !== ""

        const isYardaje = (o: Orden) =>
          (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
          "YARDAJE"

        const sinCostura = (o: Orden) =>
          String(o.costura_si_no ?? "true").trim().toLowerCase() === "false"

        // Determina si una orden ya esta lista para Entrega segun su flujo:
        // - YARDAJE sin costura: salta Costura y Empaque; lista en cuanto
        //   Sublimacion termino (seta_sublimacion).
        // - Resto de flujos: requiere Empaque cerrado (efecha_de_empaque).
        const isReadyForEntrega = (o: Orden) =>
          isYardaje(o) && sinCostura(o)
            ? hasValue(o.seta_sublimacion)
            : hasValue(o.efecha_de_empaque)

        // Fecha de referencia para ordenar (Empaque normal o Sublimacion en
        // el caso YARDAJE sin costura).
        const refDate = (o: Orden) => {
          const raw =
            isYardaje(o) && sinCostura(o)
              ? o.seta_sublimacion
              : o.efecha_de_empaque
          return raw ? new Date(raw).getTime() : 0
        }

        const isDelivered = (o: Orden) => o.entregado_cliente_si_no === true

        // Excluir rechazadas/canceladas y las que aun no estan listas para entrega.
        const notRejected = (data || []).filter((o) => {
          const est = (o.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          if (est === "rechazado" || est === "cancelado") return false
          return isReadyForEntrega(o)
        })

        const sorted = notRejected.sort((a, b) => {
          // 1. Pending delivery before already delivered
          const aDelivered = isDelivered(a) ? 1 : 0
          const bDelivered = isDelivered(b) ? 1 : 0
          if (aDelivered !== bDelivered) {
            return aDelivered - bDelivered
          }

          // 2. Most recent reference date first (Empaque, o Sublimacion en
          //    el caso YARDAJE sin costura). Descending.
          return refDate(b) - refDate(a)
        })

        console.log(
          "[v0] Entregas - Orden aplicado:",
          sorted.map((o) => ({
            pedido: o.pedido,
            tipo_flujo_especial: o.tipo_flujo_especial,
            costura_si_no: o.costura_si_no,
            efecha_de_empaque: o.efecha_de_empaque,
            seta_sublimacion: o.seta_sublimacion,
            entregado_cliente_si_no: o.entregado_cliente_si_no,
          }))
        )

        setOrdenes(sorted)
      }
    } catch (err) {
      console.error("[v0] Entregas - Error al consultar:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las ordenes de entregas"
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

      console.log("[v0] Entregas - Update response:", data)
      console.log("[v0] Entregas - Update error:", supabaseError)

      if (supabaseError) {
        return { success: false, error: supabaseError.message }
      }

      await fetchOrdenes()
      return { success: true }
    } catch (err) {
      console.error("[v0] Entregas - Error al actualizar:", err)
      const errorMsg =
        err instanceof Error ? err.message : "Error al actualizar la orden"
      return { success: false, error: errorMsg }
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  return (
    <EntregasContext.Provider
      value={{
        ordenes,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
      }}
    >
      {children}
    </EntregasContext.Provider>
  )
}

export function useEntregas() {
  const context = useContext(EntregasContext)
  if (!context) {
    throw new Error("useEntregas must be used within an EntregasProvider")
  }
  return context
}
