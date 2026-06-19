import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Cliente Supabase (mismo patron que el resto de modulos del proyecto)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---------------------------------------------------------------------------
// Paleta ejecutiva corporativa para los graficos de Recharts.
// Azul Marino, Teal, Esmeralda, Ambar, Rojo Coral (alertas) + Azul.
// ---------------------------------------------------------------------------
export const PALETA = {
  navy: "#1e3a5f",
  blue: "#2563eb",
  teal: "#0d9488",
  emerald: "#059669",
  amber: "#d97706",
  coral: "#e11d48",
  slate: "#64748b",
  indigo: "#4f46e5",
} as const

/** Secuencia de colores para series con varias categorias (areas, etc.). */
export const SERIE_COLORS = [
  PALETA.navy,
  PALETA.teal,
  PALETA.emerald,
  PALETA.amber,
  PALETA.coral,
  PALETA.indigo,
]

// ---------------------------------------------------------------------------
// Tipos de las 4 vistas analiticas (telas.*)
// ---------------------------------------------------------------------------
interface Periodo {
  ano: number | null
  mes: number | null
  semana: number | null
}

export interface KpiDisenoRow extends Periodo {
  disenador: string | null
  // El nombre real de la columna en la vista lleva ñ (diseños_entregados).
  diseños_entregados: number | null
  porcentaje_alcance: number | null
  bono_ganado: number | null
  total_incidencias: number | null
  entregas_a_tiempo: number | null
  porcentaje_cumplimiento: number | null
}

export interface KpiAdherenciaRow extends Periodo {
  total_ordenes: number | null
  adherencia_diseno: number | null
  adherencia_impresion: number | null
  adherencia_sublimacion: number | null
  adherencia_corte: number | null
  adherencia_costura: number | null
  adherencia_empaque: number | null
  cumplidos_global: number | null
  adherencia_global: number | null
}

export interface KpiLeadTimeRow extends Periodo {
  lead_time_global_promedio: number | null
  dias_en_diseno: number | null
  dias_en_impresion: number | null
  dias_en_sublimacion: number | null
  dias_en_corte: number | null
  dias_en_costura: number | null
  dias_en_empaque: number | null
  cola_diseno_a_impresion: number | null
  cola_impresion_a_sublimacion: number | null
  cola_sublimacion_a_corte: number | null
  cola_corte_a_costura: number | null
  cola_costura_a_empaque: number | null
}

export interface KpiReprocesoRow extends Periodo {
  area_responsable: string | null
  total_piezas_entregadas: number | null
  cantidad_incidencias_reportadas: number | null
  porcentaje_calidad_cumplimiento: number | null
  top_parte_afectada: string | null
  top_talla_error: string | null
  top_genero_error: string | null
  top_motivo_critico: string | null
}

// ---------------------------------------------------------------------------
// Filtro global compartido
// ---------------------------------------------------------------------------
export const MES_TODOS = 0 // sentinel: "Ver todo el año"

export interface IndicadoresFiltro {
  ano: number
  mes: number // 0 = todo el año, 1..12
  semanas: number[] // [] = todas las semanas; [1,3,5] = semanas específicas
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

// ---------------------------------------------------------------------------
// Helpers numericos / de formato
// ---------------------------------------------------------------------------
export function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === "number" ? v : Number.parseFloat(String(v))
  return Number.isFinite(n) ? n : 0
}

const intFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 })
const decFmt = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
// Lempiras hondureños (HNL). Se usa prefijo explicito "L" para garantizar el
// simbolo correcto independientemente del locale del navegador.
const moneyNumFmt = new Intl.NumberFormat("es-HN", {
  maximumFractionDigits: 0,
})
const moneyFmt = {
  format: (v: number) => `L ${moneyNumFmt.format(v)}`,
}

export const fmtInt = (v: number | string | null | undefined) =>
  intFmt.format(num(v))
export const fmtDec = (v: number | string | null | undefined) =>
  decFmt.format(num(v))
export const fmtPct = (v: number | string | null | undefined) =>
  `${decFmt.format(num(v))}%`
export const fmtMoney = (v: number | string | null | undefined) =>
  moneyFmt.format(num(v))
export const fmtDias = (v: number | string | null | undefined) =>
  `${decFmt.format(num(v))} d`

/** Etiqueta corta de periodo para ejes/agrupaciones. */
export function periodoLabel(
  filtro: IndicadoresFiltro,
  row: Periodo
): string {
  // Cuando se ve todo el año agrupamos por mes; si hay mes fijo, por semana.
  if (filtro.mes === MES_TODOS) {
    const m = num(row.mes)
    return m >= 1 && m <= 12 ? MESES[m - 1].slice(0, 3) : "—"
  }
  const s = num(row.semana)
  return s > 0 ? `Sem ${s}` : "—"
}

/** Promedio simple ignorando nulos. */
export function avg(values: (number | null | undefined)[]): number {
  const nums = values.map(num)
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
