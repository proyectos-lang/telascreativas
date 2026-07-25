/**
 * Fuente única de la métrica "días de proceso por área".
 *
 * Lee de la vista `telas.vista_lead_times_unificado` (una fila por pedido).
 * El criterio de negocio es único y compartido por el dashboard de Eficiencia
 * y la tabla de detalle de Indicadores:
 *   - Incluye 0 días (trabajos del mismo día) como desempeño real.
 *   - Excluye null (la etapa aún no terminó) y negativos (errores de captura).
 *
 * OJO: Number(null) === 0, por eso se valida el valor crudo antes de convertir.
 */

export const AREAS_LT = [
  "diseno",
  "corte",
  "impresion",
  "sublimacion",
  "costura",
] as const

export type AreaLT = (typeof AREAS_LT)[number]

export const AREA_LABEL_LT: Record<AreaLT, string> = {
  diseno: "Diseño",
  corte: "Corte",
  impresion: "Impresión",
  sublimacion: "Sublimación",
  costura: "Costura",
}

/** Columna de días por área en la vista unificada. */
export const DIAS_FIELD: Record<AreaLT, keyof LeadTimeUnificadoRow> = {
  diseno: "dias_en_diseno",
  corte: "dias_en_corte",
  impresion: "dias_en_impresion",
  sublimacion: "dias_en_sublimacion",
  costura: "dias_en_costura",
}

/** Columnas de recepción y fin por área (para mostrar/validar las fechas). */
export const FECHA_FIELDS: Record<
  AreaLT,
  { recep: keyof LeadTimeUnificadoRow; fin: keyof LeadTimeUnificadoRow }
> = {
  diseno: { recep: "dfecha_de_ingreso_diseno", fin: "dentrega_diseno" },
  corte: { recep: "cfecha_de_recepcion", fin: "cfecha_de_corte" },
  impresion: { recep: "ifecha_de_ingreso_imp", fin: "ientrega_impresion" },
  sublimacion: { recep: "sfecha_de_ingreso_sub", fin: "seta_sublimacion" },
  costura: { recep: "cosfecha_conteo", fin: "coseta_costura" },
}

export interface LeadTimeUnificadoRow {
  pedido: string
  cliente: string | null
  vendedora: string | null
  ciudad: string | null
  estilo_de_la_prenda: string | null
  pcs: number | null
  es_urgente: boolean | null
  estado_aprobado_rechazado: string | null
  fecha_de_ingreso: string | null
  fecha_de_entrega: string | null
  fecha_entrega_cliente: string | null
  entregado_cliente_si_no: boolean | null
  s_estado_entrega: string | null

  dfecha_de_ingreso_diseno: string | null
  dentrega_diseno: string | null
  cfecha_de_recepcion: string | null
  cfecha_de_corte: string | null
  ifecha_de_ingreso_imp: string | null
  ientrega_impresion: string | null
  sfecha_de_ingreso_sub: string | null
  seta_sublimacion: string | null
  cosfecha_conteo: string | null
  coseta_costura: string | null
  efecha_de_empaque: string | null

  dias_en_diseno: number | null
  dias_en_corte: number | null
  dias_en_impresion: number | null
  dias_en_sublimacion: number | null
  dias_en_costura: number | null

  lead_time_global: number | null

  en_proceso: boolean | null
  cerrado: boolean | null
}

/**
 * ¿La fila tiene un día válido para el área? (número real ≥ 0, no null).
 * Excluye null (no terminó) y negativos.
 */
export function tieneDias(r: LeadTimeUnificadoRow, area: AreaLT): boolean {
  const v = r[DIAS_FIELD[area]]
  return v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0
}

/**
 * Promedio de días por área sobre un conjunto de filas.
 * Devuelve el promedio (1 decimal), el conteo de órdenes contribuyentes y la suma.
 */
export function promedioDias(
  rows: LeadTimeUnificadoRow[],
  area: AreaLT
): { avg: number; n: number; sum: number } {
  const field = DIAS_FIELD[area]
  let sum = 0
  let n = 0
  for (const r of rows) {
    if (!tieneDias(r, area)) continue
    sum += Number(r[field])
    n += 1
  }
  return { avg: n > 0 ? +(sum / n).toFixed(1) : 0, n, sum }
}

/** Universo "en proceso" (vigente en planta): usa el flag de la vista. */
export function esEnProceso(r: LeadTimeUnificadoRow): boolean {
  return r.en_proceso === true
}
