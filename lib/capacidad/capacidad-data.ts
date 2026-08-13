"use client"

/**
 * Capa de datos del módulo Capacidad v2.
 *
 * Carga en un solo paquete todo lo que el motor necesita (parámetros por
 * área, excepciones, reservas, matriz de tiempos, máquinas, calibraciones y
 * las órdenes activas de cabecera) con un cache a nivel módulo compartido
 * entre los tabs (patrón de lib/reposiciones-pendientes.ts).
 */

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import { getTodayISO } from "@/lib/date-utils"
import type {
  AreaParametro,
  CalibracionLog,
  ExcepcionCapacidad,
  MaquinaCapacidad,
  MatrizTiempoRow,
  OrdenCapacidad,
  ReservaCapacidad,
} from "./motor"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface DatosCapacidad {
  ordenes: OrdenCapacidad[]
  params: AreaParametro[]
  excepciones: ExcepcionCapacidad[]
  reservas: ReservaCapacidad[]
  matriz: MatrizTiempoRow[]
  maquinas: MaquinaCapacidad[]
  /** Últimas calibraciones (todas las filas recientes, ordenadas desc). */
  calibraciones: CalibracionLog[]
  /** Mensaje si las tablas del motor no existen aún (falta correr el SQL). */
  errorMotor: string | null
}

const CAMPOS_CABECERA = [
  "pedido",
  "cliente",
  "pcs",
  "es_urgente",
  "fecha_de_entrega",
  "fecha_de_entreganueva",
  "entregado_cliente_si_no",
  "estado_aprobado_rechazado",
  "tipo_flujo_especial",
  "solo_corte_costura",
  "omite_corte_costura",
  "costura_si_no",
  "accesorios_inventario",
  "maquina_costura",
  "dentrega_diseno",
  "cfecha_de_corte",
  "ientrega_impresion",
  "seta_sublimacion",
  "coseta_costura",
  "efecha_de_empaque",
  "dfecha_objetivo_d",
  "cfecha_objetivo_c",
  "ifecha_objetivo_i",
  "sfecha_objetivo_s",
  "cosfecha_objetivo_cs",
  "efecha_objetivo_e",
].join(", ")

async function cargarDatos(): Promise<DatosCapacidad> {
  const hoy = getTodayISO()
  const [ordenesR, paramsR, excR, resR, matrizR, maqR, calR] = await Promise.all([
    // Órdenes potencialmente activas: sin empaque cerrado y no entregadas.
    fetchAll<OrdenCapacidad>((from, to) =>
      supabase
        .schema("telas")
        .from("cabecera")
        .select(CAMPOS_CABECERA)
        .is("efecha_de_empaque", null)
        .range(from, to) as never
    ),
    supabase.schema("telas").from("capacidad_areas").select("*").order("area"),
    supabase
      .schema("telas")
      .from("capacidad_excepciones")
      .select("*")
      .gte("fecha", hoy)
      .order("fecha"),
    supabase
      .schema("telas")
      .from("capacidad_reserva")
      .select("*")
      .gte("fecha_planificada", hoy)
      .order("fecha_planificada"),
    supabase
      .schema("telas")
      .from("capacidad_matriz_tiempos")
      .select("*")
      .eq("activo", true)
      .order("tipo_codigo")
      .order("rango"),
    supabase.schema("telas").from("capacidad_maquinas").select("*").eq("activo", true),
    supabase
      .schema("telas")
      .from("capacidad_calibracion_log")
      .select("*")
      .order("fecha_calculo", { ascending: false })
      .limit(300),
  ])

  // Si las tablas del motor no existen (42P01), avisar en vez de romper.
  const errores = [paramsR.error, matrizR.error, maqR.error].filter(Boolean)
  const errorMotor = errores.length
    ? "Faltan las tablas del motor de capacidad. Ejecuta scripts/capacidad-motor.sql en Supabase."
    : null

  return {
    ordenes: (ordenesR.data ?? []) as OrdenCapacidad[],
    params: (paramsR.data ?? []) as AreaParametro[],
    excepciones: (excR.data ?? []) as ExcepcionCapacidad[],
    reservas: (resR.data ?? []) as ReservaCapacidad[],
    matriz: (matrizR.data ?? []) as MatrizTiempoRow[],
    maquinas: (maqR.data ?? []) as MaquinaCapacidad[],
    calibraciones: (calR.data ?? []) as CalibracionLog[],
    errorMotor,
  }
}

// Cache a nivel módulo (compartido entre tabs; se invalida tras escrituras).
let cachePromise: Promise<DatosCapacidad> | null = null

export function invalidateCapacidadCache() {
  cachePromise = null
}

function loadDatos(): Promise<DatosCapacidad> {
  if (!cachePromise) {
    cachePromise = cargarDatos().catch((err) => {
      cachePromise = null
      throw err
    })
  }
  return cachePromise
}

export function useCapacidadDatos() {
  const [datos, setDatos] = useState<DatosCapacidad | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDatos(await loadDatos())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar capacidad")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const refresh = useCallback(async () => {
    invalidateCapacidadCache()
    await cargar()
  }, [cargar])

  return { datos, loading, error, refresh }
}

// ---------------------------------------------------------------------------
// Escrituras (los componentes invalidan el cache tras cada una)
// ---------------------------------------------------------------------------

export async function actualizarAreaParametro(
  area: string,
  updates: Partial<AreaParametro>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("capacidad_areas")
    .update({ ...updates, actualizado_en: new Date().toISOString() })
    .eq("area", area)
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}

export async function crearExcepcion(input: {
  area: string
  fecha: string
  factor: number
  motivo?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("capacidad_excepciones")
    .upsert(
      { area: input.area, fecha: input.fecha, factor: input.factor, motivo: input.motivo ?? null },
      { onConflict: "area,fecha" }
    )
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}

export async function eliminarExcepcion(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("capacidad_excepciones")
    .delete()
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}

/** Ejecuta la calibración en BD (función SQL). p_aplicar copia P85 al parámetro. */
export async function recalibrar(
  ventanaDias: number,
  aplicar = false
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .rpc("fn_capacidad_calibrar", { p_ventana_dias: ventanaDias, p_aplicar: aplicar })
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}

export async function guardarReservas(
  filas: {
    area: string
    fecha_planificada: string
    pcs_reservadas: number
    detalle: string
    creado_por: string | null
  }[]
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("capacidad_reserva")
    .insert(filas.map((f) => ({ ...f, origen: "simulacion" })))
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}

export async function eliminarReservasPorDetalle(
  detalle: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("capacidad_reserva")
    .delete()
    .eq("detalle", detalle)
  if (error) return { success: false, error: error.message }
  invalidateCapacidadCache()
  return { success: true }
}
