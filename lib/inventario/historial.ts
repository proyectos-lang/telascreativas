"use client"

/**
 * Historial de movimientos de inventario.
 *
 * Reúne ingresos y salidas de tela con su contexto: qué tela, cuánto,
 * cuándo, quién y —en las salidas automáticas— a qué pedido y cliente
 * corresponden.
 *
 * Ese último dato es el que antes no existía. Los movimientos capturados
 * a mano solo dejaban el motivo en texto libre, y hay más de cien formas
 * de escribir "consumo ODT" sin decir de qué orden se trata. Los que
 * genera Corte al cerrar sí traen el pedido, así que el historial
 * distingue unos de otros en vez de presentarlos como equivalentes.
 */

import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type TipoMovimiento = "INGRESO" | "DESCUENTO"

export interface MovimientoHistorial {
  id: number
  fecha: string
  tipo: TipoMovimiento
  /** Nombre y color de la tela, ya resueltos. */
  tela: string
  telaId: number | null
  yardas: number
  metros: number
  motivo: string | null
  usuario: string | null
  /** Pedido al que se cargó la salida. Null en las capturas a mano. */
  pedido: string | null
  cliente: string | null
  coreId: number | null
  coreNombre: string | null
  tendidoId: number | null
  /** True si lo generó el cierre de Corte o Sublimación. */
  automatico: boolean
}

export interface ResumenHistorial {
  movimientos: number
  ingresos: number
  salidas: number
  yardasIngreso: number
  yardasSalida: number
  /** Ingresos menos salidas: cuánta tela entró de más en el periodo. */
  neto: number
  /** Salidas con pedido identificado, sobre el total de salidas. */
  salidasTrazables: number
}

interface FilaMovimiento {
  id: number
  tela_id: number | null
  tipo_movimiento: string
  motivo: string | null
  usuario: string | null
  fecha_movimiento: string
  cantidad_metros: number | string | null
  cantidad_yardas: number | string | null
  pedido: string | null
  core_id: number | null
  tendido_id: number | null
  automatico: boolean | null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Carga el historial completo con su contexto.
 *
 * Se pagina con `fetchAll` porque Supabase corta en 1000 filas: hoy hay
 * 389 movimientos, pero crecen con cada corte y un historial recortado
 * en silencio es peor que no tenerlo.
 */
export async function cargarHistorial(): Promise<MovimientoHistorial[]> {
  const { data: movs } = await fetchAll<FilaMovimiento>((from, to) =>
    supabase
      .schema("telas")
      .from("inventario_movimientos")
      .select("*")
      .order("fecha_movimiento", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{
      data: FilaMovimiento[] | null
      error: { message: string } | null
    }>
  )

  const filas = movs ?? []
  if (filas.length === 0) return []

  // Telas y cores son catálogos pequeños: se traen enteros.
  const [{ data: telas }, { data: cores }] = await Promise.all([
    supabase
      .schema("telas")
      .from("inventario_telas")
      .select("id, nombre, color"),
    supabase.schema("telas").from("marker_cores").select("id, nombre"),
  ])

  const nombreTela = new Map<number, string>()
  for (const t of (telas as { id: number; nombre: string; color: string | null }[]) ?? [])
    nombreTela.set(t.id, `${t.nombre}${t.color ? ` · ${t.color}` : ""}`)

  const nombreCore = new Map<number, string>()
  for (const c of (cores as { id: number; nombre: string }[]) ?? [])
    nombreCore.set(c.id, c.nombre)

  // El cliente se busca solo para los pedidos que aparecen, no para toda
  // la cabecera: hoy son 34 de 389 movimientos.
  const pedidos = [...new Set(filas.map((f) => f.pedido).filter(Boolean))] as string[]
  const cliente = new Map<string, string | null>()
  if (pedidos.length > 0) {
    // En bloques: una lista muy larga desbordaría la URL.
    for (let i = 0; i < pedidos.length; i += 100) {
      const { data } = await supabase
        .schema("telas")
        .from("cabecera")
        .select("pedido, cliente")
        .in("pedido", pedidos.slice(i, i + 100))
      for (const o of (data as { pedido: string; cliente: string | null }[]) ?? [])
        cliente.set(o.pedido, o.cliente)
    }
  }

  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha_movimiento,
    tipo: (f.tipo_movimiento === "INGRESO" ? "INGRESO" : "DESCUENTO") as TipoMovimiento,
    tela: f.tela_id ? nombreTela.get(f.tela_id) ?? `Tela #${f.tela_id}` : "—",
    telaId: f.tela_id,
    yardas: num(f.cantidad_yardas),
    metros: num(f.cantidad_metros),
    motivo: f.motivo,
    usuario: f.usuario,
    pedido: f.pedido,
    cliente: f.pedido ? cliente.get(f.pedido) ?? null : null,
    coreId: f.core_id,
    coreNombre: f.core_id ? nombreCore.get(f.core_id) ?? null : null,
    tendidoId: f.tendido_id,
    automatico: f.automatico === true,
  }))
}

export function resumirHistorial(ms: MovimientoHistorial[]): ResumenHistorial {
  const ingresos = ms.filter((m) => m.tipo === "INGRESO")
  const salidas = ms.filter((m) => m.tipo === "DESCUENTO")
  const suma = (xs: MovimientoHistorial[]) =>
    Math.round(xs.reduce((s, m) => s + m.yardas, 0) * 100) / 100

  const yIn = suma(ingresos)
  const yOut = suma(salidas)

  return {
    movimientos: ms.length,
    ingresos: ingresos.length,
    salidas: salidas.length,
    yardasIngreso: yIn,
    yardasSalida: yOut,
    neto: Math.round((yIn - yOut) * 100) / 100,
    salidasTrazables: salidas.filter((m) => m.pedido).length,
  }
}
