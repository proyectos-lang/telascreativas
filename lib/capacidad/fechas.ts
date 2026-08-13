/**
 * Helpers de fecha/semana del módulo Capacidad (UTC, coherentes con el resto
 * de la app). Jornada laboral: Lunes a Sábado (domingo no laboral).
 */

export const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
]

/** Parsea "YYYY-MM-DD" (o ISO con hora) a Date UTC a medianoche. Null si inválido. */
export function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

/** Hoy como Date UTC a medianoche (según la fecha local del navegador). */
export function hoyUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

/** True si el día es laboral (Lun–Sáb; domingo no). */
export function esLaboral(d: Date): boolean {
  return d.getUTCDay() !== 0
}

/** El mismo día si es laboral; si no (domingo), el lunes siguiente. */
export function siguienteHabil(d: Date): Date {
  let x = new Date(d.getTime())
  while (!esLaboral(x)) x = addDaysUTC(x, 1)
  return x
}

/** Suma n días hábiles (Lun–Sáb) a partir de d (sin contar d). */
export function addHabiles(d: Date, n: number): Date {
  let x = new Date(d.getTime())
  let restantes = n
  while (restantes > 0) {
    x = addDaysUTC(x, 1)
    if (esLaboral(x)) restantes--
  }
  return x
}

/** Lista los próximos n días hábiles empezando en `desde` (incluido si es hábil). */
export function listarHabiles(desde: Date, n: number): Date[] {
  const dias: Date[] = []
  let x = siguienteHabil(desde)
  while (dias.length < n) {
    dias.push(x)
    x = siguienteHabil(addDaysUTC(x, 1))
  }
  return dias
}

/** Lunes (inicio ISO) de la semana que contiene `d`. */
export function lunesDeSemana(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Lun=0 … Dom=6
  return addDaysUTC(x, -dow)
}

/** Número de semana ISO-8601 y su año. */
export function semanaISO(d: Date): { ano: number; numero: number } {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - dayNum + 3) // jueves de esta semana
  const ano = x.getUTCFullYear()
  const primerJueves = new Date(Date.UTC(ano, 0, 4))
  const pjNum = (primerJueves.getUTCDay() + 6) % 7
  primerJueves.setUTCDate(primerJueves.getUTCDate() - pjNum + 3)
  const numero = 1 + Math.round((x.getTime() - primerJueves.getTime()) / (7 * 86400000))
  return { ano, numero }
}

/** "12 ago" */
export function fmtDia(d: Date): string {
  return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`
}

/** "sáb 12 ago" */
export function fmtDiaSemana(d: Date): string {
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`
}

/** Conversión segura de pcs (number | string | null) a número. */
export function toPcs(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
