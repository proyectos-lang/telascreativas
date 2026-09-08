"use client"

/**
 * Inventario de piezas extra.
 *
 * Al trazar y al cortar quedan piezas de más. Cada registro es un
 * MOVIMIENTO, no un saldo: así se puede reconstruir de dónde salió cada
 * pieza y darlas de baja más adelante sin perder la historia.
 *
 * Dos niveles de detalle, a propósito:
 *   - Marker registra solo la cantidad: al proyectar el trazo todavía no
 *     se sabe qué talla concreta va a sobrar.
 *   - Corte registra pedido, talla y referencia: ahí las piezas ya están
 *     cortadas y se identifican una por una.
 */

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type OrigenPieza = "marker" | "corte"
export type EstadoPieza = "disponible" | "usada" | "descartada"

export interface PiezaExtra {
  id: number
  origen: OrigenPieza
  core_id: number | null
  pedido: string | null
  talla: string | null
  referencia: string | null
  tela: string | null
  cantidad: number
  estado: EstadoPieza
  fecha: string
  registrado_por: string | null
  notas: string | null
}

/** Alta desde Marker Digital: solo cantidad, sin desglose. */
export interface AltaMarker {
  coreId: number | null
  cantidad: number
  tela?: string | null
  registradoPor?: string | null
  notas?: string | null
}

/** Alta desde Corte: una fila por talla/referencia identificada. */
export interface AltaCorte {
  pedido: string
  talla: string
  referencia: string
  cantidad: number
  tela?: string | null
  coreId?: number | null
  registradoPor?: string | null
}

interface Resultado {
  success: boolean
  error?: string
}

export async function registrarPiezasMarker(
  a: AltaMarker
): Promise<Resultado> {
  if (!Number.isFinite(a.cantidad) || a.cantidad <= 0)
    return { success: false, error: "La cantidad debe ser mayor que cero." }

  const { error } = await supabase
    .schema("telas")
    .from("piezas_extra")
    .insert({
      origen: "marker",
      core_id: a.coreId,
      cantidad: a.cantidad,
      tela: a.tela ?? null,
      registrado_por: a.registradoPor ?? null,
      notas: a.notas ?? null,
    })
  return error ? { success: false, error: error.message } : { success: true }
}

/** Alta en bloque desde Corte: se validan todas antes de escribir. */
export async function registrarPiezasCorte(
  filas: AltaCorte[]
): Promise<Resultado> {
  const validas = filas.filter(
    (f) => Number.isFinite(f.cantidad) && f.cantidad > 0
  )
  if (validas.length === 0)
    return { success: false, error: "No hay piezas que registrar." }

  const falta = validas.find(
    (f) => !f.pedido?.trim() || !f.talla?.trim() || !f.referencia?.trim()
  )
  if (falta)
    return {
      success: false,
      error: "Cada pieza necesita pedido, talla y referencia.",
    }

  const { error } = await supabase
    .schema("telas")
    .from("piezas_extra")
    .insert(
      validas.map((f) => ({
        origen: "corte",
        core_id: f.coreId ?? null,
        pedido: f.pedido.trim(),
        talla: f.talla.trim(),
        referencia: f.referencia.trim(),
        tela: f.tela ?? null,
        cantidad: f.cantidad,
        registrado_por: f.registradoPor ?? null,
      }))
    )
  return error ? { success: false, error: error.message } : { success: true }
}

export async function cargarPiezasExtra(): Promise<PiezaExtra[]> {
  const { data } = await supabase
    .schema("telas")
    .from("piezas_extra")
    .select("*")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
  return (data as PiezaExtra[]) ?? []
}

/** Da de baja una pieza del inventario. */
export async function cambiarEstadoPieza(
  id: number,
  estado: EstadoPieza
): Promise<Resultado> {
  const { error } = await supabase
    .schema("telas")
    .from("piezas_extra")
    .update({ estado })
    .eq("id", id)
  return error ? { success: false, error: error.message } : { success: true }
}

export interface ResumenPiezas {
  disponibles: number
  desdeMarker: number
  desdeCorte: number
  /** Agrupado por referencia + talla; solo cuenta lo disponible. */
  porTipo: {
    referencia: string
    talla: string
    cantidad: number
  }[]
}

/**
 * Resumen del inventario. Las piezas de marker no entran en `porTipo`
 * porque no tienen talla ni referencia: se cuentan aparte para no
 * inventar un desglose que no existe.
 */
export function resumir(piezas: PiezaExtra[]): ResumenPiezas {
  const disp = piezas.filter((p) => p.estado === "disponible")
  const mapa = new Map<string, { referencia: string; talla: string; cantidad: number }>()

  for (const p of disp) {
    if (!p.referencia && !p.talla) continue
    const referencia = p.referencia ?? "Sin referencia"
    const talla = p.talla ?? "—"
    const k = `${referencia}||${talla}`
    const e = mapa.get(k) ?? { referencia, talla, cantidad: 0 }
    e.cantidad += Number(p.cantidad) || 0
    mapa.set(k, e)
  }

  const suma = (xs: PiezaExtra[]) =>
    xs.reduce((s, p) => s + (Number(p.cantidad) || 0), 0)

  return {
    disponibles: suma(disp),
    desdeMarker: suma(disp.filter((p) => p.origen === "marker")),
    desdeCorte: suma(disp.filter((p) => p.origen === "corte")),
    porTipo: [...mapa.values()].sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.referencia.localeCompare(b.referencia) ||
        a.talla.localeCompare(b.talla)
    ),
  }
}
