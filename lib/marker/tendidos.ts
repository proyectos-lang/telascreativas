"use client"

/**
 * Tendidos: la subdivisión de un marker.
 *
 * Un marker no se corta de una vez. Se parte en tendidos, y cada uno es
 * un trazo concreto con su tela, talla, género, color, longitud, capas y
 * piezas — exactamente lo que ya trae la hoja de corte en papel.
 *
 * Dos cosas que se siguen de que el tendido tenga su PROPIA tela:
 *
 *  - Un marker puede mezclarlas. En la hoja MK-027 los tendidos 1 a 5
 *    son ANTIFLUIDO y el 6 es MAXXI; descontar todo contra la tela
 *    principal del core movería stock de la equivocada.
 *  - Corte puede procesar unos y dejar otros, así que el corte se marca
 *    por tendido y el marker puede quedar a medias.
 */

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Tendido {
  id: number
  core_id: number
  numero: number
  nombre_mm: string | null
  tela: string | null
  tela_inventario_id: number | null
  color_tela: string | null
  talla: string | null
  genero: string | null
  largo_trazo_in: number | null
  /** Yardas de UNA capa, como en la hoja de corte. */
  yardas: number | null
  capas: number | null
  total_pcs: number | null
  pcs_extra: number
  /** Yardas totales del tendido: es el consumo que se descuenta. */
  tendido_total: number | null
  cortado: boolean
  fecha_corte: string | null
  yardas_reales: number | null
  piezas_cortadas: number | null
  cortado_por: string | null
  notas: string | null
}

/** Lo que se captura al crear un tendido; el resto lo pone la base. */
export interface TendidoNuevo {
  numero: number
  nombre_mm?: string | null
  tela?: string | null
  tela_inventario_id?: number | null
  color_tela?: string | null
  talla?: string | null
  genero?: string | null
  largo_trazo_in?: number | null
  yardas?: number | null
  capas?: number | null
  total_pcs?: number | null
  pcs_extra?: number | null
  tendido_total?: number | null
}

export interface AvanceMarker {
  core_id: number
  core_nombre: string
  core_estado: string
  tendidos: number
  cortados: number
  pendientes: number
  yardas_teoricas: number
  yardas_reales: number
  pcs_planeadas: number
  pcs_cortadas: number
  telas_distintas: number
}

interface Resultado {
  success: boolean
  error?: string
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Yardas totales de un tendido.
 *
 * La hoja de corte imprime las yardas de UNA capa y el número de capas;
 * el tendido total es el producto. Se calcula aquí para que el editor
 * muestre la cifra mientras se captura, pero se GUARDA en la base: la
 * hoja redondea y su valor impreso es el que manda en planta.
 */
export function calcularTendidoTotal(
  yardas: number | null | undefined,
  capas: number | null | undefined
): number | null {
  const y = num(yardas)
  const c = num(capas)
  if (y === null || c === null) return null
  return Math.round(y * c * 100) / 100
}

export async function cargarTendidos(coreId: number): Promise<Tendido[]> {
  const { data } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .select("*")
    .eq("core_id", coreId)
    .order("numero")
  return (data as Tendido[]) ?? []
}

/** Tendidos de varios markers a la vez, para pintar listas. */
export async function cargarTendidosDeCores(
  coreIds: number[]
): Promise<Map<number, Tendido[]>> {
  const m = new Map<number, Tendido[]>()
  if (coreIds.length === 0) return m

  const { data } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .select("*")
    .in("core_id", coreIds)
    .order("numero")

  for (const t of (data as Tendido[]) ?? []) {
    const lista = m.get(t.core_id) ?? []
    lista.push(t)
    m.set(t.core_id, lista)
  }
  return m
}

export async function cargarAvance(): Promise<Map<number, AvanceMarker>> {
  const { data } = await supabase
    .schema("telas")
    .from("vista_marker_tendidos_avance")
    .select("*")
  const m = new Map<number, AvanceMarker>()
  for (const a of (data as AvanceMarker[]) ?? []) m.set(a.core_id, a)
  return m
}

/**
 * Reemplaza los tendidos de un marker.
 *
 * Se borran y se vuelven a crear en vez de editarlos uno a uno: la
 * captura viene de una hoja que se llena completa, y un reemplazo total
 * evita quedarse con tendidos viejos que ya no están en el papel.
 *
 * Los que YA fueron cortados se conservan: borrarlos perdería el
 * registro de consumo y dejaría movimientos de inventario apuntando a
 * un tendido inexistente.
 */
export async function guardarTendidos(
  coreId: number,
  tendidos: TendidoNuevo[]
): Promise<Resultado> {
  const cortados = (await cargarTendidos(coreId)).filter((t) => t.cortado)
  const numerosProtegidos = new Set(cortados.map((t) => t.numero))

  const { error: errDel } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .delete()
    .eq("core_id", coreId)
    .eq("cortado", false)
  if (errDel) return { success: false, error: errDel.message }

  const nuevos = tendidos.filter((t) => !numerosProtegidos.has(t.numero))
  if (nuevos.length === 0) return { success: true }

  const { error } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .insert(
      nuevos.map((t) => ({
        core_id: coreId,
        numero: t.numero,
        nombre_mm: t.nombre_mm?.trim() || null,
        tela: t.tela?.trim() || null,
        tela_inventario_id: t.tela_inventario_id ?? null,
        color_tela: t.color_tela?.trim() || null,
        talla: t.talla?.trim() || null,
        genero: t.genero?.trim() || null,
        largo_trazo_in: num(t.largo_trazo_in),
        yardas: num(t.yardas),
        capas: num(t.capas),
        total_pcs: num(t.total_pcs),
        pcs_extra: num(t.pcs_extra) ?? 0,
        tendido_total:
          num(t.tendido_total) ?? calcularTendidoTotal(t.yardas, t.capas),
      }))
    )
  return error ? { success: false, error: error.message } : { success: true }
}

/**
 * Marca un tendido como cortado con su consumo real.
 *
 * No toca el estado del core: un marker con tendidos pendientes no está
 * cortado, y quien decide eso es la pantalla de Corte al ver el avance.
 */
export async function marcarTendidoCortado(input: {
  tendidoId: number
  yardasReales: number
  piezasCortadas?: number | null
  fecha?: string
  cortadoPor?: string | null
  notas?: string | null
}): Promise<Resultado> {
  const y = num(input.yardasReales)
  if (y === null || y <= 0)
    return { success: false, error: "Las yardas reales deben ser mayores que cero." }

  const { error } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .update({
      cortado: true,
      fecha_corte: input.fecha ?? new Date().toISOString().split("T")[0],
      yardas_reales: y,
      piezas_cortadas: num(input.piezasCortadas),
      cortado_por: input.cortadoPor ?? null,
      notas: input.notas?.trim() || null,
    })
    .eq("id", input.tendidoId)

  return error ? { success: false, error: error.message } : { success: true }
}

/** Deshace el corte de un tendido, por si se marcó por error. */
export async function revertirTendido(tendidoId: number): Promise<Resultado> {
  const { error } = await supabase
    .schema("telas")
    .from("marker_tendidos")
    .update({
      cortado: false,
      fecha_corte: null,
      yardas_reales: null,
      piezas_cortadas: null,
      cortado_por: null,
    })
    .eq("id", tendidoId)
  return error ? { success: false, error: error.message } : { success: true }
}

/** Resumen de una lista de tendidos, para las cabeceras. */
export function resumirTendidos(ts: Tendido[]) {
  const total = ts.length
  const cortados = ts.filter((t) => t.cortado).length
  const suma = (f: (t: Tendido) => number | null) =>
    ts.reduce((s, t) => s + (f(t) ?? 0), 0)

  return {
    total,
    cortados,
    pendientes: total - cortados,
    yardasTeoricas: Math.round(suma((t) => t.tendido_total) * 100) / 100,
    yardasReales:
      Math.round(
        ts.filter((t) => t.cortado).reduce((s, t) => s + (t.yardas_reales ?? 0), 0) * 100
      ) / 100,
    piezas: suma((t) => t.total_pcs),
    piezasCortadas: ts
      .filter((t) => t.cortado)
      .reduce((s, t) => s + (t.piezas_cortadas ?? 0), 0),
    /** Telas distintas: si son varias, el consumo va a varias referencias. */
    telas: [...new Set(ts.map((t) => t.tela).filter(Boolean))] as string[],
  }
}
