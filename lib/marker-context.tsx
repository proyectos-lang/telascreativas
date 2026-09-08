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

/**
 * Línea de `detalleorden`: alimenta el algoritmo de agrupación (por `tela`)
 * y además es la REFERENCIA que el marker necesita para trazar — qué prenda,
 * en qué género, talla y estilo.
 */
export interface LineaTela {
  pedido: string
  tela: string | null
  pcs: number | string | null
  nombre: string | null
  genero: string | null
  talla: string | null
  estilo: string | null
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
  editarCore: (input: EditarCoreInput) => Promise<Resultado>
}

export interface EditarCoreInput {
  coreId: number
  /** Ordenes que quedan en el marker tras la edicion. */
  ordenes: OrdenEnCore[]
  /** Yardas teoricas del trazo nuevo: el anterior ya no aplica. */
  yardasTeoricas: number
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
        // `solo_corte_costura` NO excluye: esas órdenes saltan Diseño,
        // Impresión y Sublimación, pero SÍ pasan por Corte, así que
        // necesitan trazo igual. Se excluían por asumir que el trazo salía
        // del arte de Diseño, y no es así: sale de las medidas y la tela.
        // Si no pasa por Corte, el trazo no tiene destino.
        if (o.omite_corte_costura === true) return false
        // Órdenes anteriores al área: ya se cortaron sin trazo, así que
        // pedirlo ahora no tiene sentido. Sin este filtro, 45 órdenes ya
        // cortadas aparecían en la cola pidiendo un marker inútil.
        if (o.cfecha_de_corte) return false
        return true
      })

      // Marker Digital NO depende de Diseño: el trazo se hace con las
      // medidas y la tela, que ya vienen en la orden. Por eso la cola se
      // ordena solo por urgencia y fecha objetivo; antes las órdenes sin
      // arte entregado caían al fondo como si estuvieran bloqueadas.
      propias.sort((a, b) => {
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

      // Detalle de todas las órdenes del área: se usa tanto para agrupar
      // como para desplegar las referencias de un marker ya armado.
      const enCola = propias.map((o) => o.pedido)
      if (enCola.length > 0) {
        const { data: det } = await fetchAll<LineaTela>((from, to) =>
          supabase
            .schema("telas")
            .from("detalleorden")
            .select("pedido, tela, pcs, nombre, genero, talla, estilo")
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

  /**
   * Cambia la composicion de un marker.
   *
   * Se puede editar mientras Corte no lo haya RECIBIDO. Despues no: sus
   * ordenes ya estarian en la mesa y quitar una cambiaria por detras lo
   * que el cortador tiene delante.
   *
   * Las ordenes que salen quedan como si nunca hubieran pasado por el
   * marker: se les borra el vinculo, las yardas y —si el marker ya estaba
   * entregado— tambien el trazo, para que vuelvan a la cola en vez de
   * quedar con una entrega que ya no existe.
   */
  const editarCore = useCallback(
    async (input: EditarCoreInput): Promise<Resultado> => {
      if (input.ordenes.length === 0)
        return { success: false, error: "El marker debe conservar al menos una orden." }
      if (!Number.isFinite(input.yardasTeoricas) || input.yardasTeoricas <= 0)
        return { success: false, error: "Las yardas teóricas son obligatorias." }

      const { data: coreData, error: coreErr } = await supabase
        .schema("telas")
        .from("marker_cores")
        .select("*")
        .eq("id", input.coreId)
        .maybeSingle()
      if (coreErr) return { success: false, error: coreErr.message }
      const core = coreData as MarkerCore | null
      if (!core) return { success: false, error: "El marker ya no existe." }
      if (core.estado === "Recibido en Corte" || core.estado === "Cortado")
        return {
          success: false,
          error: "Corte ya recibió este marker: no se puede modificar.",
        }

      const { data: previos } = await supabase
        .schema("telas")
        .from("marker_core_pedidos")
        .select("pedido")
        .eq("core_id", input.coreId)
      const antes = ((previos as { pedido: string }[]) ?? []).map((p) => p.pedido)
      const ahora = input.ordenes.map((o) => o.pedido)
      const salen = antes.filter((p) => !ahora.includes(p))

      // Las que salen vuelven a la cola, sin rastro del marker.
      if (salen.length > 0) {
        const { error } = await supabase
          .schema("telas")
          .from("cabecera")
          .update({
            mdcore_id: null,
            mdyardas_teoricas: null,
            mdentrega_marker: null,
          })
          .in("pedido", salen)
        if (error) return { success: false, error: error.message }
      }

      // Se rehace la composicion completa: mas simple y sin estados a medias.
      await supabase
        .schema("telas")
        .from("marker_core_pedidos")
        .delete()
        .eq("core_id", input.coreId)

      const { error: hijosErr } = await supabase
        .schema("telas")
        .from("marker_core_pedidos")
        .insert(
          input.ordenes.map((o) => ({
            core_id: input.coreId,
            pedido: o.pedido,
            pcs: o.piezas,
            telas_secundarias: o.telasSecundarias.length
              ? o.telasSecundarias.join(", ")
              : null,
          }))
        )
      if (hijosErr) return { success: false, error: hijosErr.message }

      // Reparto de las yardas NUEVAS entre las ordenes que quedan.
      const reparto = prorratearPorPiezas(
        input.yardasTeoricas,
        input.ordenes.map((o) => ({ pedido: o.pedido, piezas: o.piezas }))
      )
      const entregado = core.estado === "Entregado"
      for (const o of input.ordenes) {
        await supabase
          .schema("telas")
          .from("cabecera")
          .update({
            mdcore_id: input.coreId,
            mdyardas_teoricas: reparto.get(o.pedido) ?? null,
            mdfecha_de_recepcion: hoyISO(),
            // Si el marker ya estaba entregado, las que entran heredan la
            // entrega para no quedar a medio camino.
            ...(entregado && core.fecha_entrega_marker
              ? {
                  mdentrega_marker: core.fecha_entrega_marker,
                  ...(objetivoCorteDesdeMarker(core.fecha_entrega_marker)
                    ? {
                        cfecha_objetivo_c: objetivoCorteDesdeMarker(
                          core.fecha_entrega_marker
                        ),
                      }
                    : {}),
                }
              : {}),
          })
          .eq("pedido", o.pedido)
      }

      const { error: updErr } = await supabase
        .schema("telas")
        .from("marker_cores")
        .update({
          total_pcs: input.ordenes.reduce((s, o) => s + o.piezas, 0),
          yardas_teoricas: input.yardasTeoricas,
        })
        .eq("id", input.coreId)
      if (updErr) return { success: false, error: updErr.message }

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
        editarCore,
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
