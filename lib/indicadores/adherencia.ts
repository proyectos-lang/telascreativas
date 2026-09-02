/**
 * Las dos adherencias del negocio.
 *
 * Una orden se compromete con el cliente en `fecha_de_entrega`. Ese compromiso
 * se puede medir contra dos hitos distintos, y son cosas diferentes:
 *
 *  - ADHERENCIA OPERATIVA (planta): `efecha_de_empaque <= fecha_de_entrega`.
 *    Mide si producción terminó a tiempo. Es responsabilidad de la planta y
 *    no depende de la logística de entrega.
 *
 *  - ADHERENCIA FINAL (negocio): `fecha_entrega_cliente <= fecha_de_entrega`.
 *    Mide si el cliente recibió a tiempo. Solo aplica a órdenes ya entregadas.
 *
 * La diferencia entre ambas es el tiempo que se pierde DESPUÉS de empacar.
 *
 * El periodo de una orden lo define su fecha de EMPAQUE, no la de entrega.
 * Es el mismo criterio de `telas.vista_kpi_adherencia`: se verificó que su
 * `total_ordenes` y `cumplidos_global` reproducen exactamente el universo
 * "empacadas en el periodo" y la regla operativa, semana por semana.
 */

import { fetchAll } from "@/lib/fetch-all"
import { supabase } from "@/components/indicadores/shared"

export interface OrdenAdherencia {
  pedido: string | null
  cliente: string | null
  estilo_de_la_prenda: string | null
  pcs: number | null
  /** Compromiso con el cliente. */
  fecha_de_entrega: string | null
  /** Fin de Empaque: define el periodo y la adherencia operativa. */
  efecha_de_empaque: string | null
  /** Entrega real al cliente: define la adherencia final. */
  fecha_entrega_cliente: string | null
  entregado_cliente_si_no: boolean | null
}

const COLUMNAS =
  "pedido, cliente, estilo_de_la_prenda, pcs, fecha_de_entrega, " +
  "efecha_de_empaque, fecha_entrega_cliente, entregado_cliente_si_no"

/** "YYYY-MM-DD..." -> 20260824, comparable como número. Null si no aplica. */
export function dayNum(value: string | null | undefined): number | null {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  return y * 10000 + m * 100 + d
}

export const esVerdadero = (v: unknown) =>
  v === true || String(v ?? "").trim().toLowerCase() === "true"

/** Semana ISO-8601 de una fecha "YYYY-MM-DD" (misma que usa la vista). */
export function semanaISODe(value: string): number | null {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  const x = new Date(Date.UTC(y, m - 1, d))
  const dow = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - dow + 3) // jueves de esa semana
  const primerJueves = new Date(Date.UTC(x.getUTCFullYear(), 0, 4))
  const pj = (primerJueves.getUTCDay() + 6) % 7
  primerJueves.setUTCDate(primerJueves.getUTCDate() - pj + 3)
  return (
    1 + Math.round((x.getTime() - primerJueves.getTime()) / (7 * 86400000))
  )
}

/** Clasificación de una orden bajo las dos reglas. */
export interface Clasificacion {
  /** Empacada dentro del compromiso. */
  operativaATiempo: boolean
  /** Ya entregada al cliente (si no, la final no aplica). */
  entregada: boolean
  /** Entregada dentro del compromiso. Solo válido si `entregada`. */
  finalATiempo: boolean
  /** Salió a tiempo de planta pero llegó tarde al cliente. */
  perdidaEnEntrega: boolean
}

export function clasificar(o: OrdenAdherencia): Clasificacion {
  const compromiso = dayNum(o.fecha_de_entrega)
  const empaque = dayNum(o.efecha_de_empaque)
  const entrega = dayNum(o.fecha_entrega_cliente)

  const operativaATiempo =
    compromiso !== null && empaque !== null && empaque <= compromiso
  const entregada = esVerdadero(o.entregado_cliente_si_no) && entrega !== null
  const finalATiempo =
    entregada && compromiso !== null && entrega! <= compromiso
  return {
    operativaATiempo,
    entregada,
    finalATiempo,
    perdidaEnEntrega: operativaATiempo && entregada && !finalATiempo,
  }
}

export interface ResumenAdherencia {
  /** Órdenes empacadas en el periodo. Denominador de la operativa. */
  total: number
  operativaATiempo: number
  /** % operativo sobre el total empacado. */
  operativa: number
  /** Subconjunto ya entregado. Denominador de la final. */
  entregadas: number
  finalATiempo: number
  /** % final sobre las entregadas (no sobre el total). */
  final: number
  /** Empacadas a tiempo que aun asi llegaron tarde al cliente. */
  perdidasEnEntrega: number
}

export function resumir(ordenes: OrdenAdherencia[]): ResumenAdherencia {
  let operativaATiempo = 0
  let entregadas = 0
  let finalATiempo = 0
  let perdidasEnEntrega = 0
  for (const o of ordenes) {
    const c = clasificar(o)
    if (c.operativaATiempo) operativaATiempo++
    if (c.entregada) entregadas++
    if (c.finalATiempo) finalATiempo++
    if (c.perdidaEnEntrega) perdidasEnEntrega++
  }
  const total = ordenes.length
  return {
    total,
    operativaATiempo,
    operativa: total > 0 ? (operativaATiempo / total) * 100 : 0,
    entregadas,
    finalATiempo,
    final: entregadas > 0 ? (finalATiempo / entregadas) * 100 : 0,
    perdidasEnEntrega,
  }
}

/**
 * Trae las órdenes empacadas en un año. Pagina con `fetchAll`: `cabecera` ya
 * supera las 1000 filas que devuelve Supabase por consulta, y truncarla
 * falsea el indicador en silencio.
 */
export async function cargarOrdenesEmpacadas(
  ano: number
): Promise<{ data: OrdenAdherencia[]; error: string | null }> {
  const { data, error } = await fetchAll<OrdenAdherencia>((from, to) =>
    supabase
      .schema("telas")
      .from("cabecera")
      .select(COLUMNAS)
      .gte("efecha_de_empaque", `${ano}-01-01`)
      .lte("efecha_de_empaque", `${ano}-12-31`)
      .range(from, to) as unknown as PromiseLike<{
      data: OrdenAdherencia[] | null
      error: { message: string } | null
    }>
  )
  return { data: data ?? [], error: error?.message ?? null }
}

/** Mes (1-12) de la fecha de empaque, o null. */
export function mesDeEmpaque(o: OrdenAdherencia): number | null {
  if (!o.efecha_de_empaque) return null
  const m = Number(String(o.efecha_de_empaque).slice(5, 7))
  return m >= 1 && m <= 12 ? m : null
}

/** Semana ISO de la fecha de empaque, o null. */
export function semanaDeEmpaque(o: OrdenAdherencia): number | null {
  if (!o.efecha_de_empaque) return null
  return semanaISODe(String(o.efecha_de_empaque))
}
