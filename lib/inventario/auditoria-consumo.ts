/**
 * Auditoría de consumo de tela: lo que el marker proyectó contra lo que
 * Corte gastó de verdad.
 *
 * `mdyardas_teoricas` sale del trazo digital y se reparte entre las
 * órdenes del core según sus piezas; `cyardas` lo registra el cortador al
 * cerrar. Comparar ambas es lo que dice si el trazo está bien calculado o
 * si en la mesa se está gastando de más.
 *
 * Dos advertencias que condicionan la lectura de estos números:
 *
 *  1. Solo se puede comparar lo que tiene AMBAS cifras. Hoy son pocas
 *     órdenes: `cyardas` lleva tiempo registrándose, pero
 *     `mdyardas_teoricas` solo existe desde que hay Marker Digital. Por
 *     eso el resumen distingue siempre "comparables" de "con consumo
 *     real", y nunca presenta un total como si cubriera todo.
 *
 *  2. La tela de una orden no está en `cabecera`: se deduce de
 *     `detalleorden`, tomando la mayoritaria en piezas, igual que hace el
 *     motor de cores. Una orden sin detalle utilizable queda agrupada
 *     como "Sin tela".
 */

import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import { normalizarTela } from "@/lib/marker/cores"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Etiqueta para las órdenes cuyo detalle no dice de qué tela son. */
export const SIN_TELA = "Sin tela"

export interface FilaAuditoria {
  pedido: string
  cliente: string | null
  fechaCorte: string | null
  semana: number | null
  tela: string
  piezasCortadas: number | null
  /** Yardas proyectadas por el marker. Null si la orden no pasó por él. */
  teoricas: number | null
  /** Yardas registradas por Corte al cerrar. */
  reales: number | null
  coreId: number | null
  coreNombre: string | null
  /** reales - teoricas. Positivo = se gastó de más. */
  diferencia: number | null
  /** Desviación en % sobre lo teórico. */
  desvio: number | null
}

export interface ResumenAuditoria {
  /** Órdenes cortadas en el periodo. */
  cortadas: number
  /** De esas, cuántas tienen yardas reales registradas. */
  conReal: number
  /** Cuántas se pueden comparar (tienen teóricas Y reales). */
  comparables: number
  totalTeorico: number
  totalReal: number
  /** Desviación global sobre lo teórico, solo de las comparables. */
  desvioGlobal: number | null
  /** Comparables que gastaron más de lo proyectado. */
  porEncima: number
  porDebajo: number
  /** Dentro de la tolerancia: ni sobre ni subconsumo relevante. */
  enRango: number
}

export interface ConsumoPorTela {
  tela: string
  ordenes: number
  /** Yardas reales gastadas. Incluye órdenes sin teórico. */
  real: number
  /** Teórico solo de las órdenes comparables de esta tela. */
  teorico: number
  comparables: number
  desvio: number | null
}

export interface ConsumoPorSemana {
  semana: number
  ordenes: number
  real: number
  teorico: number
  comparables: number
}

/**
 * Tolerancia por defecto, en porcentaje.
 *
 * Un trazo nunca calza exacto con la mesa: hay orillos, empates y merma
 * inevitable. Marcar como desviación cualquier diferencia convertiría el
 * informe en ruido, así que solo se señala lo que sale de este margen.
 * Es ajustable desde la pantalla porque el margen razonable depende del
 * tipo de tela y lo sabe producción, no el código.
 */
export const TOLERANCIA_POR_DEFECTO = 5

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

interface FilaCabecera {
  pedido: string
  cliente: string | null
  cfecha_de_corte: string | null
  csemana_de_corte: number | string | null
  cpiezas_cortadas: number | string | null
  cyardas: number | string | null
  mdyardas_teoricas: number | string | null
  mdcore_id: number | null
}

interface LineaDetalle {
  pedido: string
  tela: string | null
  pcs: number | string | null
}

/**
 * Carga las órdenes cortadas y les resuelve la tela.
 *
 * Se pagina con `fetchAll` porque Supabase corta en 1000 filas y hay más
 * de 1300 órdenes cortadas: sin paginar, los totales saldrían recortados
 * en silencio, que es la peor forma de equivocarse en un informe.
 */
export async function cargarAuditoria(): Promise<FilaAuditoria[]> {
  const { data: cab } = await fetchAll<FilaCabecera>((from, to) =>
    supabase
      .schema("telas")
      .from("cabecera")
      .select(
        "pedido, cliente, cfecha_de_corte, csemana_de_corte, cpiezas_cortadas, cyardas, mdyardas_teoricas, mdcore_id"
      )
      .not("cfecha_de_corte", "is", null)
      .range(from, to) as unknown as PromiseLike<{
      data: FilaCabecera[] | null
      error: { message: string } | null
    }>
  )

  const ordenes = cab ?? []
  if (ordenes.length === 0) return []

  const { data: det } = await fetchAll<LineaDetalle>((from, to) =>
    supabase
      .schema("telas")
      .from("detalleorden")
      .select("pedido, tela, pcs")
      .range(from, to) as unknown as PromiseLike<{
      data: LineaDetalle[] | null
      error: { message: string } | null
    }>
  )

  // Tela mayoritaria en piezas por pedido, igual criterio que los cores.
  const porPedido = new Map<string, Map<string, number>>()
  for (const l of det ?? []) {
    const t = normalizarTela(l.tela)
    if (!t || t === "NA" || t === "N A") continue
    const m = porPedido.get(l.pedido) ?? new Map<string, number>()
    m.set(t, (m.get(t) ?? 0) + (num(l.pcs) ?? 0))
    porPedido.set(l.pedido, m)
  }

  const nombresCore = await cargarNombresCore()

  return ordenes.map((o) => {
    const telas = porPedido.get(o.pedido)
    const tela = telas
      ? [...telas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
      : SIN_TELA

    const teoricas = num(o.mdyardas_teoricas)
    const reales = num(o.cyardas)
    // La diferencia solo tiene sentido con ambas cifras; y el porcentaje
    // además necesita un teórico distinto de cero.
    const diferencia =
      teoricas !== null && reales !== null ? reales - teoricas : null
    const desvio =
      diferencia !== null && teoricas !== null && teoricas !== 0
        ? (diferencia / teoricas) * 100
        : null

    return {
      pedido: o.pedido,
      cliente: o.cliente,
      fechaCorte: o.cfecha_de_corte ? String(o.cfecha_de_corte).slice(0, 10) : null,
      semana: num(o.csemana_de_corte),
      tela,
      piezasCortadas: num(o.cpiezas_cortadas),
      teoricas,
      reales,
      coreId: o.mdcore_id,
      coreNombre: o.mdcore_id ? nombresCore.get(o.mdcore_id) ?? null : null,
      diferencia,
      desvio,
    }
  })
}

async function cargarNombresCore(): Promise<Map<number, string>> {
  const { data } = await supabase
    .schema("telas")
    .from("marker_cores")
    .select("id, nombre")
  const m = new Map<number, string>()
  for (const c of (data as { id: number; nombre: string }[]) ?? [])
    m.set(c.id, c.nombre)
  return m
}

export function resumir(
  filas: FilaAuditoria[],
  tolerancia = TOLERANCIA_POR_DEFECTO
): ResumenAuditoria {
  const comparables = filas.filter((f) => f.diferencia !== null)
  const totalTeorico = comparables.reduce((s, f) => s + (f.teoricas ?? 0), 0)
  const totalReal = comparables.reduce((s, f) => s + (f.reales ?? 0), 0)

  return {
    cortadas: filas.length,
    conReal: filas.filter((f) => f.reales !== null).length,
    comparables: comparables.length,
    totalTeorico,
    totalReal,
    desvioGlobal:
      totalTeorico > 0 ? ((totalReal - totalTeorico) / totalTeorico) * 100 : null,
    porEncima: comparables.filter((f) => (f.desvio ?? 0) > tolerancia).length,
    porDebajo: comparables.filter((f) => (f.desvio ?? 0) < -tolerancia).length,
    enRango: comparables.filter((f) => Math.abs(f.desvio ?? 0) <= tolerancia)
      .length,
  }
}

export function consumoPorTela(filas: FilaAuditoria[]): ConsumoPorTela[] {
  const m = new Map<string, ConsumoPorTela>()
  for (const f of filas) {
    if (f.reales === null && f.teoricas === null) continue
    const e =
      m.get(f.tela) ??
      { tela: f.tela, ordenes: 0, real: 0, teorico: 0, comparables: 0, desvio: null }
    e.ordenes++
    e.real += f.reales ?? 0
    // El teórico solo suma cuando la orden es comparable: si no, el
    // porcentaje mezclaría un real completo con un teórico parcial y
    // exageraría el sobreconsumo.
    if (f.diferencia !== null) {
      e.teorico += f.teoricas ?? 0
      e.comparables++
    }
    m.set(f.tela, e)
  }

  for (const e of m.values()) {
    const realComparable = filas
      .filter((f) => f.tela === e.tela && f.diferencia !== null)
      .reduce((s, f) => s + (f.reales ?? 0), 0)
    e.desvio =
      e.teorico > 0 ? ((realComparable - e.teorico) / e.teorico) * 100 : null
  }

  return [...m.values()].sort((a, b) => b.real - a.real)
}

export function consumoPorSemana(filas: FilaAuditoria[]): ConsumoPorSemana[] {
  const m = new Map<number, ConsumoPorSemana>()
  for (const f of filas) {
    if (f.semana === null || f.reales === null) continue
    const e =
      m.get(f.semana) ??
      { semana: f.semana, ordenes: 0, real: 0, teorico: 0, comparables: 0 }
    e.ordenes++
    e.real += f.reales
    if (f.diferencia !== null) {
      e.teorico += f.teoricas ?? 0
      e.comparables++
    }
    m.set(f.semana, e)
  }
  return [...m.values()].sort((a, b) => a.semana - b.semana)
}
