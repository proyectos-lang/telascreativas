"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "./types"
import { fetchAll } from "@/lib/fetch-all"

// Inicializacion explicita del cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno de Supabase")
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "")

interface OrdersContextType {
  ordenes: Orden[]
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (pedido: string, updates: Partial<Orden>) => Promise<{ success: boolean; error?: string }>
}

const OrdersContext = createContext<OrdersContextType | null>(null)

export function OrdersProvider({ children }: { children: ReactNode }) {
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
        setOrdenes(data || [])
      }
    } catch (err) {
      console.error("[v0] Error inesperado:", err)
      setError(err instanceof Error ? err.message : "Error desconocido al conectar con Supabase")
      setOrdenes([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  const refreshOrdenes = async () => {
    await fetchOrdenes()
  }

  const updateOrden = async (pedido: string, updates: Partial<Orden>): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("cabecera")
        .update(updates)
        .eq("pedido", pedido)
        .select()

      if (supabaseError) {
        setError(supabaseError.message)
        return { success: false, error: supabaseError.message }
      } else {
        // Refresh the list after update
        await fetchOrdenes()
        return { success: true }
      }
    } catch (err) {
      console.error("[v0] Error al actualizar:", err)
      const errorMsg = err instanceof Error ? err.message : "Error al actualizar la orden"
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OrdersContext.Provider
      value={{ ordenes, isLoading, error, refreshOrdenes, updateOrden }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}
