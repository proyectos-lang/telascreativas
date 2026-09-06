/**
 * Motor de agrupación de cores para Marker Digital.
 *
 * Un "core" agrupa pedidos que comparten tipo de tela para cortarlos en
 * volumen. Estas funciones son PURAS (sin I/O) para poder validarlas contra
 * la cola real sin montar la UI.
 *
 * Reglas, decididas con producción:
 *
 *  1. La tela de una orden es la MAYORITARIA EN PIEZAS. El 10.7% de las
 *     órdenes usa más de una tela; esas se agrupan por la principal y se
 *     conserva la lista de secundarias como observación, para que el marker
 *     saque una impresión aparte de esos trazos.
 *
 *  2. Dentro de cada tela, las órdenes se ordenan por FECHA DE ENTREGA al
 *     cliente y se empaquetan hasta el tope de piezas; al desbordar se abre
 *     otro core. Ordenar por fecha antes de empaquetar no es un detalle: es
 *     lo que hace que los cores queden además agrupados por urgencia. Con la
 *     cola real, agrupar solo por tela daba un core de 39 órdenes con
 *     entregas repartidas en tres semanas; con tope 400 se parte en cores
 *     con ventanas de 2 a 6 días.
 *
 *  3. Un grupo de una sola orden no es un core: sale como suelta.
 *
 * El tope NO se codifica aquí: llega como parámetro desde
 * `telas.capacidad_areas.limite_fisico` (área 'Marker') para poder ajustarlo
 * sin desplegar.
 */

import { toPcs } from "@/lib/capacidad/fechas"

/** Línea de detalleorden que interesa para decidir la tela. */
export interface LineaDetalle {
  pedido: string
  tela: string | null
  /** En `telas.detalleorden` viene como texto. */
  pcs: number | string | null
}

/** Orden candidata a entrar en un core. */
export interface OrdenMarker {
  pedido: string
  cliente: string | null
  fecha_de_entrega: string | null
  pcs: number | null
  es_urgente?: boolean | null
}

/** Tela de una orden, ya resuelta. */
export interface TelaDeOrden {
  /** Tela mayoritaria en piezas, normalizada. */
  principal: string
  /** Otras telas de la orden, normalizadas (observación multi-tela). */
  secundarias: string[]
  /** Piezas totales sumadas desde el detalle. */
  pcs: number
}

/** Orden dentro de un core, con su información de tela. */
export interface OrdenEnCore extends OrdenMarker {
  telaPrincipal: string
  telasSecundarias: string[]
  /** Piezas del detalle; si el detalle no trae, cae a `cabecera.pcs`. */
  piezas: number
}

export interface CoreSugerido {
  /** Identificador estable para React y para selección en la UI. */
  id: string
  telaPrincipal: string
  ordenes: OrdenEnCore[]
  totalPcs: number
  /** Entrega más temprana y más tardía del core (informativas). */
  entregaDesde: string | null
  entregaHasta: string | null
  /** Cuántas de sus órdenes tienen telas secundarias. */
  conMultiTela: number
}

export interface SugerenciaCores {
  cores: CoreSugerido[]
  /** Órdenes que quedaron solas: no hay con quién agruparlas. */
  sueltas: OrdenEnCore[]
  topePcs: number
}

/** Tope por defecto si `capacidad_areas` no trae `limite_fisico`. */
export const TOPE_CORE_POR_DEFECTO = 400

/**
 * Normaliza el nombre de una tela para agrupar.
 *
 * `detalleorden.tela` es texto libre y tiene variantes de escritura reales:
 * 'DRYFIT LISO' vs 'Dryfit liso', '42K-FEATHER' vs '42K- FEATHER'. Sin
 * normalizar, esas se irían a cores distintos.
 */
export function normalizarTela(t: string | null | undefined): string {
  return String(t ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** True si el valor de tela no aporta información para agrupar. */
function telaVacia(t: string): boolean {
  return t === "" || t === "NA" || t === "N A"
}

/**
 * Resuelve la tela de cada pedido a partir de sus líneas de detalle.
 * Devuelve un mapa pedido -> { principal, secundarias, pcs }.
 */
export function telasPorPedido(
  lineas: LineaDetalle[]
): Map<string, TelaDeOrden> {
  // pedido -> tela normalizada -> piezas
  const acumulado = new Map<string, Map<string, number>>()

  for (const l of lineas) {
    const tela = normalizarTela(l.tela)
    if (telaVacia(tela)) continue
    const porTela = acumulado.get(l.pedido) ?? new Map<string, number>()
    porTela.set(tela, (porTela.get(tela) ?? 0) + toPcs(l.pcs))
    acumulado.set(l.pedido, porTela)
  }

  const salida = new Map<string, TelaDeOrden>()
  for (const [pedido, porTela] of acumulado) {
    // Mayor número de piezas primero; a igualdad, alfabético para que el
    // resultado sea estable entre ejecuciones.
    const orden = [...porTela.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )
    salida.set(pedido, {
      principal: orden[0][0],
      secundarias: orden.slice(1).map(([t]) => t),
      pcs: orden.reduce((s, [, n]) => s + n, 0),
    })
  }
  return salida
}

/** Clave de ordenación por fecha de entrega; sin fecha va al final. */
function claveEntrega(o: OrdenMarker): string {
  const f = String(o.fecha_de_entrega ?? "").slice(0, 10)
  return f || "9999-12-31"
}

/**
 * Sugiere los cores de una cola de órdenes.
 *
 * Las órdenes sin tela reconocible en el detalle no se pueden agrupar y
 * salen como sueltas: agruparlas "a ciegas" mandaría a la mesa de corte
 * piezas de telas distintas.
 */
export function sugerirCores(
  ordenes: OrdenMarker[],
  telas: Map<string, TelaDeOrden>,
  opciones?: { topePcs?: number }
): SugerenciaCores {
  const topePcs =
    opciones?.topePcs && opciones.topePcs > 0
      ? opciones.topePcs
      : TOPE_CORE_POR_DEFECTO

  const sueltas: OrdenEnCore[] = []
  const porTela = new Map<string, OrdenEnCore[]>()

  for (const o of ordenes) {
    const t = telas.get(o.pedido)
    if (!t) {
      // Sin detalle o sin tela utilizable: no se puede agrupar.
      sueltas.push({
        ...o,
        telaPrincipal: "",
        telasSecundarias: [],
        piezas: toPcs(o.pcs),
      })
      continue
    }
    const enCore: OrdenEnCore = {
      ...o,
      telaPrincipal: t.principal,
      telasSecundarias: t.secundarias,
      // El detalle es la fuente fiable de piezas por tela; si viniera en
      // cero, se cae a la cabecera para no perder la orden.
      piezas: t.pcs > 0 ? t.pcs : toPcs(o.pcs),
    }
    const lista = porTela.get(t.principal) ?? []
    lista.push(enCore)
    porTela.set(t.principal, lista)
  }

  const cores: CoreSugerido[] = []

  // Telas con más órdenes primero, para que lo relevante quede arriba.
  const telasOrdenadas = [...porTela.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  )

  for (const [tela, lista] of telasOrdenadas) {
    lista.sort((a, b) => claveEntrega(a).localeCompare(claveEntrega(b)))

    // Empaquetado secuencial: al pasarse del tope se cierra el core y se
    // abre otro. Una orden que por sí sola excede el tope forma su propio
    // core (no se parte un pedido entre dos trazos).
    let actual: OrdenEnCore[] = []
    let acumulado = 0
    const cerrar = () => {
      if (actual.length === 0) return
      cores.push(construirCore(tela, actual, cores.length))
      actual = []
      acumulado = 0
    }

    for (const o of lista) {
      if (actual.length > 0 && acumulado + o.piezas > topePcs) cerrar()
      actual.push(o)
      acumulado += o.piezas
    }
    cerrar()
  }

  // Un core de una sola orden no aporta agrupación: pasa a sueltas.
  const realesYSolos = cores.reduce<{
    reales: CoreSugerido[]
    solos: OrdenEnCore[]
  }>(
    (acc, c) => {
      if (c.ordenes.length >= 2) acc.reales.push(c)
      else acc.solos.push(c.ordenes[0])
      return acc
    },
    { reales: [], solos: [] }
  )

  return {
    cores: realesYSolos.reales,
    sueltas: [...sueltas, ...realesYSolos.solos].sort((a, b) =>
      claveEntrega(a).localeCompare(claveEntrega(b))
    ),
    topePcs,
  }
}

function construirCore(
  tela: string,
  ordenes: OrdenEnCore[],
  indice: number
): CoreSugerido {
  const fechas = ordenes
    .map((o) => String(o.fecha_de_entrega ?? "").slice(0, 10))
    .filter(Boolean)
    .sort()
  return {
    id: `${tela}#${indice}`,
    telaPrincipal: tela,
    ordenes,
    totalPcs: ordenes.reduce((s, o) => s + o.piezas, 0),
    entregaDesde: fechas[0] ?? null,
    entregaHasta: fechas[fechas.length - 1] ?? null,
    conMultiTela: ordenes.filter((o) => o.telasSecundarias.length > 0).length,
  }
}

/**
 * Reparte una cantidad total entre las órdenes de un core, en proporción a
 * sus piezas. Se usa dos veces:
 *   - yardas TEÓRICAS del marker → `cabecera.mdyardas_teoricas`
 *   - yardas REALES de Corte     → `cabecera.cyardas`
 *
 * El último reparto absorbe el redondeo para que la suma cuadre EXACTAMENTE
 * con el total capturado; si no, los indicadores que suman por orden no
 * coincidirían con lo que registró el operario.
 */
export function prorratearPorPiezas(
  total: number,
  ordenes: { pedido: string; piezas: number }[],
  decimales = 2
): Map<string, number> {
  const salida = new Map<string, number>()
  if (ordenes.length === 0) return salida

  const suma = ordenes.reduce((s, o) => s + o.piezas, 0)
  const factor = 10 ** decimales
  const redondear = (n: number) => Math.round(n * factor) / factor

  // Sin piezas conocidas se reparte en partes iguales.
  if (suma <= 0) {
    const parte = redondear(total / ordenes.length)
    let acumulado = 0
    ordenes.forEach((o, i) => {
      const v = i === ordenes.length - 1 ? redondear(total - acumulado) : parte
      salida.set(o.pedido, v)
      acumulado = redondear(acumulado + v)
    })
    return salida
  }

  let acumulado = 0
  ordenes.forEach((o, i) => {
    const v =
      i === ordenes.length - 1
        ? redondear(total - acumulado)
        : redondear((total * o.piezas) / suma)
    salida.set(o.pedido, v)
    acumulado = redondear(acumulado + v)
  })
  return salida
}
