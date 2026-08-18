/**
 * Línea de tiempo y tiempos entre procesos de una solicitud de diseño.
 *
 * Reconstruye el recorrido de una gestión a partir de las fechas que ya se
 * guardan (creación, asignación al diseñador, cada propuesta con su respuesta
 * de cliente/ventas, aprobación final y entrega de archivos) y calcula cuánto
 * duró cada tramo y quién lo tenía.
 *
 * Funciones puras: no hacen I/O, reciben la gestión ya cargada.
 */

import type { GestionDiseno } from "@/lib/gestion-disenos-types"

/** Quién es responsable del tramo que TERMINA en este hito. */
export type Responsable = "Ventas" | "Diseño" | "Cliente" | "—"

export interface HitoTiempo {
  id: string
  label: string
  /** Detalle corto (número de propuesta, decisión, etc.). */
  detalle?: string
  fecha: Date
  /** Quién tuvo la solicitud durante el tramo previo a este hito. */
  responsable: Responsable
  /** Milisegundos desde el hito anterior (null en el primero). */
  desdeAnterior: number | null
}

export interface ResumenTiempos {
  hitos: HitoTiempo[]
  /** Total desde la creación hasta el último hito (o hasta hoy si sigue viva). */
  totalMs: number | null
  /** True si la solicitud sigue en curso (el total corre contra hoy). */
  enCurso: boolean
  /** Acumulado por responsable. */
  porResponsable: Record<Responsable, number>
  /** Nº de propuestas subidas. */
  propuestas: number
  /** Ciclos de cambio = respuestas "Con Cambios" de ventas. */
  ciclosCambio: number
  /** Creación → primera propuesta (velocidad de arranque). */
  msHastaPrimeraPropuesta: number | null
  /** Creación → aprobación definitiva. */
  msHastaAprobacion: number | null
}

const fecha = (v: string | null | undefined): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Formatea una duración en milisegundos como "3d 4h" / "5h 20m" / "12m". */
export function formatDuracion(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—"
  if (ms < 0) return "—"
  const totalMin = Math.floor(ms / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** Días con decimal, para promedios de indicadores. */
export function msADias(ms: number | null | undefined): number | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null
  return ms / 86400000
}

/**
 * Construye la línea de tiempo de una solicitud.
 *
 * El responsable de cada tramo se deduce del hito al que se llega:
 *  - Solicitud creada → arranca en Ventas.
 *  - Aceptada por Diseño: el tramo previo lo tuvo Ventas (esperando envío) /
 *    Diseño (esperando revisión).
 *  - Propuesta subida: el tramo lo trabajó Diseño.
 *  - Respuesta del cliente: el tramo estuvo en Cliente.
 *  - Respuesta de Ventas / aprobación: el tramo estuvo en Ventas.
 *  - Archivos finales: el tramo lo trabajó Diseño.
 */
export function construirTiempos(s: GestionDiseno, ahora = new Date()): ResumenTiempos {
  const brutos: Omit<HitoTiempo, "desdeAnterior">[] = []

  const creacion = fecha(s.fecha_creacion)
  if (creacion) {
    brutos.push({
      id: "creacion",
      label: "Solicitud creada",
      detalle: s.vendedora ? `por ${s.vendedora}` : undefined,
      fecha: creacion,
      responsable: "—",
    })
  }

  const asignacion = fecha(s.fecha_asignacion)
  if (asignacion) {
    brutos.push({
      id: "asignacion",
      label: "Aceptada por Diseño",
      detalle: s.disenador ? `asignada a ${s.disenador}` : undefined,
      fecha: asignacion,
      responsable: "Ventas",
    })
  }

  const propuestas = [...(s.propuestas ?? [])].sort(
    (a, b) => (a.numero_propuesta ?? 0) - (b.numero_propuesta ?? 0)
  )

  for (const p of propuestas) {
    const n = p.numero_propuesta ?? 0
    const subida = fecha(p.fecha_subida)
    if (subida) {
      brutos.push({
        id: `prop-${p.id}-subida`,
        label: `Propuesta ${n} enviada`,
        fecha: subida,
        responsable: "Diseño",
      })
    }
    const respCliente = fecha(p.fecha_respuesta_cliente)
    if (respCliente) {
      brutos.push({
        id: `prop-${p.id}-cliente`,
        label: `Respuesta del cliente`,
        detalle: p.respuesta_cliente ?? undefined,
        fecha: respCliente,
        responsable: "Cliente",
      })
    }
    const respVentas = fecha(p.fecha_respuesta_ventas)
    if (respVentas) {
      brutos.push({
        id: `prop-${p.id}-ventas`,
        label: `Respuesta de Ventas`,
        detalle: p.respuesta_ventas ?? undefined,
        fecha: respVentas,
        responsable: "Ventas",
      })
    }
    const finales = fecha(p.fecha_archivos_finales)
    if (finales) {
      brutos.push({
        id: `prop-${p.id}-finales`,
        label: "Archivos finales entregados",
        fecha: finales,
        responsable: "Diseño",
      })
    }
  }

  const aprobacion = fecha(s.fecha_aprobacion)
  if (aprobacion) {
    brutos.push({
      id: "aprobacion",
      label:
        s.aprobacion_ventas === "NO APROBADO"
          ? "Rechazo definitivo"
          : "Aprobación definitiva",
      detalle: s.aprobacion_ventas ?? undefined,
      fecha: aprobacion,
      responsable: "Ventas",
    })
  }

  // Orden cronológico y cálculo del tramo entre hitos.
  brutos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
  const hitos: HitoTiempo[] = brutos.map((h, i) => ({
    ...h,
    desdeAnterior:
      i === 0 ? null : h.fecha.getTime() - brutos[i - 1].fecha.getTime(),
  }))

  // Acumulado por responsable.
  const porResponsable: Record<Responsable, number> = {
    Ventas: 0,
    "Diseño": 0,
    Cliente: 0,
    "—": 0,
  }
  for (const h of hitos) {
    if (h.desdeAnterior != null) porResponsable[h.responsable] += h.desdeAnterior
  }

  const finalizada = s.estado === "Finalizado" || s.estado === "Rechazado"
  const ultima = hitos.length ? hitos[hitos.length - 1].fecha : null
  const totalMs =
    creacion && ultima
      ? (finalizada ? ultima.getTime() : ahora.getTime()) - creacion.getTime()
      : null

  const primeraPropuesta = hitos.find((h) => h.id.endsWith("-subida"))
  const ciclosCambio = propuestas.filter(
    (p) => (p.respuesta_ventas ?? "").toLowerCase().includes("cambio")
  ).length

  return {
    hitos,
    totalMs,
    enCurso: !finalizada,
    porResponsable,
    propuestas: propuestas.length,
    ciclosCambio,
    msHastaPrimeraPropuesta:
      creacion && primeraPropuesta
        ? primeraPropuesta.fecha.getTime() - creacion.getTime()
        : null,
    msHastaAprobacion:
      creacion && aprobacion ? aprobacion.getTime() - creacion.getTime() : null,
  }
}

// ---------------------------------------------------------------------------
// Indicadores agregados (promedios sobre varias solicitudes)
// ---------------------------------------------------------------------------

export interface IndicadoresGD {
  /** Solicitudes consideradas para los promedios. */
  n: number
  /** Promedio en días: creación → aceptada por Diseño. */
  diasAceptacion: number | null
  /** Promedio en días: creación → primera propuesta. */
  diasPrimeraPropuesta: number | null
  /** Promedio en días: creación → aprobación definitiva (solo aprobadas). */
  diasAprobacion: number | null
  /** Promedio en días del ciclo completo (solo finalizadas). */
  diasTotal: number | null
  /** Promedio de propuestas por solicitud. */
  propuestasPromedio: number | null
  /** Promedio de ciclos de cambio por solicitud. */
  ciclosPromedio: number | null
  /** Reparto del tiempo por responsable, en días promedio. */
  diasPorResponsable: { responsable: Responsable; dias: number }[]
}

const promedio = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

export function calcularIndicadores(
  solicitudes: GestionDiseno[],
  ahora = new Date()
): IndicadoresGD {
  const resumenes = solicitudes.map((s) => ({ s, t: construirTiempos(s, ahora) }))

  const aceptacion: number[] = []
  const primera: number[] = []
  const aprobacion: number[] = []
  const total: number[] = []
  const acumResp: Record<Responsable, number[]> = {
    Ventas: [],
    "Diseño": [],
    Cliente: [],
    "—": [],
  }

  for (const { s, t } of resumenes) {
    const hAsig = t.hitos.find((h) => h.id === "asignacion")
    if (hAsig?.desdeAnterior != null) {
      const d = msADias(hAsig.desdeAnterior)
      if (d != null) aceptacion.push(d)
    }
    const dp = msADias(t.msHastaPrimeraPropuesta)
    if (dp != null) primera.push(dp)
    const da = msADias(t.msHastaAprobacion)
    if (da != null) aprobacion.push(da)
    if (!t.enCurso) {
      const dt = msADias(t.totalMs)
      if (dt != null) total.push(dt)
    }
    for (const r of ["Ventas", "Diseño", "Cliente"] as Responsable[]) {
      const d = msADias(t.porResponsable[r])
      if (d != null && d > 0) acumResp[r].push(d)
    }
    void s
  }

  return {
    n: solicitudes.length,
    diasAceptacion: promedio(aceptacion),
    diasPrimeraPropuesta: promedio(primera),
    diasAprobacion: promedio(aprobacion),
    diasTotal: promedio(total),
    propuestasPromedio: promedio(resumenes.map((r) => r.t.propuestas)),
    ciclosPromedio: promedio(resumenes.map((r) => r.t.ciclosCambio)),
    diasPorResponsable: (["Ventas", "Diseño", "Cliente"] as Responsable[])
      .map((r) => ({ responsable: r, dias: promedio(acumResp[r]) ?? 0 }))
      .filter((x) => x.dias > 0),
  }
}
