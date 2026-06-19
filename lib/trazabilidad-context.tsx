"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Filtros del modulo "Mis Pedidos" (Trazabilidad Comercial).
 *
 * Replicamos el set completo del modulo Programacion (pedido, cliente,
 * vendedora, fechaIngreso, urgencia) para que la experiencia sea consistente
 * entre ambas vistas. El toggle `hideDelivered` es exclusivo de este modulo
 * porque aqui las vendedoras consultan pedidos en curso; se maneja aparte
 * del objeto `filters` para no romper el mental model del formulario.
 */
export interface TrazabilidadFilters {
  pedido: string
  cliente: string
  vendedora: string
  fechaIngreso: string // YYYY-MM-DD
  // Fecha comprometida de entrega al cliente (telas.cabecera.fecha_de_entrega).
  // Se compara solo a nivel YYYY-MM-DD para evitar desfases por timezone.
  fechaEntrega: string // YYYY-MM-DD
  urgencia: "todos" | "urgente" | "normal"
}

export const INITIAL_TRAZABILIDAD_FILTERS: TrazabilidadFilters = {
  pedido: "",
  cliente: "",
  vendedora: "",
  fechaIngreso: "",
  fechaEntrega: "",
  urgencia: "todos",
}

interface TrazabilidadContextType {
  ordenes: Orden[]
  filtered: Orden[]
  clientes: string[]
  vendedoras: string[]
  isLoading: boolean
  error: string | null
  filters: TrazabilidadFilters
  setFilters: (f: TrazabilidadFilters) => void
  resetFilters: () => void
  hideDelivered: boolean
  deliveredCount: number
  setHideDelivered: (v: boolean) => void
  refreshOrdenes: () => Promise<void>
}

const TrazabilidadContext = createContext<TrazabilidadContextType | undefined>(
  undefined
)

export function TrazabilidadProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TrazabilidadFilters>(
    INITIAL_TRAZABILIDAD_FILTERS
  )
  // Toggle para ocultar los pedidos ya entregados al cliente
  // (por defecto los ocultamos para que la vendedora vea primero lo pendiente).
  const [hideDelivered, setHideDelivered] = useState<boolean>(true)

  const fetchOrdenes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Primary source: telas.cabecera
      // We always query cabecera because we need all the individual stage delivery
      // date fields (dentrega_diseno, cfecha_de_corte, ientrega_impresion,
      // seta_sublimacion, coseta_costura, efecha_de_empaque, fecha_entrega_cliente)
      // to drive the timeline visualization. The vista_seguimiento_comercial only
      // returns aggregated fields, which caused every stage to render as "Pendiente".
      //
      // porcentaje_avance and estado_produccion are computed client-side via
      // enrichOrden() as a safe fallback when the vista is not joined.
      const { data, error: cabError } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("*")

      if (cabError) {
        setError(cabError.message)
        setOrdenes([])
      } else {
        setOrdenes((data || []).map((o) => enrichOrden(o as Orden)))
      }
    } catch (err) {
      console.error("[v0] Trazabilidad - Error:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar el seguimiento comercial"
      )
      setOrdenes([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrdenes()
  }, [])

  // Listas unicas para los selects del formulario de filtros.
  const { clientes, vendedoras } = useMemo(() => {
    const clientesSet = new Set<string>()
    const vendedorasSet = new Set<string>()
    for (const o of ordenes) {
      if (o.cliente && o.cliente.trim() !== "") {
        clientesSet.add(o.cliente.trim())
      }
      if (o.vendedora && o.vendedora.trim() !== "") {
        vendedorasSet.add(o.vendedora.trim())
      }
    }
    return {
      clientes: Array.from(clientesSet).sort((a, b) =>
        a.localeCompare(b, "es")
      ),
      vendedoras: Array.from(vendedorasSet).sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    }
  }, [ordenes])

  // Cantidad de pedidos entregados (para mostrar en el boton-toggle)
  const deliveredCount = useMemo(
    () => ordenes.filter((o) => o.entregado_cliente_si_no === true).length,
    [ordenes]
  )

  // Aplica los 5 filtros + el toggle de entregados. Preservamos el mismo
  // algoritmo de Programacion (orders-content.tsx) para consistencia.
  const filtered = useMemo(() => {
    return ordenes
      .filter((o) => {
        // Toggle de entregados (exclusivo de Mis Pedidos).
        if (hideDelivered && o.entregado_cliente_si_no === true) return false

        // Pedido: coincidencia parcial, case-insensitive.
        if (
          filters.pedido &&
          !o.pedido?.toLowerCase().includes(filters.pedido.toLowerCase())
        ) {
          return false
        }

        // Cliente: coincidencia exacta.
        if (filters.cliente && o.cliente !== filters.cliente) return false

        // Vendedora: coincidencia exacta.
        if (filters.vendedora && o.vendedora !== filters.vendedora) {
          return false
        }

        // Fecha de ingreso: comparamos solo YYYY-MM-DD para evitar desfases
        // de timezone al parsear timestamps que llegan de Postgres.
        if (filters.fechaIngreso && o.fecha_de_ingreso) {
          const ymd =
            typeof o.fecha_de_ingreso === "string"
              ? o.fecha_de_ingreso.slice(0, 10)
              : new Date(o.fecha_de_ingreso as unknown as string)
                  .toISOString()
                  .slice(0, 10)
          if (ymd !== filters.fechaIngreso) return false
        }

        // Fecha de entrega comprometida al cliente. Misma logica que arriba.
        if (filters.fechaEntrega) {
          const raw = o.fecha_de_entrega
          if (!raw) return false
          const ymd =
            typeof raw === "string"
              ? raw.slice(0, 10)
              : new Date(raw as unknown as string).toISOString().slice(0, 10)
          if (ymd !== filters.fechaEntrega) return false
        }

        // Urgencia.
        if (filters.urgencia === "urgente" && !o.es_urgente) return false
        if (filters.urgencia === "normal" && o.es_urgente) return false

        return true
      })
      .sort((a, b) => {
        // Ordenamiento solicitado: por campo "pedido" (alfa-numerico natural).
        // Usamos localeCompare con numeric:true para que PED-10 quede despues de PED-2.
        const aPedido = (a.pedido || "").toString()
        const bPedido = (b.pedido || "").toString()
        return aPedido.localeCompare(bPedido, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      })
  }, [ordenes, filters, hideDelivered])

  const resetFilters = () => setFilters(INITIAL_TRAZABILIDAD_FILTERS)

  return (
    <TrazabilidadContext.Provider
      value={{
        ordenes,
        filtered,
        clientes,
        vendedoras,
        isLoading,
        error,
        filters,
        setFilters,
        resetFilters,
        hideDelivered,
        deliveredCount,
        setHideDelivered,
        refreshOrdenes: fetchOrdenes,
      }}
    >
      {children}
    </TrazabilidadContext.Provider>
  )
}

// If the view does not return porcentaje_avance or estado_produccion,
// compute sensible defaults from the cabecera fields so the UI does not break.
function enrichOrden(o: Orden): Orden {
  const stages: Array<{ key: string; done: boolean }> = [
    { key: "diseno", done: !!o.dentrega_diseno },
    { key: "corte", done: !!o.cfecha_de_corte },
    { key: "impresion", done: !!o.ientrega_impresion },
    { key: "sublimacion", done: !!o.seta_sublimacion },
    { key: "costura", done: !!o.coseta_costura },
    { key: "empaque", done: !!o.efecha_de_empaque },
    { key: "entrega", done: o.entregado_cliente_si_no === true },
  ]

  const completed = stages.filter((s) => s.done).length
  const computedPct = Math.round((completed / stages.length) * 100)

  let estado: string
  if (o.entregado_cliente_si_no === true) estado = "Entregado a Cliente"
  else if (o.efecha_de_empaque) estado = "Empacado - Listo para Entrega"
  else if (o.coseta_costura) estado = "En Costura Terminada"
  else if (o.seta_sublimacion) estado = "Sublimacion Terminada"
  else if (o.ientrega_impresion) estado = "Impresion Terminada"
  else if (o.cfecha_de_corte) estado = "Corte Terminado"
  else if (o.dentrega_diseno) estado = "Diseno Terminado"
  else estado = "En Programacion"

  return {
    ...o,
    porcentaje_avance:
      typeof o.porcentaje_avance === "number" ? o.porcentaje_avance : computedPct,
    estado_produccion: o.estado_produccion || estado,
  }
}

export function useTrazabilidad() {
  const ctx = useContext(TrazabilidadContext)
  if (!ctx) {
    throw new Error(
      "useTrazabilidad debe usarse dentro de TrazabilidadProvider"
    )
  }
  return ctx
}
