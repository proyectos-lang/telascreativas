import { Orden } from "@/lib/types"

/**
 * Helpers que derivan el estado actual de una orden en cada area de produccion.
 *
 * La logica replica lo usado en los componentes `*-table.tsx`:
 *   - Terminado: ya hay fecha/marca de entrega del area
 *   - Recibido / En Proceso: ya hay fecha de ingreso pero no de salida
 *   - Pendiente: aun no ha ingresado al area
 *
 * Estas funciones se usan tanto en las tablas como en los filtros para
 * garantizar que el Select "Estado" y el badge mostrado en la tabla
 * siempre concuerden.
 */

export type ProductionStatus = "Pendiente" | "Recibido" | "Terminado"
export type EmpaqueStatus = "Pendiente" | "En Proceso" | "Terminado"

export function getDisenoStatus(orden: Orden): ProductionStatus {
  if (orden.dentrega_diseno) return "Terminado"
  if (orden.dfecha_de_ingreso_diseno) return "Recibido"
  return "Pendiente"
}

export function getCorteStatus(orden: Orden): ProductionStatus {
  if (orden.cfecha_de_corte) return "Terminado"
  if (orden.cfecha_de_recepcion) return "Recibido"
  return "Pendiente"
}

export function getImpresionStatus(orden: Orden): ProductionStatus {
  if (orden.ientrega_impresion) return "Terminado"
  if (orden.ifecha_de_ingreso_imp) return "Recibido"
  return "Pendiente"
}

export function getSublimacionStatus(orden: Orden): ProductionStatus {
  if (orden.seta_sublimacion) return "Terminado"
  if (orden.sfecha_de_ingreso_sub) return "Recibido"
  return "Pendiente"
}

export function getCosturaStatus(orden: Orden): ProductionStatus {
  if (orden.coseta_costura) return "Terminado"
  if (orden.cosfecha_conteo) return "Recibido"
  return "Pendiente"
}

export function getEmpaqueStatus(orden: Orden): EmpaqueStatus {
  if (orden.efecha_de_empaque) return "Terminado"
  if (orden.enombre_de_quien_empaca) return "En Proceso"
  return "Pendiente"
}
