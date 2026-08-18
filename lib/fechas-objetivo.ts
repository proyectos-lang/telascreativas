/**
 * Fuente ÚNICA del cálculo de fechas objetivo por área.
 *
 * Antes esta lógica estaba triplicada (aprobar, reprogramar y revertir un
 * rechazo), con comportamientos divergentes entre sí. Ahora los tres consumen
 * `calcularFechasObjetivo`.
 *
 * Reglas de negocio:
 *
 * 1. Jornada por área:
 *      - Diseño, Costura, Empaque  → Lun a SÁB (solo domingo no laboral).
 *      - Corte, Impresión, Sublimación → Lun a VIE (no trabajan sábado), así
 *        que sus fechas objetivo nunca caen en fin de semana.
 *
 * 2. Orden del flujo:
 *      - PRODUCCIÓN NORMAL: Diseño +3 · Corte +3 · Impresión +4 ·
 *        Sublimación +5 · Costura +6 · Empaque +8.
 *      - YARDAJE: el Corte va DESPUÉS de Sublimación, por lo que se recorre a
 *        Diseño +3 · Impresión +4 · Sublimación +5 · Corte +6 · Costura +7 ·
 *        Empaque +8 (se conserva el compromiso total con el cliente).
 *
 * 3. Flujos reducidos:
 *      - `solo_corte_costura`  → sin Diseño, Impresión ni Sublimación.
 *      - `omite_corte_costura` → sin Corte ni Costura.
 *      - YARDAJE sin costura (`costura_si_no === false`) → la orden no pasa por
 *        Corte, Costura ni Empaque (va Sublimación → Entregas), así que esas
 *        fechas quedan vacías. Antes se persistían igual y quedaban vencidas
 *        para siempre en Capacidad y Adherencia.
 *
 * 4. Urgentes: todas las áreas apuntan a la fecha de entrega al cliente. Para
 *    las áreas Lun–Vie, si esa fecha cae en fin de semana se retrocede al
 *    viernes anterior.
 */

import {
  addDaysSkippingSundays,
  addDaysSkippingWeekends,
  retrocederAViernes,
} from "@/lib/date-utils"

type Area = "diseno" | "corte" | "impresion" | "sublimacion" | "costura" | "empaque"

/** Offsets en días hábiles desde la fecha de programación. */
const OFFSETS_NORMAL: Record<Area, number> = {
  diseno: 3,
  corte: 3,
  impresion: 4,
  sublimacion: 5,
  costura: 6,
  empaque: 8,
} as const

/** En YARDAJE el Corte se ejecuta después de Sublimación. */
const OFFSETS_YARDAJE: Record<Area, number> = {
  diseno: 3,
  corte: 6,
  impresion: 4,
  sublimacion: 5,
  costura: 7,
  empaque: 8,
} as const

export interface FechasObjetivoInput {
  /** Fecha de programación (YYYY-MM-DD). Base del cálculo. */
  fechaBase: string
  esUrgente?: boolean | null
  /** Fecha de entrega al cliente (YYYY-MM-DD). Solo se usa si es urgente. */
  fechaEntrega?: string | null
  soloCorteCostura?: boolean | null
  omiteCorteCostura?: boolean | null
  tipoFlujo?: string | null
  costuraSiNo?: boolean | string | null
}

export interface FechasObjetivo {
  dfecha_objetivo_d?: string
  cfecha_objetivo_c?: string
  ifecha_objetivo_i?: string
  sfecha_objetivo_s?: string
  cosfecha_objetivo_cs?: string
  efecha_objetivo_e?: string
}

export function esYardajeFlujo(tipoFlujo: string | null | undefined): boolean {
  return (tipoFlujo ?? "").toString().trim().toUpperCase() === "YARDAJE"
}

/** `costura_si_no` llega como boolean o como el string "false" según el origen. */
export function sinCosturaFlag(v: boolean | string | null | undefined): boolean {
  return v === false || String(v).toLowerCase() === "false"
}

export function calcularFechasObjetivo(input: FechasObjetivoInput): FechasObjetivo {
  const {
    fechaBase,
    esUrgente,
    fechaEntrega,
    soloCorteCostura,
    omiteCorteCostura,
    tipoFlujo,
    costuraSiNo,
  } = input

  if (!fechaBase) return {}

  const esYardaje = esYardajeFlujo(tipoFlujo)
  const offsets = esYardaje ? OFFSETS_YARDAJE : OFFSETS_NORMAL

  const entregaYMD = fechaEntrega ? String(fechaEntrega).slice(0, 10) : ""
  const usarFechaEntrega = Boolean(esUrgente) && Boolean(entregaYMD)

  // Calendario de cada área.
  const CAL: Record<Area, "lunSab" | "lunVie"> = {
    diseno: "lunSab",
    impresion: "lunVie",
    sublimacion: "lunVie",
    corte: "lunVie",
    costura: "lunSab",
    empaque: "lunSab",
  }
  const sumar = (cal: "lunSab" | "lunVie", desde: string, dias: number): string =>
    cal === "lunVie"
      ? addDaysSkippingWeekends(desde, dias)
      : addDaysSkippingSundays(desde, dias)

  // Qué áreas aplica esta orden.
  const saltaDisenoImpresion = soloCorteCostura === true
  const yardajeSinCostura = esYardaje && sinCosturaFlag(costuraSiNo)
  const saltaCorteCostura = omiteCorteCostura === true || yardajeSinCostura
  // En yardaje sin costura la orden va de Sublimación directo a Entregas.
  const saltaEmpaque = yardajeSinCostura

  const aplica: Record<Area, boolean> = {
    diseno: !saltaDisenoImpresion,
    impresion: !saltaDisenoImpresion,
    sublimacion: !saltaDisenoImpresion,
    corte: !saltaCorteCostura,
    costura: !saltaCorteCostura,
    empaque: !saltaEmpaque,
  }

  // Urgente: TODAS las áreas apuntan al deadline del cliente (sin encadenar);
  // las áreas Lun–Vie retroceden al viernes si esa fecha cae en fin de semana.
  if (usarFechaEntrega) {
    const val = (a: Area) =>
      !aplica[a]
        ? undefined
        : CAL[a] === "lunVie"
        ? retrocederAViernes(entregaYMD)
        : entregaYMD
    return {
      dfecha_objetivo_d: val("diseno"),
      ifecha_objetivo_i: val("impresion"),
      sfecha_objetivo_s: val("sublimacion"),
      cfecha_objetivo_c: val("corte"),
      cosfecha_objetivo_cs: val("costura"),
      efecha_objetivo_e: val("empaque"),
    }
  }

  // Secuencia real del flujo. Cada grupo se ejecuta después del anterior; las
  // áreas dentro de un grupo van en paralelo (Corte e Impresión en producción
  // normal). En YARDAJE el Corte va después de Sublimación.
  const secuencia: Area[][] = esYardaje
    ? [["diseno"], ["impresion"], ["sublimacion"], ["corte"], ["costura"], ["empaque"]]
    : [["diseno"], ["corte", "impresion"], ["sublimacion"], ["costura"], ["empaque"]]

  // Mezclar dos calendarios (Lun–Vie y Lun–Sáb) puede romper el orden: p. ej.
  // con base viernes, Costura (+7 Lun–Sáb) caía ANTES que Corte (+6 Lun–Vie).
  // Por eso, además del offset, se fuerza que cada etapa quede al menos un día
  // hábil después de la etapa anterior del flujo.
  const fechas: Partial<Record<Area, string>> = {}
  let finGrupoPrevio = ""
  for (const grupo of secuencia) {
    let maxGrupo = finGrupoPrevio
    for (const area of grupo) {
      if (!aplica[area]) continue
      const cal = CAL[area]
      let f = sumar(cal, fechaBase, offsets[area])
      if (finGrupoPrevio && f <= finGrupoPrevio) {
        f = sumar(cal, finGrupoPrevio, 1)
      }
      fechas[area] = f
      if (f > maxGrupo) maxGrupo = f
    }
    finGrupoPrevio = maxGrupo
  }

  return {
    dfecha_objetivo_d: fechas.diseno,
    ifecha_objetivo_i: fechas.impresion,
    sfecha_objetivo_s: fechas.sublimacion,
    cfecha_objetivo_c: fechas.corte,
    cosfecha_objetivo_cs: fechas.costura,
    efecha_objetivo_e: fechas.empaque,
  }
}
