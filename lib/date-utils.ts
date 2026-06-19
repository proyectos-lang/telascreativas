/**
 * Date utilities for consistent formatting across the app.
 *
 * Background / the bug these helpers fix:
 * --------------------------------------------------------------
 * Postgres `DATE` columns come back from Supabase as `"YYYY-MM-DD"`
 * strings. When you do `new Date("2026-04-17")`, JavaScript parses
 * that as UTC midnight (`2026-04-17T00:00:00Z`).
 *
 * If you then call `.toLocaleDateString("es-CO", {...})` without
 * specifying a timezone, Node/browser will convert to the local TZ
 * (UTC-5 in Colombia), producing "16 de abril" instead of "17 de abril".
 *
 * The reliable fix is to always format with `timeZone: "UTC"`,
 * which makes the output match the stored DB value 1:1.
 *
 * For full `TIMESTAMPTZ` values (e.g. `"2026-04-17T15:30:00+00"`)
 * we also format in UTC so what the user sees matches the raw DB
 * value, not a shifted local time.
 */

type DateInput = string | Date | null | undefined

/**
 * Formats a date in short style: e.g. "17 abr 2026".
 * Safe against nullish inputs and invalid strings (returns fallback).
 */
export function formatDateShort(
  value: DateInput,
  fallback: string = "-"
): string {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Formats a date in long style: e.g. "17 de abril de 2026".
 * Used in detail/modal screens where the extra context helps.
 */
export function formatDateLong(
  value: DateInput,
  fallback: string = "-"
): string {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Formats a date+time in long style: e.g. "17 de abril de 2026, 14:30".
 * Used for audit/log fields such as `hora_entrega_cliente`.
 */
export function formatDateTimeLong(
  value: DateInput,
  fallback: string = "-"
): string {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

/**
 * Suma `daysToAdd` dias habiles a `dateString`.
 *
 * "Dia habil" = lunes a viernes (excluye sabado y domingo).
 * El conteo avanza dia a dia y solo incrementa el contador cuando el dia
 * candidato NO es sabado (6) ni domingo (0). El resultado nunca puede
 * caer en fin de semana porque el ultimo dia contabilizado siempre sera
 * lunes-viernes.
 *
 * Usa UTC para evitar corrimientos por zona horaria al parsear el string,
 * de forma consistente con el resto de fechas de la app.
 *
 * Se usa para calcular las fechas objetivo de cada area al aprobar o
 * reprogramar una orden:
 *   Diseno +3d | Corte +3d | Impresion +5d | Sublimacion +4d | Costura +6d
 */
export function addDaysSkippingSundays(
  dateString: string,
  daysToAdd: number
): string {
  if (!dateString) return ""

  const [y, m, d] = dateString.split("-").map(Number)
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1))

  let added = 0
  while (added < daysToAdd) {
    date.setUTCDate(date.getUTCDate() + 1)
    const dow = date.getUTCDay()
    // Solo contar lunes (1) a viernes (5); ignorar sabado (6) y domingo (0).
    if (dow !== 0 && dow !== 6) {
      added++
    }
  }

  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Devuelve la fecha de hoy en formato "YYYY-MM-DD" usando la hora local.
 * Util como fecha base cuando se revierte un rechazo y no hay una
 * fecha_programacion previa en la que apoyarse.
 */
export function getTodayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Cuenta los dias habiles transcurridos entre dos fechas (inclusive en
 * ambos extremos) saltandose los domingos (getUTCDay() === 0).
 *
 *   - Si `start === end` (mismo dia, no domingo) -> 1
 *   - Si `start === end` (mismo dia y es domingo) -> 0
 *   - Si end < start                              -> 0
 *   - Si alguno es invalido / nulo                -> null
 *
 * Acepta:
 *   - "YYYY-MM-DD"  (DATE de Postgres)
 *   - "YYYY-MM-DDTHH:mm:ss..."  (TIMESTAMP / TIMESTAMPTZ)
 *
 * Internamente normaliza a medianoche UTC para evitar corrimientos por
 * zona horaria del cliente, igual que el resto de helpers del archivo.
 *
 * Se usa para calcular automaticamente `stiempo_sublimacion`: dias
 * desde que la orden se recibio en Sublimacion (`sfecha_de_ingreso_sub`)
 * hasta el dia en que se termina, ignorando los domingos.
 */
export function getDaysBetweenSkippingSundays(
  start: DateInput,
  end: DateInput
): number | null {
  if (!start || !end) return null

  const toUTCDate = (value: string | Date): Date | null => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null
      return new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate()
        )
      )
    }
    // Tomamos solo la parte de la fecha (YYYY-MM-DD) para evitar
    // que la hora desplace al dia anterior/siguiente al pasar a UTC.
    const ymd = value.slice(0, 10)
    const [y, m, d] = ymd.split("-").map(Number)
    if (!y || !m || !d) return null
    return new Date(Date.UTC(y, m - 1, d))
  }

  const startDate = toUTCDate(start as string | Date)
  const endDate = toUTCDate(end as string | Date)
  if (!startDate || !endDate) return null
  if (endDate.getTime() < startDate.getTime()) return 0

  let count = 0
  const cursor = new Date(startDate.getTime())
  while (cursor.getTime() <= endDate.getTime()) {
    if (cursor.getUTCDay() !== 0) count++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

/**
 * Devuelve la cantidad de dias que faltan entre HOY (local) y la fecha
 * objetivo expresada como "YYYY-MM-DD" proveniente de un DATE de Postgres.
 *
 *  - `> 0`  ->  faltan N dias
 *  -   `0`  ->  vence hoy
 *  - `< 0`  ->  ya esta vencido por |N| dias
 *  - `null` ->  fecha invalida o no provista
 *
 * Ambos extremos se normalizan a medianoche UTC para que la diferencia
 * sea estable y no se desvie por la hora del dia / zona horaria del
 * cliente (mismo criterio que el resto de helpers de este archivo).
 */
export function getDaysUntil(
  dateString: string | undefined | null
): number | null {
  if (!dateString) return null

  const [y, m, d] = dateString.split("-").map(Number)
  if (!y || !m || !d) return null

  const target = Date.UTC(y, m - 1, d)

  const now = new Date()
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = target - todayUTC
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
