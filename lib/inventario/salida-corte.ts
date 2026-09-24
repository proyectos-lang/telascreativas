"use client"

/**
 * Salida de inventario generada por el cierre de Corte.
 *
 * Hasta ahora el descuento se capturaba a mano en Inventario, con el
 * motivo escrito a mano libre: en los movimientos existentes hay más de
 * cien formas de escribir "consumo ODT" y ninguna dice de qué pedido se
 * trata. Esto lo genera Corte al cerrar, con el pedido o el marker
 * pegado al movimiento.
 *
 * Por qué el cortador elige la tela en vez de deducirla: `detalleorden`
 * guarda el nombre pero no el color, y el inventario sí lo distingue
 * —SUPERSOFT tiene 14 variantes—. Además solo el 30% de los nombres
 * coincide entre ambos lados. Adivinar movería stock de la tela
 * equivocada, que es peor que no moverlo.
 */

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Factor de conversión usado en todo el módulo de inventario. */
const YARDAS_POR_METRO = 1.09361

export interface TelaInventario {
  id: number
  nombre: string
  color: string | null
  codigo: string | null
  stock_metros: number | null
  stock_yardas: number | null
}

export interface SalidaCorte {
  telaId: number
  /** Yardas consumidas; es lo que registra Corte. */
  yardas: number
  /** Pedido que causó el consumo. */
  pedido?: string | null
  /** Marker, cuando se cerró un core completo. */
  coreId?: number | null
  usuario?: string | null
  /** Texto extra para el motivo; el pedido ya va en su columna. */
  nota?: string | null
}

export interface ResultadoSalida {
  success: boolean
  error?: string
  /** True si el descuento dejó la tela en negativo. */
  quedoNegativo?: boolean
  stockFinalYardas?: number
}

export async function cargarTelasInventario(): Promise<TelaInventario[]> {
  const { data } = await supabase
    .schema("telas")
    .from("inventario_telas")
    .select("id, nombre, color, codigo, stock_metros, stock_yardas")
    .order("nombre")
  return (data as TelaInventario[]) ?? []
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Registra el descuento y actualiza el stock.
 *
 * Replica el patrón que ya usa el módulo de Inventario: insertar el
 * movimiento y después actualizar la tela. No hay trigger en la base, y
 * hacerlo distinto aquí dejaría los dos caminos desincronizados.
 *
 * El stock SÍ puede quedar negativo. Es deliberado: la tela se consumió
 * de verdad, y un negativo señala que falta registrar un ingreso. Se
 * informa para que quien cierra el corte lo vea, pero no se bloquea la
 * producción por un dato de inventario sin capturar.
 */
export async function registrarSalidaCorte(
  s: SalidaCorte
): Promise<ResultadoSalida> {
  if (!s.telaId) return { success: false, error: "Falta elegir la tela." }
  if (!Number.isFinite(s.yardas) || s.yardas <= 0)
    return { success: false, error: "Las yardas deben ser mayores que cero." }

  const { data: tela, error: errTela } = await supabase
    .schema("telas")
    .from("inventario_telas")
    .select("id, nombre, color, stock_metros, stock_yardas")
    .eq("id", s.telaId)
    .single()

  if (errTela || !tela)
    return { success: false, error: errTela?.message ?? "Tela no encontrada." }

  const t = tela as TelaInventario
  const yardas = Math.round(s.yardas * 100) / 100
  const metros = Math.round((yardas / YARDAS_POR_METRO) * 100) / 100

  // El motivo se arma solo: el pedido y el core viajan en sus columnas,
  // así que aquí solo va lo que ayuda a leerlo de un vistazo.
  const partes = ["Consumo de corte"]
  if (s.pedido) partes.push(`pedido ${s.pedido}`)
  if (s.nota?.trim()) partes.push(s.nota.trim())

  const { error: errMov } = await supabase
    .schema("telas")
    .from("inventario_movimientos")
    .insert({
      tela_id: s.telaId,
      tipo_movimiento: "DESCUENTO",
      cantidad_metros: metros,
      cantidad_yardas: yardas,
      motivo: partes.join(" · "),
      usuario: s.usuario ?? null,
      pedido: s.pedido ?? null,
      core_id: s.coreId ?? null,
      automatico: true,
    })

  if (errMov) return { success: false, error: errMov.message }

  const stockYardas = Math.round((num(t.stock_yardas) - yardas) * 100) / 100
  const stockMetros = Math.round((num(t.stock_metros) - metros) * 100) / 100

  const { error: errUpd } = await supabase
    .schema("telas")
    .from("inventario_telas")
    .update({ stock_metros: stockMetros, stock_yardas: stockYardas })
    .eq("id", s.telaId)

  if (errUpd) {
    // El movimiento ya quedó escrito. Se informa en vez de intentar
    // deshacerlo: borrarlo perdería el registro de que la tela salió, y
    // el stock se puede corregir con un ajuste.
    return {
      success: false,
      error: `Se registró el movimiento pero no se pudo actualizar el stock: ${errUpd.message}`,
    }
  }

  return {
    success: true,
    quedoNegativo: stockYardas < 0,
    stockFinalYardas: stockYardas,
  }
}

/**
 * Reparte el consumo de un core entre varias telas.
 *
 * Un marker agrupa órdenes que comparten tela, pero puede llevar más de
 * una: se registra una salida por cada una y se informa de las que
 * fallen sin abortar el resto, porque un fallo en la última no debería
 * deshacer las anteriores.
 */
export async function registrarSalidasCore(
  salidas: SalidaCorte[]
): Promise<{ registradas: number; errores: string[]; negativas: string[] }> {
  const errores: string[] = []
  const negativas: string[] = []
  let registradas = 0

  for (const s of salidas) {
    const r = await registrarSalidaCorte(s)
    if (r.success) {
      registradas++
      if (r.quedoNegativo) negativas.push(String(s.telaId))
    } else {
      errores.push(r.error ?? "error desconocido")
    }
  }
  return { registradas, errores, negativas }
}
