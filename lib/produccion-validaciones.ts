/**
 * Predicados de flujo y utilidades para las validaciones/bloqueos de captura
 * de producción (cantidades por fase, máquina de costura, etc.).
 *
 * Centraliza los matices por `tipo_flujo_especial` para no duplicarlos en cada
 * modal. Reutilizable tanto con una orden guardada como con el "borrador" del
 * modal de Aprobación (que aún no persiste el flujo).
 */
import type { Orden } from "@/lib/types"

/** Normaliza un string de flujo a comparación robusta (case/espacios). */
function norm(v: unknown): string {
  return (v ?? "").toString().trim().toUpperCase()
}

/** True si la orden es de tipo YARDAJE. */
export function esYardaje(orden: Pick<Orden, "tipo_flujo_especial">): boolean {
  return norm(orden.tipo_flujo_especial) === "YARDAJE"
}

/**
 * Determina si una orden pasa por Costura según su flujo. Sirve con una orden
 * guardada o con el borrador del modal de Aprobación.
 * - COMPRA_EXTERNA / VENTA_INVENTARIO → no cosen.
 * - `costura_si_no === false` → no cose (yardaje sin costura o similar).
 * - El resto (PRODUCCION_NORMAL / YARDAJE, incl. solo_corte_costura) → sí.
 * (Nota: `omite_corte_costura` NO se usa aquí; los contexts no lo aplican.)
 */
export function pasaPorCostura(flujo: {
  tipo_flujo_especial?: string | null
  costura_si_no?: boolean | null
}): boolean {
  const t = norm(flujo.tipo_flujo_especial)
  if (t === "COMPRA_EXTERNA" || t === "VENTA_INVENTARIO") return false
  if (flujo.costura_si_no === false) return false
  return true
}

/**
 * Piezas esperadas al cerrar Costura: lo cortado si existe, si no el total del
 * pedido. Base para detectar merma (costurada < esperada).
 */
export function piezasEsperadas(
  orden: Pick<Orden, "cpiezas_cortadas" | "pcs">
): number {
  const cortadas = orden.cpiezas_cortadas
  if (typeof cortadas === "number" && cortadas > 0) return cortadas
  return orden.pcs
}

/** Parseo seguro de un input string a número (null si vacío/NaN). */
export function toNum(str: string | number | null | undefined): number | null {
  if (str === null || str === undefined || str === "") return null
  const n = typeof str === "number" ? str : Number(str)
  return Number.isNaN(n) ? null : n
}
