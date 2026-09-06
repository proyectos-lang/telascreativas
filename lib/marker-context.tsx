"use client"

/**
 * Contexto del módulo Marker Digital.
 *
 * Sigue el patrón de los demás módulos de producción (print-context,
 * cut-context) pero añade la gestión de CORES: agrupaciones de pedidos que
 * comparten tela y se cortan juntos.
 *
 * Solo entran aquí las órdenes con `es_marker_digital_si_no = true`; el
 * resto conserva su flujo actual sin pasar por esta área.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import { fetchAll } from "@/lib/fetch-all"
import { objetivoCorteDesdeMarker } from "@/lib/fechas-objetivo"
import {
  prorratearPorPiezas,
  TOPE_CORE_POR_DEFECTO,
  type OrdenEnCore,
} from "@/lib/marker/cores"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Fila de `telas.marker_cores`. */
export interface MarkerCore {
  id: number
  nombre: string
  tela_principal: string
  total_pcs: number | null
  yardas_teoricas: number | null
  yardas_reales: number | null
  estado: "Abierto" | "Entregado" | "Recibido en Corte" | "Cortado"
  fecha_creacion: string | null
  fecha_entrega_marker: string | null
  fecha_recepcion_corte: string | null
  fecha_corte: string | null
  creado_por: string | null
  notas: string | null
}

/** Línea de detalle que alimenta el algoritmo de agrupación. */
export interface LineaTela {
  pedido: string
  tela: string | null
  pcs: number | string | null
}

interface Resultado {
  success: boolean
  error?: string
}

interface MarkerContextType {
  ordenes: Orden[]
  /** Detalle (tela por pedido) de las órdenes en cola. */
  lineas: LineaTela[]
  cores: MarkerCore[]
  /** Tope de piezas por core, desde telas.capacidad_areas. */
  topePcs: number
  isLoading: boolean
  error: string | null
  refreshOrdenes: () => Promise<void>
  updateOrden: (pedido: string, updates: Partial<Orden>) => Promise<Resultado>
  guardarTopePcs: (valor: number) => Promise<Resultado>
  crearCore: (input: CrearCoreInput) => Promise<Resultado & { id?: number }>
  entregarCore: (coreId: number, fecha?: string) => Promise<Resultado>
}

export interface CrearCoreInput {
  nombre: string
  telaPrincipal: string
  yardasTeoricas: number
  ordenes: OrdenEnCore[]
  creadoPor?: string | null
  notas?: string | null
}

const MarkerContext = createContext<MarkerContextType | undefined>(undefined)

const hoyISO = () => new Date().toISOString().split("T")[0]

export function MarkerProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [lineas, setLineas] = useState<LineaTela[]>([])
  const [cores, setCores] = useState<MarkerCore[]>([])
  const [topePcs, setTopePcs] = useState<number>(TOPE_CORE_POR_DEFECTO)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await fetchAll<Orden>((from, to) =>
        supabase
          .schema("telas")
          .from("cabecera")
          .select("*")
          .range(from, to) as unknown as PromiseLike<{
          data: Orden[] | null
          error: { message: string } | null
        }>
      )
      if (dbError) {
        setError(dbError.message)
        setOrdenes([])
        return
      }

      // Marker Digital solo procesa las órdenes marcadas. El flag puede
      // venir null en órdenes históricas: cuenta como "no marker".
      const propias = (data || []).filter((o) => {
        const estado = (o.estado_aprobado_rechazado || "")
          .toString()
          .trim()
          .toLowerCase()
        if (estado === "rechazado" || estado === "cancelado") return false
        if (o.es_marker_digital_si_no !== true) return false
        const flujo = (o.tipo_flujo_especial ?? "").toString().trim().toUpperCase()
        if (flujo && flujo !== "PRODUCCION_NORMAL" && flujo !== "YARDAJE")
          return false
        // Sin Diseño/Impresión la orden va directo a Corte: no hay trazo.
        if (o.solo_corte_costura === true) return false
        // Si no pasa por Corte, el trazo no tiene destino.
        if (o.omite_corte_costura === true) return false
        return true
      })

      // El trazo se hace con el arte de Diseño ya entregado.
      const lista = (o: Orden) =>
        o.dentrega_diseno != null && String(o.dentrega_diseno).trim() !== ""

      propias.sort((a, b) => {
        const ra = lista(a) ? 0 : 1
        const rb = lista(b) ? 0 : 1
        if (ra !== rb) return ra - rb
        const ua = a.es_urgente === true ? 0 : 1
        const ub = b.es_urgente === true ? 0 : 1
        if (ua !== ub) return ua - ub
        const da = a.mdfecha_objetivo_md
          ? new Date(a.mdfecha_objetivo_md).getTime()
          : Number.POSITIVE_INFINITY
        const db = b.mdfecha_objetivo_md
          ? new Date(b.mdfecha_objetivo_md).getTime()
          : Number.POSITIVE_INFINITY
        return da - db
      })

      setOrdenes(propias)

      // Detalle solo de las órdenes en cola (las que aún no tienen trazo).
      const enCola = propias
        .filter((o) => !o.mdentrega_marker && !o.mdcore_id)
        .map((o) => o.pedido)
      if (enCola.length > 0) {
        const { data: det } = await fetchAll<LineaTela>((from, to) =>
          supabase
            .schema("telas")
            .from("detalleorden")
            .select("pedido, tela, pcs")
            .in("pedido", enCola)
            .range(from, to) as unknown as PromiseLike<{
            data: LineaTela[] | null
            error: { message: string } | null
          }>
        )
        setLineas(det ?? [])
      } else {
        setLineas([])
      }

      const { data: cs } = await supabase
        .schema("telas")
        .from("marker_cores")
        .select("*")
        .order("fecha_creacion", { ascending: false })
      setCores((cs as MarkerCore[]) ?? [])

      // El tope de piezas por core es un parámetro de planta, no una
      // constante de código: vive en capacidad_areas.limite_fisico.
      const { data: cap } = await supabase
        .schema("telas")
        .from("capacidad_areas")
        .select("limite_fisico")
        .eq("area", "Marker")
        .maybeSingle()
      const tope = Number((cap as { limite_fisico: number | null } | null)?.limite_fisico)
      setTopePcs(Number.isFinite(tope) && tope > 0 ? tope : TOPE_CORE_POR_DEFECTO)
    } catch (err) {
      console.error("[Marker] Error al consultar:", err)
      setError(
        err instanceof Error ? err.message : "Error al cargar Marker Digital"
      )
      setOrdenes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateOrden = useCallback(
    async (pedido: string, updates: Partial<Orden>): Promise<Resultado> => {
      const { error: dbError } = await supabase
        .schema("telas")
        .from("cabecera")
        .update(updates)
        .eq("pedido", pedido)
      if (dbError) return { success: false, error: dbError.message }
      await fetchOrdenes()
      return { success: true }
    },
    [fetchOrdenes]
  )

  const guardarTopePcs = useCallback(
    async (valor: number): Promise<Resultado> => {
      if (!Number.isFinite(valor) || valor <= 0)
        return { success: false, error: "El tope debe ser mayor que cero." }
      const { error: dbError } = await supabase
        .schema("telas")
        .from("capacidad_areas")
        .update({ limite_fisico: valor, actualizado_en: new Date().toISOString() })
        .eq("area", "Marker")
      if (dbError) return { success: false, error: dbError.message }
      setTopePcs(valor)
      return { success: true }
    },
    []
  )

  /**
   * Crea un core y marca sus órdenes.
   *
   * Las yardas teóricas se capturan como una sola cifra del trazo y se
   * prorratean por piezas a cada orden, para que los indicadores puedan
   * contrastarlas contra las yardas reales de Corte orden por orden.
   */
  const crearCore = useCallback(
    async (input: CrearCoreInput): Promise<Resultado & { id?: number }> => {
      const nombre = input.nombre.trim()
      if (!nombre) return { success: false, error: "El nombre del marker es obligatorio." }
      if (input.ordenes.length === 0)
        return { success: false, error: "Selecciona al menos una orden." }

      const totalPcs = input.ordenes.reduce((s, o) => s + o.piezas, 0)

      const { data: creado, error: coreError } = await supabase
        .schema("telas")
        .from("marker_cores")
        .insert({
          nombre,
          tela_principal: input.telaPrincipal,
          total_pcs: totalPcs,
          yardas_teoricas: input.yardasTeoricas,
          estado: "Abierto",
          creado_por: input.creadoPor ?? null,
          notas: input.notas ?? null,
        })
        .select("id")
        .single()

      if (coreError) {
        // El nombre es único en la BD: traducimos el choque a algo legible.
        const dup = /duplicate key|unique/i.test(coreError.message)
        return {
          success: false,
          error: dup
            ? `Ya existe un marker llamado "${nombre}".`
            : coreError.message,
        }
      }

      const coreId = (creado as { id: number }).id

      const { error: hijosError } = await supabase
        .schema("telas")
        .from("marker_core_pedidos")
        .insert(
          input.ordenes.map((o) => ({
            core_id: coreId,
            pedido: o.pedido,
            pcs: o.piezas,
            telas_secundarias: o.telasSecundarias.length
              ? o.telasSecundarias.join(", ")
              : null,
          }))
        )
      if (hijosError) {
        // Sin hijos el core no sirve: se revierte para no dejar basura.
        await supabase.schema("telas").from("marker_cores").delete().eq("id", coreId)
        return { success: false, error: hijosError.message }
      }

      const reparto = prorratearPorPiezas(
        input.yardasTeoricas,
        input.ordenes.map((o) => ({ pedido: o.pedido, piezas: o.piezas }))
      )
      for (const o of input.ordenes) {
        await supabase
          .schema("telas")
          .from("cabecera")
          .update({
            mdcore_id: coreId,
            mdyardas_teoricas: reparto.get(o.pedido) ?? null,
            mdfecha_de_recepcion: hoyISO(),
          })
          .eq("pedido", o.pedido)
      }

      await fetchOrdenes()
      return { success: true, id: coreId }
    },
    [fetchOrdenes]
  )

  /**
   * Entrega el core a Corte.
   *
   * Escribe la MISMA fecha de entrega en todas sus órdenes y les recalcula
   * el objetivo de Corte a +4 días hábiles contados desde esta entrega (no
   * desde la programación original): Corte no podía empezar sin el trazo.
   * No se toca ninguna otra fecha objetivo.
   */
  const entregarCore = useCallback(
    async (coreId: number, fecha?: string): Promise<Resultado> => {
      const entrega = fecha ?? hoyISO()
      const nuevoObjetivoCorte = objetivoCorteDesdeMarker(entrega)

      const { data: hijos, error: hijosError } = await supabase
        .schema("telas")
        .from("marker_core_pedidos")
        .select("pedido")
        .eq("core_id", coreId)
      if (hijosError) return { success: false, error: hijosError.message }

      const pedidos = ((hijos as { pedido: string }[]) ?? []).map((h) => h.pedido)
      if (pedidos.length === 0)
        return { success: false, error: "El core no tiene órdenes." }

      const { error: updError } = await supabase
        .schema("telas")
        .from("cabecera")
        .update({
          mdentrega_marker: entrega,
          ...(nuevoObjetivoCorte ? { cfecha_objetivo_c: nuevoObjetivoCorte } : {}),
        })
        .in("pedido", pedidos)
      if (updError) return { success: false, error: updError.message }

      const { error: coreError } = await supabase
        .schema("telas")
        .from("marker_cores")
        .update({ estado: "Entregado", fecha_entrega_marker: entrega })
        .eq("id", coreId)
      if (coreError) return { success: false, error: coreError.message }

      await fetchOrdenes()
      return { success: true }
    },
    [fetchOrdenes]
  )

  useEffect(() => {
    void fetchOrdenes()
  }, [fetchOrdenes])

  return (
    <MarkerContext.Provider
      value={{
        ordenes,
        lineas,
        cores,
        topePcs,
        isLoading,
        error,
        refreshOrdenes: fetchOrdenes,
        updateOrden,
        guardarTopePcs,
        crearCore,
        entregarCore,
      }}
    >
      {children}
    </MarkerContext.Provider>
  )
}

export function useMarker() {
  const ctx = useContext(MarkerContext)
  if (!ctx) throw new Error("useMarker debe usarse dentro de MarkerProvider")
  return ctx
}
