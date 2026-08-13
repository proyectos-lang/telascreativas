/**
 * Motor de capacidad instalada y disponible (ATP) — módulo Capacidad v2.
 *
 * Funciones puras (sin I/O): reciben los datos ya cargados por
 * `capacidad-data.ts` y calculan carga comprometida por área/día, ATP,
 * semáforo de utilización, cuello de botella, ocupación por máquina de
 * costura y la simulación de órdenes nuevas con la matriz de tiempos.
 *
 * Fórmulas (spec de producción):
 *   capacidad_dia(a,d) = LEAST(capacidad_efectiva, limite_fisico) × factor_excepcion(a,d) × es_laboral(d)
 *   colchon(a,d)       = capacidad_dia × colchon_urgentes_pct
 *   ATP(a,d)           = capacidad_dia − carga_dia − reservas_dia − colchon
 *   utilización        = (carga + reservas) / capacidad_dia
 *   Semáforo: ≤85% verde · ≤100% ámbar · >100% rojo
 */

import {
  addDaysUTC,
  addHabiles,
  esLaboral,
  hoyUTC,
  listarHabiles,
  lunesDeSemana,
  parseYMD,
  semanaISO,
  siguienteHabil,
  toPcs,
  toYMD,
} from "./fechas"

// ---------------------------------------------------------------------------
// Tipos de datos (espejo de las tablas de scripts/capacidad-motor.sql)
// ---------------------------------------------------------------------------

export interface AreaParametro {
  area: string
  unidad_medida: string
  capacidad_teorica: number | null
  capacidad_efectiva: number | null
  factor_eficiencia: number | null
  limite_fisico: number | null
  recurso_cuello: string | null
  puestos: number | null
  turnos: number | null
  horas_turno: number | null
  dias_proceso_objetivo: number | null
  ordenes_dia_p85: number | null
  colchon_urgentes_pct: number
  notas: string | null
  activo: boolean
  actualizado_en: string | null
}

export interface CalibracionLog {
  id: number
  area: string
  fecha_calculo: string
  ventana_dias: number
  dias_activos: number
  pcs_dia_prom: number | null
  pcs_dia_p50: number | null
  pcs_dia_p85: number | null
  pcs_dia_p95: number | null
  ordenes_dia_prom: number | null
  ordenes_dia_p85: number | null
  baja_confianza: boolean
  fuente: string
}

export interface ReservaCapacidad {
  id: number
  pedido: string | null
  area: string
  fecha_planificada: string
  pcs_reservadas: number
  origen: string
  detalle: string | null
  creado_por: string | null
  creado_en: string
}

export interface ExcepcionCapacidad {
  id: number
  area: string // '*' = todas
  fecha: string
  factor: number
  motivo: string | null
}

export interface MatrizTiempoRow {
  id: number
  tipo_codigo: number
  tipo_nombre: string
  concepto: string | null
  rango: "menor_24" | "mayor_24"
  dias_diseno: number
  dias_corte: number
  dias_aprobacion: number
  dias_impresion: number
  dias_sublimacion: number
  dias_costura: number
  total_dias: number
  activo: boolean
}

export interface MaquinaCapacidad {
  id: number
  maquina: string
  categoria: string | null
  pcs_dia: number
  pcs_semana: number
  activo: boolean
}

/** Campos de cabecera que el motor necesita por orden activa. */
export interface OrdenCapacidad {
  pedido: string
  cliente: string | null
  pcs: number | string | null
  es_urgente: boolean | null
  fecha_de_entrega: string | null
  fecha_de_entreganueva: string | null
  entregado_cliente_si_no: boolean | null
  estado_aprobado_rechazado: string | null
  tipo_flujo_especial: string | null
  solo_corte_costura: boolean | null
  omite_corte_costura: boolean | null
  costura_si_no: boolean | string | null
  accesorios_inventario: string | null
  maquina_costura: string | null
  // fin por área
  dentrega_diseno: string | null
  cfecha_de_corte: string | null
  ientrega_impresion: string | null
  seta_sublimacion: string | null
  coseta_costura: string | null
  efecha_de_empaque: string | null
  // objetivo por área
  dfecha_objetivo_d: string | null
  cfecha_objetivo_c: string | null
  ifecha_objetivo_i: string | null
  sfecha_objetivo_s: string | null
  cosfecha_objetivo_cs: string | null
  efecha_objetivo_e: string | null
}

// ---------------------------------------------------------------------------
// Áreas del motor (orden del flujo). "Aprobacion" no es un área productiva:
// solo aparece como etapa de espera en la simulación (matriz de tiempos).
// ---------------------------------------------------------------------------

export interface AreaMotorDef {
  key: string
  label: string
  campoFin: keyof OrdenCapacidad
  campoObjetivo: keyof OrdenCapacidad
  campoMatriz: keyof MatrizTiempoRow | null
}

export const AREAS_MOTOR: AreaMotorDef[] = [
  { key: "Diseno", label: "Diseño", campoFin: "dentrega_diseno", campoObjetivo: "dfecha_objetivo_d", campoMatriz: "dias_diseno" },
  { key: "Corte", label: "Corte", campoFin: "cfecha_de_corte", campoObjetivo: "cfecha_objetivo_c", campoMatriz: "dias_corte" },
  { key: "Impresion", label: "Impresión", campoFin: "ientrega_impresion", campoObjetivo: "ifecha_objetivo_i", campoMatriz: "dias_impresion" },
  { key: "Sublimacion", label: "Sublimación", campoFin: "seta_sublimacion", campoObjetivo: "sfecha_objetivo_s", campoMatriz: "dias_sublimacion" },
  { key: "Costura", label: "Costura", campoFin: "coseta_costura", campoObjetivo: "cosfecha_objetivo_cs", campoMatriz: "dias_costura" },
  { key: "Empaque", label: "Empaque", campoFin: "efecha_de_empaque", campoObjetivo: "efecha_objetivo_e", campoMatriz: null },
]

// ---------------------------------------------------------------------------
// Flujo: qué áreas aplica cada orden (replica los filtros de los contexts)
// ---------------------------------------------------------------------------

function norm(v: unknown): string {
  return (v ?? "").toString().trim().toUpperCase()
}

function sinCostura(o: OrdenCapacidad): boolean {
  return o.costura_si_no === false || String(o.costura_si_no).toLowerCase() === "false"
}

function hasAccesorios(o: OrdenCapacidad): boolean {
  return (o.accesorios_inventario ?? "").toString().trim() !== ""
}

/** True si la orden pasa por el área según su flujo (misma matriz que los contexts). */
export function pasaPorArea(areaKey: string, o: OrdenCapacidad): boolean {
  const t = norm(o.tipo_flujo_especial)
  if (t === "COMPRA_EXTERNA") return false
  if (t === "VENTA_INVENTARIO") {
    if (hasAccesorios(o)) return areaKey === "Sublimacion"
    return areaKey === "Empaque"
  }
  // PRODUCCION_NORMAL / YARDAJE / null
  if (o.solo_corte_costura === true) {
    return areaKey === "Corte" || areaKey === "Costura" || areaKey === "Empaque"
  }
  if (areaKey === "Corte" || areaKey === "Costura") return !sinCostura(o)
  if (areaKey === "Empaque") return !(t === "YARDAJE" && sinCostura(o))
  return true // Diseno / Impresion / Sublimacion
}

/** Orden activa para el motor: aprobable/en curso, no cancelada ni entregada. */
export function esOrdenActiva(o: OrdenCapacidad): boolean {
  const est = (o.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase()
  if (est === "cancelado" || est === "rechazado") return false
  if (o.entregado_cliente_si_no === true) return false
  return true
}

// ---------------------------------------------------------------------------
// Carga comprometida por área/día
// ---------------------------------------------------------------------------

export interface OrdenCarga {
  pedido: string
  cliente: string | null
  pcs: number
  entrega: string | null
}

export interface CargaDia {
  pcs: number
  ordenes: OrdenCarga[]
}

/** Map areaKey → Map ymd → carga. */
export type CargaPorArea = Map<string, Map<string, CargaDia>>

/**
 * Explota las etapas PENDIENTES de cada orden activa y reserva sus pcs en la
 * fecha objetivo del área. Si la fecha objetivo es null o ya pasó, la carga
 * cae en el PRÓXIMO día hábil (backlog vencido = sobrecarga real visible hoy).
 */
export function cargaPorAreaDia(ordenes: OrdenCapacidad[], hoy = hoyUTC()): CargaPorArea {
  const mapa: CargaPorArea = new Map()
  for (const a of AREAS_MOTOR) mapa.set(a.key, new Map())
  const proximoHabil = siguienteHabil(hoy)

  for (const o of ordenes) {
    if (!esOrdenActiva(o)) continue
    const pcs = toPcs(o.pcs)
    if (pcs <= 0) continue
    for (const a of AREAS_MOTOR) {
      if (o[a.campoFin]) continue // etapa terminada: no consume capacidad
      if (!pasaPorArea(a.key, o)) continue
      const obj = parseYMD(o[a.campoObjetivo] as string | null)
      const fecha = obj && obj >= hoy ? siguienteHabil(obj) : proximoHabil
      const ymd = toYMD(fecha)
      const porDia = mapa.get(a.key)!
      const celda = porDia.get(ymd) ?? { pcs: 0, ordenes: [] }
      celda.pcs += pcs
      celda.ordenes.push({
        pedido: o.pedido,
        cliente: o.cliente,
        pcs,
        entrega: o.fecha_de_entreganueva || o.fecha_de_entrega,
      })
      porDia.set(ymd, celda)
    }
  }
  return mapa
}

export interface BacklogArea {
  area: string
  label: string
  pcs: number
  ordenes: number
  /** pcs de etapas cuya fecha objetivo ya venció */
  pcsVencidas: number
  /** pcs de etapas sin fecha objetivo asignada (orden no programada) */
  pcsSinFecha: number
}

export interface ResumenBacklog {
  total: number
  totalOrdenes: number
  porArea: BacklogArea[]
}

/**
 * Backlog que el motor coloca en el PRIMER día hábil: etapas pendientes cuya
 * fecha objetivo ya venció o que nunca tuvo fecha (orden sin programar). Es la
 * causa de que el primer día del heatmap aparezca sobrecargado: no es la carga
 * de ese día, es la deuda acumulada del área.
 */
export function backlogPorArea(ordenes: OrdenCapacidad[], hoy = hoyUTC()): ResumenBacklog {
  const acc = new Map<string, BacklogArea>()
  const pedidosConBacklog = new Set<string>()
  for (const a of AREAS_MOTOR)
    acc.set(a.key, { area: a.key, label: a.label, pcs: 0, ordenes: 0, pcsVencidas: 0, pcsSinFecha: 0 })

  for (const o of ordenes) {
    if (!esOrdenActiva(o)) continue
    const pcs = toPcs(o.pcs)
    if (pcs <= 0) continue
    for (const a of AREAS_MOTOR) {
      if (o[a.campoFin]) continue
      if (!pasaPorArea(a.key, o)) continue
      const obj = parseYMD(o[a.campoObjetivo] as string | null)
      const esBacklog = !(obj && obj >= hoy)
      if (!esBacklog) continue
      const celda = acc.get(a.key)!
      celda.pcs += pcs
      celda.ordenes += 1
      if (obj) celda.pcsVencidas += pcs
      else celda.pcsSinFecha += pcs
      pedidosConBacklog.add(o.pedido)
    }
  }

  const porArea = [...acc.values()].filter((b) => b.pcs > 0).sort((a, b) => b.pcs - a.pcs)
  return {
    total: porArea.reduce((s, b) => s + b.pcs, 0),
    totalOrdenes: pedidosConBacklog.size,
    porArea,
  }
}

/** Map areaKey → Map ymd → pcs reservadas (simulaciones/manuales). */
export type ReservasPorArea = Map<string, Map<string, number>>

export function reservasPorAreaDia(reservas: ReservaCapacidad[], hoy = hoyUTC()): ReservasPorArea {
  const mapa: ReservasPorArea = new Map()
  const proximoHabil = siguienteHabil(hoy)
  for (const r of reservas) {
    const f = parseYMD(r.fecha_planificada)
    if (!f) continue
    const fecha = f >= hoy ? siguienteHabil(f) : proximoHabil
    const ymd = toYMD(fecha)
    const porDia = mapa.get(r.area) ?? new Map<string, number>()
    porDia.set(ymd, (porDia.get(ymd) ?? 0) + toPcs(r.pcs_reservadas))
    mapa.set(r.area, porDia)
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Capacidad por día, ATP y semáforo
// ---------------------------------------------------------------------------

export type Semaforo = "verde" | "ambar" | "rojo" | "na"

export interface AtpCelda {
  fecha: string
  capacidad: number
  carga: number
  reservado: number
  colchon: number
  atp: number
  utilizacion: number | null
  semaforo: Semaforo
}

export interface SerieAreaATP {
  area: string
  label: string
  celdas: AtpCelda[]
  utilPromedio: number | null
  diasRojo: number
}

function capacidadBase(p: AreaParametro): number {
  const efectiva = p.capacidad_efectiva ?? p.limite_fisico ?? 0
  const limite = p.limite_fisico ?? Infinity
  return Math.max(0, Math.min(efectiva, limite))
}

function factorExcepcion(
  excepciones: ExcepcionCapacidad[],
  areaKey: string,
  ymd: string
): number {
  let factor = 1
  let especifica: number | null = null
  let global: number | null = null
  for (const e of excepciones) {
    if (e.fecha !== ymd) continue
    if (e.area === areaKey) especifica = e.factor
    else if (e.area === "*") global = e.factor
  }
  if (especifica !== null) factor = especifica
  else if (global !== null) factor = global
  return factor
}

export interface ContextoATP {
  params: AreaParametro[]
  carga: CargaPorArea
  reservas: ReservasPorArea
  excepciones: ExcepcionCapacidad[]
}

/** Celda ATP de un área en una fecha concreta (usada por serie y simulador). */
export function celdaATP(ctx: ContextoATP, p: AreaParametro, fecha: Date): AtpCelda {
  const ymd = toYMD(fecha)
  const laboral = esLaboral(fecha)
  const cap = laboral ? capacidadBase(p) * factorExcepcion(ctx.excepciones, p.area, ymd) : 0
  const carga = ctx.carga.get(p.area)?.get(ymd)?.pcs ?? 0
  const reservado = ctx.reservas.get(p.area)?.get(ymd) ?? 0
  const colchon = cap * (p.colchon_urgentes_pct ?? 0.15)
  const atp = cap - carga - reservado - colchon
  const ocupado = carga + reservado
  const utilizacion = cap > 0 ? ocupado / cap : null
  const semaforo: Semaforo =
    cap === 0
      ? ocupado > 0
        ? "rojo"
        : "na"
      : utilizacion! <= 0.85
      ? "verde"
      : utilizacion! <= 1
      ? "ambar"
      : "rojo"
  return { fecha: ymd, capacidad: cap, carga, reservado, colchon, atp, utilizacion, semaforo }
}

/** Serie ATP por área para los próximos `nHabiles` días hábiles. */
export function construirSeriesATP(ctx: ContextoATP, nHabiles = 21, desde = hoyUTC()): SerieAreaATP[] {
  const dias = listarHabiles(desde, nHabiles)
  const series: SerieAreaATP[] = []
  for (const a of AREAS_MOTOR) {
    const p = ctx.params.find((x) => x.area === a.key)
    if (!p || !p.activo) continue
    const celdas = dias.map((d) => celdaATP(ctx, p, d))
    const utils = celdas.map((c) => c.utilizacion).filter((u): u is number => u !== null)
    series.push({
      area: a.key,
      label: a.label,
      celdas,
      utilPromedio: utils.length ? utils.reduce((s, u) => s + u, 0) / utils.length : null,
      diasRojo: celdas.filter((c) => c.semaforo === "rojo").length,
    })
  }
  return series
}

export interface CuelloBotella {
  area: string
  label: string
  utilPromedio: number | null
  diasRojo: number
}

export function cuelloDeBotella(series: SerieAreaATP[]): CuelloBotella | null {
  const conDatos = series.filter((s) => s.utilPromedio !== null)
  if (!conDatos.length) return null
  const top = [...conDatos].sort(
    (a, b) => (b.utilPromedio ?? 0) - (a.utilPromedio ?? 0) || b.diasRojo - a.diasRojo
  )[0]
  return { area: top.area, label: top.label, utilPromedio: top.utilPromedio, diasRojo: top.diasRojo }
}

// ---------------------------------------------------------------------------
// Simulación de una orden nueva con la matriz de tiempos
// ---------------------------------------------------------------------------

const HORIZONTE_SIM_DIAS = 240 // tope de búsqueda (días calendario)

export interface SimEtapa {
  key: string
  label: string
  dias: number
  esEspera: boolean
  inicio: string | null
  fin: string | null
  cuotaDiaria: number
  diasEmpujada: number
}

export interface SimDesplazada extends OrdenCarga {
  area: string
  fecha: string
}

export interface SimResultado {
  factible: boolean
  fallo: string | null // motivo si no se pudo programar
  fechaInicio: string
  fechaMasTemprana: string | null
  diasHabilesRequeridos: number
  areaRestrictiva: string | null
  etapas: SimEtapa[]
  desplazadas: SimDesplazada[]
}

export interface SimInput {
  fila: MatrizTiempoRow
  cantidad: number
  esUrgente: boolean
  fechaDeseada?: string | null
}

/** Selecciona la fila de la matriz según tipo y cantidad (<24 vs ≥24). */
export function filaMatriz(
  matriz: MatrizTiempoRow[],
  tipoCodigo: number,
  cantidad: number
): MatrizTiempoRow | null {
  const rango = cantidad < 24 ? "menor_24" : "mayor_24"
  return matriz.find((m) => m.tipo_codigo === tipoCodigo && m.rango === rango && m.activo) ?? null
}

/**
 * Programa la orden hacia adelante etapa por etapa (orden de la matriz:
 * Diseño → Corte → Aprobación → Impresión → Sublimación → Costura).
 * - Etapa "Aprobación": espera de calendario (días hábiles), no consume capacidad.
 * - Etapa productiva: requiere `dias` días hábiles consecutivos con ATP ≥ cuota
 *   diaria (cantidad / días). Si no caben, se desliza hacia adelante (la etapa
 *   que más se desliza es el área restrictiva).
 * - Urgente: NO se desliza; puede consumir el colchón de urgentes. Si ni con el
 *   colchón alcanza, se listan las órdenes que se desplazarían (las de entrega
 *   más lejana cargadas ese día en esa área, hasta cubrir el déficit).
 */
export function simular(input: SimInput, ctx: ContextoATP, hoy = hoyUTC()): SimResultado {
  const { fila, cantidad, esUrgente } = input
  const inicioGlobal = siguienteHabil(addDaysUTC(hoy, 1))
  const limite = addDaysUTC(hoy, HORIZONTE_SIM_DIAS)

  const defEtapas: { key: string; label: string; dias: number; esEspera: boolean }[] = [
    { key: "Diseno", label: "Diseño", dias: Number(fila.dias_diseno) || 0, esEspera: false },
    { key: "Corte", label: "Corte", dias: Number(fila.dias_corte) || 0, esEspera: false },
    { key: "Aprobacion", label: "Aprobación", dias: Number(fila.dias_aprobacion) || 0, esEspera: true },
    { key: "Impresion", label: "Impresión", dias: Number(fila.dias_impresion) || 0, esEspera: false },
    { key: "Sublimacion", label: "Sublimación", dias: Number(fila.dias_sublimacion) || 0, esEspera: false },
    { key: "Costura", label: "Costura", dias: Number(fila.dias_costura) || 0, esEspera: false },
  ]

  const etapas: SimEtapa[] = []
  const desplazadas: SimDesplazada[] = []
  const desplazadasVistas = new Set<string>()
  let cursor = new Date(inicioGlobal.getTime())
  let fallo: string | null = null
  let areaRestrictiva: string | null = null
  let maxEmpuje = 0

  for (const def of defEtapas) {
    if (def.dias <= 0) {
      etapas.push({ ...def, inicio: null, fin: null, cuotaDiaria: 0, diasEmpujada: 0 })
      continue
    }

    if (def.esEspera) {
      const inicio = siguienteHabil(cursor)
      const fin = def.dias > 1 ? addHabiles(inicio, def.dias - 1) : inicio
      etapas.push({
        ...def,
        inicio: toYMD(inicio),
        fin: toYMD(fin),
        cuotaDiaria: 0,
        diasEmpujada: 0,
      })
      cursor = siguienteHabil(addDaysUTC(fin, 1))
      continue
    }

    const p = ctx.params.find((x) => x.area === def.key)
    const cuota = cantidad / def.dias

    // Sin parámetro o área inactiva → la etapa solo consume sus días (sin check).
    if (!p || !p.activo) {
      const inicio = siguienteHabil(cursor)
      const fin = def.dias > 1 ? addHabiles(inicio, def.dias - 1) : inicio
      etapas.push({ ...def, inicio: toYMD(inicio), fin: toYMD(fin), cuotaDiaria: cuota, diasEmpujada: 0 })
      cursor = siguienteHabil(addDaysUTC(fin, 1))
      continue
    }

    const diasDe = (inicio: Date): Date[] => {
      const dias: Date[] = []
      let d = siguienteHabil(inicio)
      while (dias.length < def.dias) {
        dias.push(d)
        d = siguienteHabil(addDaysUTC(d, 1))
      }
      return dias
    }

    if (esUrgente) {
      // No desliza: entra ya, consumiendo colchón; registra desplazadas si falta.
      const dias = diasDe(cursor)
      for (const d of dias) {
        const c = celdaATP(ctx, p, d)
        const disponible = c.atp + c.colchon // el colchón es para urgentes
        const deficit = cuota - disponible
        if (deficit > 0) {
          areaRestrictiva = areaRestrictiva ?? def.key
          const cargaDia = ctx.carga.get(def.key)?.get(toYMD(d))
          const candidatas = [...(cargaDia?.ordenes ?? [])].sort((a, b) =>
            (b.entrega ?? "9999").localeCompare(a.entrega ?? "9999")
          )
          let liberado = 0
          for (const o of candidatas) {
            if (liberado >= deficit) break
            const key = `${o.pedido}`
            if (desplazadasVistas.has(key)) continue
            desplazadasVistas.add(key)
            liberado += o.pcs
            desplazadas.push({ ...o, area: def.key, fecha: toYMD(d) })
          }
        }
      }
      const fin = dias[dias.length - 1]
      etapas.push({ ...def, inicio: toYMD(dias[0]), fin: toYMD(fin), cuotaDiaria: cuota, diasEmpujada: 0 })
      cursor = siguienteHabil(addDaysUTC(fin, 1))
      continue
    }

    // No urgente: deslizar hasta encontrar `dias` hábiles consecutivos con ATP ≥ cuota.
    let candidato = siguienteHabil(cursor)
    let colocada = false
    let empuje = 0
    while (candidato <= limite) {
      const dias = diasDe(candidato)
      const ok = dias.every((d) => celdaATP(ctx, p, d).atp >= cuota)
      if (ok) {
        const fin = dias[dias.length - 1]
        etapas.push({
          ...def,
          inicio: toYMD(dias[0]),
          fin: toYMD(fin),
          cuotaDiaria: cuota,
          diasEmpujada: empuje,
        })
        if (empuje > maxEmpuje) {
          maxEmpuje = empuje
          areaRestrictiva = def.key
        }
        cursor = siguienteHabil(addDaysUTC(fin, 1))
        colocada = true
        break
      }
      candidato = siguienteHabil(addDaysUTC(candidato, 1))
      empuje++
    }
    if (!colocada) {
      fallo = `No hay capacidad disponible en ${def.label} dentro del horizonte de ${HORIZONTE_SIM_DIAS} días.`
      areaRestrictiva = def.key
      etapas.push({ ...def, inicio: null, fin: null, cuotaDiaria: cuota, diasEmpujada: empuje })
      break
    }
  }

  const ultimaFin = [...etapas].reverse().find((e) => e.fin)?.fin ?? null
  // Días hábiles requeridos (inicio → fin, inclusivo).
  let diasHabiles = 0
  if (ultimaFin) {
    let d = new Date(inicioGlobal.getTime())
    const finDate = parseYMD(ultimaFin)!
    while (d <= finDate) {
      if (esLaboral(d)) diasHabiles++
      d = addDaysUTC(d, 1)
    }
  }

  const deseada = parseYMD(input.fechaDeseada ?? null)
  const factible =
    !fallo && (deseada && ultimaFin ? parseYMD(ultimaFin)! <= deseada : true)

  return {
    factible,
    fallo,
    fechaInicio: toYMD(inicioGlobal),
    fechaMasTemprana: ultimaFin,
    diasHabilesRequeridos: diasHabiles,
    areaRestrictiva,
    etapas,
    desplazadas,
  }
}

// ---------------------------------------------------------------------------
// Ocupación semanal por máquina de costura (Plana / Sorgete)
// ---------------------------------------------------------------------------

export interface OcupacionMaquinaSemana {
  inicio: Date
  fin: Date
  numero: number
  ano: number
  /** maquina → pcs pendientes de costura con entrega esa semana */
  porMaquina: Record<string, number>
}

export const MAQUINA_SIN_ASIGNAR = "Sin asignar"

/**
 * Prendas PENDIENTES de costura (coseta_costura null, orden activa que pasa
 * por Costura) agrupadas por semana de entrega efectiva y máquina asignada.
 * Entregas vencidas caen en la semana actual (todavía hay que coserlas).
 */
export function ocupacionPorMaquinaSemana(
  ordenes: OrdenCapacidad[],
  nSemanas = 8,
  hoy = hoyUTC()
): OcupacionMaquinaSemana[] {
  const lunes = lunesDeSemana(hoy)
  const semanas: OcupacionMaquinaSemana[] = []
  for (let i = 0; i < nSemanas; i++) {
    const inicio = addDaysUTC(lunes, i * 7)
    const { ano, numero } = semanaISO(inicio)
    semanas.push({ inicio, fin: addDaysUTC(inicio, 6), numero, ano, porMaquina: {} })
  }
  for (const o of ordenes) {
    if (!esOrdenActiva(o)) continue
    if (o.coseta_costura) continue // ya cosida
    if (!pasaPorArea("Costura", o)) continue
    const pcs = toPcs(o.pcs)
    if (pcs <= 0) continue
    const f = parseYMD(o.fecha_de_entreganueva || o.fecha_de_entrega)
    let idx = 0
    if (f && f >= lunes) {
      idx = Math.floor((f.getTime() - lunes.getTime()) / (7 * 86400000))
      if (idx >= nSemanas) continue
    }
    const maquinaRaw = (o.maquina_costura ?? "").toString().trim()
    const maquina = maquinaRaw
      ? maquinaRaw.toLowerCase().startsWith("sorg")
        ? "Sorgete"
        : maquinaRaw.toLowerCase().startsWith("plan")
        ? "Plana"
        : maquinaRaw
      : MAQUINA_SIN_ASIGNAR
    const sem = semanas[idx]
    sem.porMaquina[maquina] = (sem.porMaquina[maquina] ?? 0) + pcs
  }
  return semanas
}

/** Capacidad semanal por máquina (fila total: categoria null). */
export function capacidadSemanalMaquina(maquinas: MaquinaCapacidad[], maquina: string): number | null {
  const row = maquinas.find((m) => m.maquina === maquina && !m.categoria && m.activo)
  return row ? Number(row.pcs_semana) : null
}

/** Meta semanal total (suma de los totales por máquina); null si no hay datos. */
export function metaSemanalTotal(maquinas: MaquinaCapacidad[]): number | null {
  const totales = maquinas.filter((m) => !m.categoria && m.activo)
  if (!totales.length) return null
  return totales.reduce((s, m) => s + Number(m.pcs_semana), 0)
}
