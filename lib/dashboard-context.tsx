"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import type {
  VistaControlProduccion,
  StatusArea,
  NivelRiesgo,
} from "@/lib/types"
import { fetchAll } from "@/lib/fetch-all"
import {
  AREAS_LT,
  AREA_LABEL_LT,
  promedioDias,
  type AreaLT,
  type LeadTimeUnificadoRow,
} from "@/lib/lead-time-unificado"
import { pasaPorArea } from "@/lib/capacidad/motor"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface AreaEfficiency {
  area: string
  key: AreaLT
  // Dos cálculos: vigentes (en planta) y total (con cerrados).
  enProceso: number
  general: number
  nEnProceso: number
  nGeneral: number
}

/**
 * Adherencia a la fecha objetivo por área (% de cumplimiento).
 *  - enProceso: pedidos vigentes en planta AHORA. Si el área ya cerró se
 *    compara fin vs objetivo; si sigue abierta, se compara HOY vs objetivo
 *    (sigue a tiempo o ya se pasó) — así refleja el riesgo vivo.
 *  - general: pedidos ENTREGADOS AL CLIENTE DENTRO DEL MES EN CURSO
 *    = desempeño real cerrado del mes.
 */
export interface AreaAdherence {
  area: string
  key: string
  enProceso: number
  general: number
  nEnProceso: number
  nGeneral: number
}

/** Fila de cabecera con fechas objetivo/fin por área (para adherencia). */
interface AdherenciaRow {
  pedido: string
  estado_aprobado_rechazado: string | null
  efecha_de_empaque: string | null
  entregado_cliente_si_no: boolean | null
  fecha_entrega_cliente: string | null
  tipo_flujo_especial: string | null
  solo_corte_costura: boolean | null
  costura_si_no: boolean | string | null
  accesorios_inventario: string | null
  dfecha_objetivo_d: string | null
  cfecha_objetivo_c: string | null
  ifecha_objetivo_i: string | null
  sfecha_objetivo_s: string | null
  cosfecha_objetivo_cs: string | null
  efecha_objetivo_e: string | null
  dentrega_diseno: string | null
  cfecha_de_corte: string | null
  ientrega_impresion: string | null
  seta_sublimacion: string | null
  coseta_costura: string | null
}

/** Fila de telas.vista_kpi_adherencia (misma fuente que el módulo Indicadores). */
interface KpiAdhRow {
  ano: number | null
  mes: number | null
  semana: number | null
  total_ordenes: number | null
  adherencia_diseno: number | null
  adherencia_impresion: number | null
  adherencia_sublimacion: number | null
  adherencia_corte: number | null
  adherencia_costura: number | null
  adherencia_empaque: number | null
}

/**
 * Áreas con adherencia: objetivo vs fin. Orden = flujo real de planta
 * (Diseño → Impresión → Corte → Sublimación → Costura), con Empaque al cierre.
 */
const AREAS_ADH: {
  key: string
  label: string
  /** Clave del área en el motor de flujos (lib/capacidad/motor.ts). */
  motor: string
  /** Columna equivalente en telas.vista_kpi_adherencia. */
  kpi: keyof KpiAdhRow
  objetivo: keyof AdherenciaRow
  fin: keyof AdherenciaRow
}[] = [
  { key: "diseno", label: "Diseño", motor: "Diseno", kpi: "adherencia_diseno", objetivo: "dfecha_objetivo_d", fin: "dentrega_diseno" },
  { key: "impresion", label: "Impresión", motor: "Impresion", kpi: "adherencia_impresion", objetivo: "ifecha_objetivo_i", fin: "ientrega_impresion" },
  { key: "corte", label: "Corte", motor: "Corte", kpi: "adherencia_corte", objetivo: "cfecha_objetivo_c", fin: "cfecha_de_corte" },
  { key: "sublimacion", label: "Sublimación", motor: "Sublimacion", kpi: "adherencia_sublimacion", objetivo: "sfecha_objetivo_s", fin: "seta_sublimacion" },
  { key: "costura", label: "Costura", motor: "Costura", kpi: "adherencia_costura", objetivo: "cosfecha_objetivo_cs", fin: "coseta_costura" },
  { key: "empaque", label: "Empaque", motor: "Empaque", kpi: "adherencia_empaque", objetivo: "efecha_objetivo_e", fin: "efecha_de_empaque" },
]

interface DashboardContextType {
  rows: VistaControlProduccion[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastUpdated: Date | null
  // Fuente única por-orden para la Eficiencia de Tiempos (vista unificada).
  leadRows: LeadTimeUnificadoRow[]
  efficiencyByArea: AreaEfficiency[]
  adherenceByArea: AreaAdherence[]
  // Derived metrics
  totalPcs: number
  totalOrders: number
  criticalAlerts: number
  avgLeadTime: number
  workloadByArea: AreaWorkload[]
  avgDaysByArea: AreaAverage[]
  // Variante del promedio por area que incluye TODAS las ordenes
  // (incluso las ya Completadas). Se usa unicamente en el grafico de
  // Eficiencia de Tiempos para reflejar el rendimiento historico real
  // sin perder las ordenes que ya salieron de la planta.
  avgDaysByAreaAll: AreaAverage[]
  riskRows: VistaControlProduccion[]
  // New metrics for modern dashboard
  healthScore: number // % of orders A Tiempo
  onTimeCount: number
  mediumRiskCount: number
  overdueCount: number
  bottleneckKey: AreaKey | null // Area with highest active load
}

export interface AreaWorkload {
  area: string
  key: AreaKey
  Recibido: number
  Pendiente: number
  // "En espera" = la orden aun esta en un proceso anterior y esta area no
  // puede tocarla. Se grafica con color suave porque no es carga real para
  // el area, pero si predice lo que se viene.
  EnEspera: number
}

export interface AreaAverage {
  area: string
  key: AreaKey
  dias: number
}

export type AreaKey =
  | "diseno"
  | "corte"
  | "impresion"
  | "sublimacion"
  | "costura"
  | "empaque"

const AREA_LABEL: Record<AreaKey, string> = {
  diseno: "Diseno",
  corte: "Corte",
  impresion: "Impresion",
  sublimacion: "Sublimacion",
  costura: "Costura",
  empaque: "Empaque",
}

const statusFor = (
  row: VistaControlProduccion,
  key: AreaKey
): StatusArea | null => {
  switch (key) {
    case "diseno":
      return (row.status_diseno as StatusArea) ?? null
    case "corte":
      return (row.status_corte as StatusArea) ?? null
    case "impresion":
      return (row.status_impresion as StatusArea) ?? null
    case "sublimacion":
      return (row.status_sublimacion as StatusArea) ?? null
    case "costura":
      return (row.status_costura as StatusArea) ?? null
    case "empaque":
      return (row.status_empaque as StatusArea) ?? null
  }
}

const daysFor = (
  row: VistaControlProduccion,
  key: Exclude<AreaKey, "empaque">
): number | null => {
  switch (key) {
    case "diseno":
      return row.dias_en_diseno ?? null
    case "corte":
      return row.dias_en_corte ?? null
    case "impresion":
      return row.dias_en_impresion ?? null
    case "sublimacion":
      return row.dias_en_sublimacion ?? null
    case "costura":
      return row.dias_en_costura ?? null
  }
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<VistaControlProduccion[]>([])
  const [leadRows, setLeadRows] = useState<LeadTimeUnificadoRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // Pedidos ya entregados al cliente o cancelados. La vista de control NO
  // expone esos campos, así que los traemos de cabecera para excluirlos de los
  // KPIs de riesgo (una orden entregada —p. ej. COMPRA_EXTERNA— no debe seguir
  // contando como vencida/riesgo).
  const [excludedPedidos, setExcludedPedidos] = useState<Set<string>>(new Set())
  // Filas de cabecera con fechas objetivo/fin por área (adherencia).
  const [adhRows, setAdhRows] = useState<AdherenciaRow[]>([])
  // Adherencia del mes desde la MISMA vista que usa el módulo Indicadores,
  // para que los números cuadren entre ambos módulos.
  const [kpiAdhRows, setKpiAdhRows] = useState<KpiAdhRow[]>([])

  const fetchRows = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const ahoraF = new Date()
      const [ctrl, lead, cab, adh, kpiAdh] = await Promise.all([
        fetchAll((from, to) =>
          supabase.schema("telas").from("vista_control_produccion").select("*").range(from, to)
        ),
        fetchAll((from, to) =>
          supabase.schema("telas").from("vista_lead_times_unificado").select("*").range(from, to)
        ),
        fetchAll((from, to) =>
          supabase
            .schema("telas")
            .from("cabecera")
            .select("pedido, entregado_cliente_si_no, estado_aprobado_rechazado")
            .or("entregado_cliente_si_no.eq.true,estado_aprobado_rechazado.eq.cancelado")
            .range(from, to)
        ),
        // Adherencia: fechas objetivo (fijadas al aprobar) vs fechas de fin.
        fetchAll<AdherenciaRow>((from, to) =>
          supabase
            .schema("telas")
            .from("cabecera")
            .select(
              "pedido, estado_aprobado_rechazado, efecha_de_empaque, entregado_cliente_si_no, fecha_entrega_cliente, tipo_flujo_especial, solo_corte_costura, costura_si_no, accesorios_inventario, dfecha_objetivo_d, cfecha_objetivo_c, ifecha_objetivo_i, sfecha_objetivo_s, cosfecha_objetivo_cs, efecha_objetivo_e, dentrega_diseno, cfecha_de_corte, ientrega_impresion, seta_sublimacion, coseta_costura"
            )
            .eq("estado_aprobado_rechazado", "Aprobado")
            .range(from, to) as never
        ),
        // Adherencia oficial del mes en curso (fuente compartida con Indicadores).
        fetchAll<KpiAdhRow>((from, to) =>
          supabase
            .schema("telas")
            .from("vista_kpi_adherencia")
            .select("*")
            .eq("ano", ahoraF.getFullYear())
            .eq("mes", ahoraF.getMonth() + 1)
            .range(from, to) as never
        ),
      ])

      console.log("[v0] Dashboard - rows:", ctrl.data?.length, "lead:", lead.data?.length, "error:", ctrl.error || lead.error)

      if (ctrl.error) {
        setError(ctrl.error.message)
        setRows([])
      } else {
        setRows((ctrl.data || []) as VistaControlProduccion[])
        setLastUpdated(new Date())
      }

      if (lead.error) {
        // No romper el dashboard si la vista aún no existe; solo la Eficiencia
        // quedará vacía hasta ejecutar scripts/vista_lead_times_unificado.sql.
        setLeadRows([])
      } else {
        setLeadRows((lead.data || []) as LeadTimeUnificadoRow[])
      }

      // Conjunto de pedidos entregados/cancelados (para excluir de riesgo).
      if (!cab.error) {
        const excl = new Set<string>()
        for (const c of (cab.data || []) as {
          pedido: string
          entregado_cliente_si_no: boolean | null
          estado_aprobado_rechazado: string | null
        }[]) {
          const p = String(c.pedido ?? "")
          if (!p) continue
          const cancelado =
            (c.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase() ===
            "cancelado"
          if (c.entregado_cliente_si_no === true || cancelado) excl.add(p)
        }
        setExcludedPedidos(excl)
      }

      if (!adh.error) setAdhRows((adh.data || []) as AdherenciaRow[])
      if (!kpiAdh.error) setKpiAdhRows((kpiAdh.data || []) as KpiAdhRow[])
    } catch (err) {
      console.log("[v0] Dashboard - unexpected error:", err)
      setError(err instanceof Error ? err.message : "Error desconocido")
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  // Filas activas: excluimos las ordenes ya ENTREGADAS al cliente o CANCELADAS
  // (por pedido, cruzando con cabecera). Antes se usaba
  // `s_estado_entrega === "Completado"` como proxy, pero ese es el estado de la
  // entrega Sublimación→Costura y NUNCA aplica a flujos sin sublimado (p. ej.
  // COMPRA_EXTERNA), por lo que órdenes ya entregadas seguían contando como
  // vencidas/riesgo. Estas filas son la base única de TODOS los KPIs de riesgo.
  const activeRows = useMemo(
    () => rows.filter((r) => !excludedPedidos.has(String(r.pedido ?? ""))),
    [rows, excludedPedidos]
  )

  // Global KPIs - todos derivados de activeRows
  const totalPcs = useMemo(
    () => activeRows.reduce((s, r) => s + (Number(r.pcs) || 0), 0),
    [activeRows]
  )

  const totalOrders = activeRows.length

  const criticalAlerts = useMemo(
    () =>
      activeRows.filter((r) => {
        const n = (r.nivel_riesgo || "") as NivelRiesgo
        return n === "Vencido" || n === "Riesgo Crítico"
      }).length,
    [activeRows]
  )

  // Promedio de dias acumulados en produccion, calculado solo sobre ordenes
  // que tienen al menos un area completada (dias > 0). Excluir ordenes sin
  // ningun area terminada evita que diluyan el promedio.
  const avgLeadTime = useMemo(() => {
    const leadTimes = activeRows
      .map((r) => {
        const values = [
          r.dias_en_diseno,
          r.dias_en_corte,
          r.dias_en_impresion,
          r.dias_en_sublimacion,
          r.dias_en_costura,
        ].filter((v): v is number => typeof v === "number" && !Number.isNaN(v) && v > 0)
        return values.length > 0 ? values.reduce((s, v) => s + v, 0) : null
      })
      .filter((v): v is number => v !== null)
    if (leadTimes.length === 0) return 0
    return +(leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length).toFixed(1)
  }, [activeRows])

  // Embudos de carga de trabajo por departamento
  const workloadByArea = useMemo<AreaWorkload[]>(() => {
    const areas: AreaKey[] = [
      "diseno",
      "corte",
      "impresion",
      "sublimacion",
      "costura",
      "empaque",
    ]
    return areas.map((key) => {
      let recibido = 0
      let pendiente = 0
      let enEspera = 0
      activeRows.forEach((r) => {
        const s = statusFor(r, key)
        if (s === "Recibido") recibido++
        else if (s === "Pendiente") pendiente++
        else if (s === "En espera") enEspera++
      })
      return {
        area: AREA_LABEL[key],
        key,
        Recibido: recibido,
        Pendiente: pendiente,
        EnEspera: enEspera,
      }
    })
  }, [activeRows])

  // Promedio de dias por departamento (eficiencia de tiempos)
  const avgDaysByArea = useMemo<AreaAverage[]>(() => {
    const areas: Exclude<AreaKey, "empaque">[] = [
      "diseno",
      "corte",
      "impresion",
      "sublimacion",
      "costura",
    ]
    return areas.map((key) => {
      const values: number[] = []
      activeRows.forEach((r) => {
        const v = daysFor(r, key)
        // Incluye los trabajos del mismo dia (0 dias): la vista deja dias_en_*
        // en null cuando el area aun no termino, y en un numero (0 o mas)
        // cuando ya termino. Contar el 0 refleja el desempeno real.
        if (typeof v === "number" && !Number.isNaN(v) && v >= 0) values.push(v)
      })
      const avg =
        values.length > 0
          ? +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
          : 0
      return { area: AREA_LABEL[key], key, dias: avg }
    })
  }, [activeRows])

  // Promedio de dias por area considerando TODAS las ordenes (incluye
  // Completadas). Es la fuente de datos del grafico "Eficiencia de
  // Tiempos": para medir el rendimiento real de cada area conviene
  // incluir las ordenes ya entregadas, porque son las que efectivamente
  // ya pasaron por el ciclo completo.
  const avgDaysByAreaAll = useMemo<AreaAverage[]>(() => {
    const areas: Exclude<AreaKey, "empaque">[] = [
      "diseno",
      "corte",
      "impresion",
      "sublimacion",
      "costura",
    ]
    return areas.map((key) => {
      const values: number[] = []
      rows.forEach((r) => {
        const v = daysFor(r, key)
        // Incluye 0 dias (mismo dia). Ver nota en avgDaysByArea.
        if (typeof v === "number" && !Number.isNaN(v) && v >= 0) values.push(v)
      })
      const avg =
        values.length > 0
          ? +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
          : 0
      return { area: AREA_LABEL[key], key, dias: avg }
    })
  }, [rows])

  // Eficiencia de Tiempos: dos cálculos por área desde la vista unificada.
  //  - enProceso: solo pedidos vigentes (aprobados y aún no empacados)
  //  - general: TODOS los pedidos (incluye cerrados) = desempeño real
  const efficiencyByArea = useMemo<AreaEfficiency[]>(() => {
    const enProcesoRows = leadRows.filter((r) => r.en_proceso === true)
    return AREAS_LT.map((key) => {
      const enP = promedioDias(enProcesoRows, key)
      const gen = promedioDias(leadRows, key)
      return {
        area: AREA_LABEL_LT[key],
        key,
        enProceso: enP.avg,
        general: gen.avg,
        nEnProceso: enP.n,
        nGeneral: gen.n,
      }
    })
  }, [leadRows])

  // Adherencia por área: % de cumplimiento de la fecha objetivo.
  //  - general: de las órdenes que YA terminaron el área, cuántas lo hicieron
  //    en o antes de su fecha objetivo (desempeño real, incluye cerrados).
  //  - enProceso: solo órdenes vigentes (aprobadas, sin empacar). Si el área ya
  //    cerró se juzga fin vs objetivo; si sigue abierta se juzga HOY vs objetivo
  //    (aún a tiempo vs ya vencida), de modo que refleja el riesgo vivo.
  const adherenceByArea = useMemo<AreaAdherence[]>(() => {
    const hoy = new Date(new Date().toDateString()).getTime()
    const ts = (v: string | null): number | null => {
      if (!v) return null
      const t = new Date(String(v).slice(0, 10)).getTime()
      return Number.isNaN(t) ? null : t
    }
    // "General" sale de telas.vista_kpi_adherencia (mes en curso), ponderado por
    // total_ordenes — idéntico al módulo Indicadores para que los datos cuadren.
    const totOrd = kpiAdhRows.reduce((acc, r) => acc + (Number(r.total_ordenes) || 0), 0)
    const adhKpi = (col: keyof KpiAdhRow): { pct: number; n: number } => {
      if (totOrd <= 0) return { pct: 0, n: 0 }
      const wsum = kpiAdhRows.reduce(
        (acc, r) => acc + (Number(r[col]) || 0) * (Number(r.total_ordenes) || 0),
        0
      )
      return { pct: Math.round((wsum / totOrd) * 10) / 10, n: totOrd }
    }
    return AREAS_ADH.map((a) => {
      const gen = adhKpi(a.kpi)
      let okProc = 0
      let nProc = 0
      for (const r of adhRows) {
        // Solo cuenta si el área aplica al flujo de la orden.
        if (!pasaPorArea(a.motor, r as never)) continue
        const obj = ts(r[a.objetivo] as string | null)
        if (obj === null) continue
        const fin = ts(r[a.fin] as string | null)
        const vigente = !r.efecha_de_empaque
        if (vigente) {
          nProc++
          // Sin cerrar: sigue a tiempo mientras hoy no pase el objetivo.
          if (fin !== null ? fin <= obj : hoy <= obj) okProc++
        }
      }
      return {
        area: a.label,
        key: a.key,
        enProceso: nProc > 0 ? Math.round((okProc / nProc) * 1000) / 10 : 0,
        general: gen.pct,
        nEnProceso: nProc,
        nGeneral: gen.n,
      }
    })
  }, [adhRows, kpiAdhRows])

  // Counts por nivel de riesgo (para distribucion y health score).
  // Calculados sobre activeRows: una orden ya Completada no debe sumar
  // como "A Tiempo" ni como alerta de Vencido / Riesgo Medio.
  const { onTimeCount, mediumRiskCount, overdueCount } = useMemo(() => {
    let a = 0
    let m = 0
    let v = 0
    activeRows.forEach((r) => {
      const n = (r.nivel_riesgo || "") as NivelRiesgo
      if (n === "A Tiempo") a++
      else if (n === "Riesgo Medio") m++
      else if (n === "Vencido") v++
    })
    return { onTimeCount: a, mediumRiskCount: m, overdueCount: v }
  }, [activeRows])

  // Health score: % de pedidos A Tiempo sobre el total de ordenes activas
  // (excluye las ya Completadas).
  const healthScore = useMemo(() => {
    if (activeRows.length === 0) return 0
    return Math.round((onTimeCount / activeRows.length) * 100)
  }, [activeRows.length, onTimeCount])

  // Cuello de botella: area con mayor carga activa (Recibido + Pendiente)
  const bottleneckKey = useMemo<AreaKey | null>(() => {
    if (workloadByArea.length === 0) return null
    const sorted = [...workloadByArea].sort(
      (a, b) => b.Recibido + b.Pendiente - (a.Recibido + a.Pendiente)
    )
    const top = sorted[0]
    // Si la primera no tiene carga, no hay cuello
    if (!top || top.Recibido + top.Pendiente === 0) return null
    return top.key
  }, [workloadByArea])

  // Radar de Riesgo (solo Vencido + Riesgo Crítico, ordenados por dias_para_entrega asc).
  // Calculado sobre activeRows para no incluir ordenes ya entregadas.
  const riskRows = useMemo(
    () =>
      activeRows
        .filter((r) => {
          const n = (r.nivel_riesgo || "") as NivelRiesgo
          return n === "Vencido" || n === "Riesgo Crítico"
        })
        .sort((a, b) => {
          const da =
            typeof a.dias_para_entrega === "number"
              ? a.dias_para_entrega
              : Number.POSITIVE_INFINITY
          const db =
            typeof b.dias_para_entrega === "number"
              ? b.dias_para_entrega
              : Number.POSITIVE_INFINITY
          return da - db
        }),
    [activeRows]
  )

  return (
    <DashboardContext.Provider
      value={{
        rows,
        isLoading,
        error,
        refresh: fetchRows,
        lastUpdated,
        leadRows,
        efficiencyByArea,
        adherenceByArea,
        totalPcs,
        totalOrders,
        criticalAlerts,
        avgLeadTime,
        workloadByArea,
        avgDaysByArea,
        avgDaysByAreaAll,
        riskRows,
        healthScore,
        onTimeCount,
        mediumRiskCount,
        overdueCount,
        bottleneckKey,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider")
  }
  return ctx
}
