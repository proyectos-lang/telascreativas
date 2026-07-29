"use client"

/**
 * Resumen Dia (cierre diario de produccion).
 *
 * Modulo independiente que permite a un gerente revisar, para una fecha
 * dada, cuantas ordenes y cuantas piezas entraron y salieron de cada
 * area productiva. La fuente de verdad es `telas.cabecera`: traemos
 * todas las ordenes una vez y calculamos las agregaciones en memoria
 * cada vez que cambia la fecha seleccionada.
 *
 * Las fechas en BD pueden venir como DATE ("YYYY-MM-DD") o como
 * TIMESTAMP ("YYYY-MM-DDTHH:mm:ss..."). Normalizamos a YMD usando
 * solo los primeros 10 caracteres para evitar corrimientos por TZ.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import type { Orden } from "@/lib/types"
import { fetchAll } from "@/lib/fetch-all"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Todas las columnas de fecha que usa el resumen (recibidas/entregadas por
// área). La consulta trae cualquier orden cuya fecha en ALGUNA de estas
// columnas caiga en el rango; el bucket por área hace el filtro fino en JS.
const RESUMEN_DATE_COLS = [
  "fecha_de_ingreso",
  "dfecha_de_ingreso_diseno",
  "dentrega_diseno",
  "cfecha_de_recepcion",
  "cfecha_de_corte",
  "ifecha_de_ingreso_imp",
  "ientrega_impresion",
  "sfecha_de_ingreso_sub",
  "seta_sublimacion",
  "cosfecha_conteo",
  "coseta_costura",
  "efecha_de_empaque",
  "fecha_entrega_cliente",
] as const

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Llaves de cada area que renderiza una tarjeta. Mantenemos el orden del
 * flujo productivo (Ventas -> ... -> Entregas) para que el grid se lea
 * de izquierda a derecha como un pipeline.
 */
export type ResumenAreaKey =
  | "ventas"
  | "diseno"
  | "corte"
  | "impresion"
  | "sublimacion"
  | "costura"
  | "empaque"
  | "entregas"

export interface ResumenItem {
  pedido: string
  pcs: number
}

export interface ResumenBucket {
  ordenes: number
  piezas: number
  items: ResumenItem[]
}

export interface ResumenArea {
  key: ResumenAreaKey
  recibidas: ResumenBucket | null // null cuando el area no aplica (Ventas)
  entregadas: ResumenBucket | null // null cuando el area no aplica (Entregas)
}

interface ResumenDiaContextType {
  /** Fecha inicial del rango (YYYY-MM-DD). */
  dateFrom: string
  /** Fecha final del rango (YYYY-MM-DD, inclusive). */
  dateTo: string
  setDateFrom: (d: string) => void
  setDateTo: (d: string) => void
  isLoading: boolean
  error: string | null
  /** Ejecuta la consulta con las fechas seleccionadas (botón "Consultar"). */
  refresh: () => Promise<void>
  /** Rango efectivamente consultado y mostrado (puede diferir de los inputs
   *  hasta que se pulse "Consultar"). */
  queriedFrom: string
  queriedTo: string
  /** true cuando los inputs difieren del rango ya consultado. */
  dirty: boolean
  areas: Record<ResumenAreaKey, ResumenArea>
  /** Indica si el rango consultado abarca mas de un dia. */
  isRange: boolean
  // Total agregado del rango (suma de ingreso a Ventas y entrega a Cliente).
  // Sirve como hero metric en el header.
  totals: {
    ingresoOrdenes: number
    ingresoPiezas: number
    entregaOrdenes: number
    entregaPiezas: number
    rechazadasOrdenes: number
    canceladasOrdenes: number
  }
}

const ResumenDiaContext = createContext<ResumenDiaContextType | undefined>(
  undefined
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Devuelve la fecha de hoy en formato YYYY-MM-DD usando la TZ local. */
function todayYMD(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Día siguiente a un YMD (para usar límite superior exclusivo `< nextDay`,
 *  que incluye todo el día `until` tanto en columnas DATE como TIMESTAMP). */
function nextDayYMD(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Normaliza un valor de fecha de BD a "YYYY-MM-DD". Acepta:
 *   - "YYYY-MM-DD"            (DATE)
 *   - "YYYY-MM-DDTHH:..."     (TIMESTAMP / TIMESTAMPTZ)
 *   - undefined / null / ""   -> ""
 *
 * El slice de 10 caracteres preserva el dia que esta almacenado en BD
 * sin pasar por `new Date(...)` (que lo desplazaria por timezone).
 */
function toYMD(value: unknown): string {
  if (!value) return ""
  if (typeof value !== "string") return ""
  return value.slice(0, 10)
}

/**
 * Construye una entrada simple {pedido, pcs} a partir de una orden.
 * `pcs` puede venir null/undefined (deberia ser numero pero el typing es
 * laxo); en ese caso devolvemos 0 para no romper la suma.
 */
function toItem(o: Orden): ResumenItem {
  return {
    pedido: String(o.pedido ?? ""),
    pcs: typeof o.pcs === "number" ? o.pcs : Number(o.pcs) || 0,
  }
}

/**
 * Construye un bucket {ordenes, piezas, items} agrupando todas las
 * ordenes cuya fecha cae dentro del rango [fromYMD, toYMD] (inclusive).
 * Si el campo de fecha no esta poblado o queda fuera del rango, la
 * orden se ignora.
 */
function buildBucket(
  ordenes: Orden[],
  field: keyof Orden,
  fromYMD: string,
  untilYMD: string
): ResumenBucket {
  const items: ResumenItem[] = []
  for (const o of ordenes) {
    const d = toYMD(o[field])
    if (!d) continue
    if (d < fromYMD || d > untilYMD) continue
    items.push(toItem(o))
  }
  // Orden alfabetico por # pedido para que el detalle sea estable.
  items.sort((a, b) => a.pedido.localeCompare(b.pedido))
  const piezas = items.reduce((acc, it) => acc + (it.pcs || 0), 0)
  return { ordenes: items.length, piezas, items }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ResumenDiaProvider({ children }: { children: ReactNode }) {
  const [dateFrom, setDateFrom] = useState<string>(todayYMD())
  const [dateTo, setDateTo] = useState<string>(todayYMD())
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Rango efectivamente consultado (con el que se calculan los buckets).
  const [queried, setQueried] = useState<{ from: string; until: string }>({
    from: todayYMD(),
    until: todayYMD(),
  })

  // Consulta filtrada por fechas EN EL SERVIDOR (OR sobre todas las columnas
  // de fecha) y paginada con fetchAll para traer el 100% de las órdenes del
  // rango sin toparse con el límite de 1000 filas de Supabase.
  const fetchOrdenes = useCallback(async (fromArg: string, untilArg: string) => {
    const from = fromArg <= untilArg ? fromArg : untilArg
    const until = fromArg <= untilArg ? untilArg : fromArg
    const untilExcl = nextDayYMD(until)
    setIsLoading(true)
    setError(null)
    try {
      const orExpr = RESUMEN_DATE_COLS.map(
        (c) => `and(${c}.gte.${from},${c}.lt.${untilExcl})`
      ).join(",")

      const { data, error: dbError } = await fetchAll<Orden>((rangeFrom, rangeTo) =>
        supabase
          .schema("telas")
          .from("cabecera")
          .select("*")
          .or(orExpr)
          .range(rangeFrom, rangeTo) as unknown as PromiseLike<{
          data: Orden[] | null
          error: { message: string } | null
        }>
      )

      if (dbError) {
        console.log("[v0] ResumenDia - error supabase:", dbError)
        setError(dbError.message)
        setOrdenes([])
      } else {
        setOrdenes(data || [])
        setQueried({ from, until })
      }
    } catch (err) {
      console.log("[v0] ResumenDia - unexpected error:", err)
      setError(err instanceof Error ? err.message : "Error inesperado")
      setOrdenes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Carga inicial (hoy). No se re-consulta al cambiar las fechas: el usuario
  // pulsa "Consultar" para regenerar los datos del nuevo rango.
  useEffect(() => {
    void fetchOrdenes(todayYMD(), todayYMD())
  }, [fetchOrdenes])

  const refresh = useCallback(
    () => fetchOrdenes(dateFrom, dateTo),
    [fetchOrdenes, dateFrom, dateTo]
  )

  /**
   * Agregaciones por area. Memoizado en (ordenes, selectedDate) para que
   * cambiar la fecha sea instantaneo (no se re-hace fetch).
   *
   * Mapeo de fechas usadas (campos de telas.cabecera):
   *   - Ventas        -> recibida: fecha_de_ingreso
   *   - Diseno        -> recibida: dfecha_de_ingreso_diseno / entregada: dentrega_diseno
   *   - Corte         -> recibida: cfecha_de_recepcion       / entregada: cfecha_de_corte
   *   - Impresion     -> recibida: ifecha_de_ingreso_imp     / entregada: ientrega_impresion
   *   - Sublimacion   -> recibida: sfecha_de_ingreso_sub     / entregada: seta_sublimacion
   *   - Costura       -> recibida: cosfecha_conteo           / entregada: coseta_costura
   *   - Empaque       -> recibida: coseta_costura            / entregada: efecha_de_empaque
   *     (cuando Costura entrega es cuando Empaque "recibe" la orden)
   *   - Entregas      -> entregada: fecha_entrega_cliente
   */
  // Los buckets se calculan contra el rango YA consultado (no contra los
  // inputs), para que la vista sea consistente hasta que se pulse "Consultar".
  const from = queried.from
  const until = queried.until

  const areas = useMemo<Record<ResumenAreaKey, ResumenArea>>(() => {
    return {
      ventas: {
        key: "ventas",
        recibidas: buildBucket(ordenes, "fecha_de_ingreso", from, until),
        entregadas: null,
      },
      diseno: {
        key: "diseno",
        recibidas: buildBucket(ordenes, "dfecha_de_ingreso_diseno", from, until),
        entregadas: buildBucket(ordenes, "dentrega_diseno", from, until),
      },
      corte: {
        key: "corte",
        recibidas: buildBucket(ordenes, "cfecha_de_recepcion", from, until),
        entregadas: buildBucket(ordenes, "cfecha_de_corte", from, until),
      },
      impresion: {
        key: "impresion",
        recibidas: buildBucket(ordenes, "ifecha_de_ingreso_imp", from, until),
        entregadas: buildBucket(ordenes, "ientrega_impresion", from, until),
      },
      sublimacion: {
        key: "sublimacion",
        recibidas: buildBucket(ordenes, "sfecha_de_ingreso_sub", from, until),
        entregadas: buildBucket(ordenes, "seta_sublimacion", from, until),
      },
      costura: {
        key: "costura",
        recibidas: buildBucket(ordenes, "cosfecha_conteo", from, until),
        entregadas: buildBucket(ordenes, "coseta_costura", from, until),
      },
      empaque: {
        key: "empaque",
        // Empaque recibe la orden cuando Costura la entrega (coseta_costura).
        recibidas: buildBucket(ordenes, "coseta_costura", from, until),
        entregadas: buildBucket(ordenes, "efecha_de_empaque", from, until),
      },
      entregas: {
        key: "entregas",
        recibidas: null,
        entregadas: buildBucket(ordenes, "fecha_entrega_cliente", from, until),
      },
    }
  }, [ordenes, from, until])

  const totals = useMemo(() => {
    const ingreso = areas.ventas.recibidas
    const entrega = areas.entregas.entregadas

    // Ordenes rechazadas/canceladas cuya fecha_de_ingreso cae en el rango.
    // Usamos `ordenes` (el array completo cargado, antes de filtrar por area)
    // para no depender de los buckets de area que excluyen estos estados.
    let rechazadasOrdenes = 0
    let canceladasOrdenes = 0
    for (const o of ordenes) {
      const d = toYMD(o.fecha_de_ingreso)
      if (!d || d < from || d > until) continue
      const estado = (o.estado_aprobado_rechazado ?? "").toString().toLowerCase()
      if (estado === "rechazado") rechazadasOrdenes++
      else if (estado === "cancelado") canceladasOrdenes++
    }

    return {
      ingresoOrdenes: ingreso?.ordenes ?? 0,
      ingresoPiezas: ingreso?.piezas ?? 0,
      entregaOrdenes: entrega?.ordenes ?? 0,
      entregaPiezas: entrega?.piezas ?? 0,
      rechazadasOrdenes,
      canceladasOrdenes,
    }
  }, [areas, ordenes, from, until])

  const isRange = from !== until
  const dirty = dateFrom !== queried.from || dateTo !== queried.until

  const value = useMemo<ResumenDiaContextType>(
    () => ({
      dateFrom,
      dateTo,
      setDateFrom,
      setDateTo,
      isLoading,
      error,
      refresh,
      queriedFrom: queried.from,
      queriedTo: queried.until,
      dirty,
      areas,
      isRange,
      totals,
    }),
    [dateFrom, dateTo, isLoading, error, refresh, queried.from, queried.until, dirty, areas, isRange, totals]
  )

  return (
    <ResumenDiaContext.Provider value={value}>
      {children}
    </ResumenDiaContext.Provider>
  )
}

export function useResumenDia() {
  const ctx = useContext(ResumenDiaContext)
  if (!ctx) {
    throw new Error("useResumenDia must be used within ResumenDiaProvider")
  }
  return ctx
}
