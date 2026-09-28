"use client"

/**
 * Alertas de compra de tela.
 *
 * Para cada referencia: lo que hay, lo que está comprometido con órdenes
 * ya programadas, a qué ritmo se consume, cuántos días de cobertura
 * quedan y cuánto habría que pedir.
 *
 * TRES LÍMITES QUE CONDICIONAN LA LECTURA, y que se informan en pantalla
 * en vez de esconderlos tras un número que parezca exacto:
 *
 *  1. El detalle de los pedidos da PIEZAS, no yardas. Se convierten con
 *     el rendimiento histórico real (yardas cortadas ÷ piezas cortadas,
 *     hoy 0.954 yd/pieza sobre 555 órdenes). Es una estimación, no una
 *     medición.
 *
 *  2. Los nombres de tela no coinciden entre el detalle de los pedidos y
 *     el inventario: hoy solo 21 de 61 telas comprometidas encuentran su
 *     referencia. Las que no, se reportan aparte para que nadie lea un
 *     "0 comprometido" como si fuera un dato.
 *
 *  3. El consumo promedio sale de los movimientos de salida, que solo
 *     desde hace poco los genera Corte. Una tela sin salidas registradas
 *     no tiene ritmo calculable, y se dice, en vez de asumir cero.
 */

import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import { normalizarTela } from "@/lib/marker/cores"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Días de cobertura por debajo de los cuales se alerta. */
export const COBERTURA_CRITICA = 15

/** Ventana para calcular el consumo promedio. */
export const DIAS_VENTANA = 90

/** Días de inventario que se busca tener al sugerir una compra. */
export const DIAS_OBJETIVO = 45

export type NivelAlerta = "critico" | "atencion" | "ok" | "sin-datos"

export interface AlertaTela {
  /** Clave de agrupacion: el nombre normalizado de la tela. */
  clave: string
  tela: string
  /** Colores que agrupa esta fila, para poder desglosarla. */
  colores: string[]
  /** Ids de inventario que suma, por si hay que ir al detalle. */
  telaIds: number[]
  /** Yardas en existencia ahora mismo. */
  stock: number
  /** Yardas estimadas para órdenes aprobadas que aún no se cortan. */
  comprometido: number
  /** Piezas comprometidas, el dato duro del que sale la estimación. */
  piezasComprometidas: number
  /** Stock menos comprometido: lo que de verdad queda libre. */
  disponible: number
  /** Yardas por día, promedio de la ventana. */
  consumoDia: number
  /** Dias que dura el disponible. Se acota en 0: un negativo grande casi
   *  siempre indica nombres que no concilian, no un desabasto real. */
  coberturaDias: number | null
  /** True si el comprometido ya supera al stock. */
  enDeficit: boolean
  /** Fecha estimada de agotamiento. */
  fechaAgotamiento: string | null
  /** Yardas a pedir para llegar a DIAS_OBJETIVO de cobertura. */
  sugerido: number
  nivel: NivelAlerta
}

export interface ResumenAlertas {
  telas: number
  criticas: number
  atencion: number
  sinDatos: number
  /** Telas del detalle de pedidos que no encontraron su referencia. */
  sinConciliar: string[]
  /** Rendimiento usado para pasar de piezas a yardas. */
  rendimiento: number
  ordenesRendimiento: number
}

interface FilaTela {
  id: number
  nombre: string
  color: string | null
  stock_yardas: number | string | null
}
interface FilaMov {
  tela_id: number | null
  tipo_movimiento: string
  cantidad_yardas: number | string | null
  fecha_movimiento: string
}
interface FilaCab {
  pedido: string
  estado_aprobado_rechazado: string | null
  cfecha_de_corte: string | null
  cyardas: number | string | null
  cpiezas_cortadas: number | string | null
}
interface FilaDet {
  pedido: string
  tela: string | null
  pcs: number | string | null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

export async function cargarAlertas(): Promise<{
  alertas: AlertaTela[]
  resumen: ResumenAlertas
}> {
  const pag = <T,>(tabla: string, cols: string) =>
    fetchAll<T>((from, to) =>
      supabase
        .schema("telas")
        .from(tabla)
        .select(cols)
        .range(from, to) as unknown as PromiseLike<{
        data: T[] | null
        error: { message: string } | null
      }>
    )

  const [t, m, c, d] = await Promise.all([
    pag<FilaTela>("inventario_telas", "id, nombre, color, stock_yardas"),
    pag<FilaMov>(
      "inventario_movimientos",
      "tela_id, tipo_movimiento, cantidad_yardas, fecha_movimiento"
    ),
    pag<FilaCab>(
      "cabecera",
      "pedido, estado_aprobado_rechazado, cfecha_de_corte, cyardas, cpiezas_cortadas"
    ),
    pag<FilaDet>("detalleorden", "pedido, tela, pcs"),
  ])

  const telas = t.data ?? []
  const movs = m.data ?? []
  const ordenes = c.data ?? []
  const detalle = d.data ?? []

  // ── Rendimiento: yardas por pieza, de lo ya cortado ──────────────────
  // Es lo que permite estimar en yardas un compromiso que viene en
  // piezas. Se calcula total sobre total, no como promedio de
  // rendimientos: una orden diminuta distorsionaría el promedio.
  const cortadas = ordenes.filter(
    (o) => num(o.cyardas) > 0 && num(o.cpiezas_cortadas) > 0
  )
  const ydCortadas = cortadas.reduce((s, o) => s + num(o.cyardas), 0)
  const pcCortadas = cortadas.reduce((s, o) => s + num(o.cpiezas_cortadas), 0)
  const rendimiento = pcCortadas > 0 ? ydCortadas / pcCortadas : 1

  // ── Consumo diario: salidas de la ventana ────────────────────────────
  const corte = new Date(Date.now() - DIAS_VENTANA * 86400000)
    .toISOString()
    .slice(0, 10)
  const salidaPorTela = new Map<number, number>()
  for (const mv of movs) {
    if (mv.tipo_movimiento !== "DESCUENTO") continue
    if (String(mv.fecha_movimiento).slice(0, 10) < corte) continue
    if (mv.tela_id == null) continue
    salidaPorTela.set(
      mv.tela_id,
      (salidaPorTela.get(mv.tela_id) ?? 0) + num(mv.cantidad_yardas)
    )
  }

  // ── Comprometido: órdenes aprobadas sin cortar ───────────────────────
  const pendientes = new Set(
    ordenes
      .filter(
        (o) =>
          (o.estado_aprobado_rechazado ?? "").trim() === "Aprobado" &&
          !o.cfecha_de_corte
      )
      .map((o) => o.pedido)
  )
  const piezasPorNombre = new Map<string, number>()
  for (const l of detalle) {
    if (!pendientes.has(l.pedido)) continue
    const nom = normalizarTela(l.tela)
    if (!nom || nom === "NA" || nom === "N A") continue
    piezasPorNombre.set(nom, (piezasPorNombre.get(nom) ?? 0) + num(l.pcs))
  }

  // Los nombres del detalle contra los del inventario. Los que no
  // encuentran pareja se reportan: un 0 silencioso se leería como
  // "nada comprometido", que es lo contrario de lo que pasa.
  const nombresInv = new Set(telas.map((x) => normalizarTela(x.nombre)))
  const sinConciliar = [...piezasPorNombre.keys()]
    .filter((n) => !nombresInv.has(n))
    .sort()

  // Se agrupa por NOMBRE, no por color.
  //
  // El detalle de los pedidos dice "DRYFIT LISO" sin decir el color,
  // mientras que el inventario lo separa en varios —SUPERSOFT tiene 14
  // colores, ANTIFLUIDO STRETCH 9—. Repartir el compromiso por color
  // obligaria a adivinar cual; cargarlo entero a cada uno lo multiplica
  // (DRYFIT LISO NAVY salia con 2.108 yd comprometidas y cobertura de
  // -3.368 dias, que no significa nada).
  //
  // Al agrupar por nombre, el compromiso se compara contra el stock de
  // TODOS sus colores, que es el nivel al que el dato se conoce de
  // verdad. Los colores quedan listados para poder desglosar.
  const porNombre = new Map<string, FilaTela[]>()
  for (const x of telas) {
    const nom = normalizarTela(x.nombre)
    const lista = porNombre.get(nom) ?? []
    lista.push(x)
    porNombre.set(nom, lista)
  }

  const alertas: AlertaTela[] = [...porNombre.entries()].map(([nom, grupo]) => {
    const x = grupo[0]
    const stock =
      Math.round(grupo.reduce((s, g) => s + num(g.stock_yardas), 0) * 100) / 100
    const piezas = piezasPorNombre.get(nom) ?? 0
    const comprometido = Math.round(piezas * rendimiento * 100) / 100
    const disponible = Math.round((stock - comprometido) * 100) / 100

    const salidas = grupo.reduce((s, g) => s + (salidaPorTela.get(g.id) ?? 0), 0)
    const consumoDia = Math.round((salidas / DIAS_VENTANA) * 1000) / 1000

    // Sin consumo registrado no hay ritmo: no se puede proyectar nada, y
    // decir "cobertura infinita" sería tan falso como decir "cero".
    const coberturaDias =
      consumoDia > 0 ? Math.round((disponible / consumoDia) * 10) / 10 : null

    // Una cobertura muy negativa no significa "falta muchisima tela":
    // casi siempre es que el nombre del pedido no concilia con el del
    // inventario. El inventario tiene 3.436 yd de DRYFIT repartidas en 8
    // referencias -DRYFIT LISO-SK-ANCHO 60", DRYFIT LISO PSG...- pero el
    // nombre exacto "DRYFIT LISO" solo agrupa 60. Mostrar -3.368 dias
    // haria pensar en un desabasto que no existe, asi que por debajo de
    // cero la cifra se corta: lo que importa es que ya no alcanza.
    const coberturaMostrada =
      coberturaDias !== null && coberturaDias < 0 ? 0 : coberturaDias

    let fechaAgotamiento: string | null = null
    if (coberturaMostrada !== null && coberturaMostrada > 0) {
      const f = new Date(Date.now() + coberturaMostrada * 86400000)
      fechaAgotamiento = f.toISOString().slice(0, 10)
    } else if (coberturaMostrada !== null) {
      fechaAgotamiento = hoyISO()
    }

    // Lo que falta para llegar al objetivo de cobertura.
    const sugerido =
      consumoDia > 0
        ? Math.max(0, Math.round((consumoDia * DIAS_OBJETIVO - disponible) * 100) / 100)
        : 0

    const nivel: NivelAlerta =
      coberturaMostrada === null
        ? "sin-datos"
        : coberturaMostrada < COBERTURA_CRITICA
          ? "critico"
          : coberturaMostrada < COBERTURA_CRITICA * 2
            ? "atencion"
            : "ok"

    return {
      clave: nom,
      tela: x.nombre,
      colores: grupo.map((g) => g.color).filter(Boolean) as string[],
      telaIds: grupo.map((g) => g.id),
      stock,
      comprometido,
      piezasComprometidas: piezas,
      disponible,
      consumoDia,
      coberturaDias: coberturaMostrada,
      /** True si el disponible ya esta en negativo. */
      enDeficit: disponible < 0,
      fechaAgotamiento,
      sugerido,
      nivel,
    }
  })

  return {
    alertas: alertas.sort((a, b) => {
      // Lo urgente primero; dentro de cada nivel, la menor cobertura.
      const orden: Record<NivelAlerta, number> = {
        critico: 0,
        atencion: 1,
        ok: 2,
        "sin-datos": 3,
      }
      if (orden[a.nivel] !== orden[b.nivel]) return orden[a.nivel] - orden[b.nivel]
      return (a.coberturaDias ?? 1e9) - (b.coberturaDias ?? 1e9)
    }),
    resumen: {
      telas: alertas.length,
      criticas: alertas.filter((a) => a.nivel === "critico").length,
      atencion: alertas.filter((a) => a.nivel === "atencion").length,
      sinDatos: alertas.filter((a) => a.nivel === "sin-datos").length,
      sinConciliar,
      rendimiento: Math.round(rendimiento * 10000) / 10000,
      ordenesRendimiento: cortadas.length,
    },
  }
}
