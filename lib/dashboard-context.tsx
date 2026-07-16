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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface DashboardContextType {
  rows: VistaControlProduccion[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastUpdated: Date | null
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRows = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: qError } = await fetchAll((from, to) =>
        supabase.schema("telas").from("vista_control_produccion").select("*").range(from, to)
      )

      console.log("[v0] Dashboard - rows:", data?.length, "error:", qError)

      if (qError) {
        setError(qError.message)
        setRows([])
      } else {
        setRows((data || []) as VistaControlProduccion[])
        setLastUpdated(new Date())
      }
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

  // Filas activas: excluimos las ordenes ya entregadas al cliente
  // (s_estado_entrega === "Completado"). Estas son la base unica para
  // TODOS los KPIs principales del dashboard: total en produccion,
  // ordenes activas, alertas criticas, health score y conteos por riesgo.
  // Las ordenes Completadas ya salieron de la planta y no deben contar
  // como carga ni como alerta.
  const activeRows = useMemo(
    () =>
      rows.filter(
        (r) => (r.s_estado_entrega ?? "").toString() !== "Completado"
      ),
    [rows]
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
        if (typeof v === "number" && !Number.isNaN(v) && v > 0) values.push(v)
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
        if (typeof v === "number" && !Number.isNaN(v) && v > 0) values.push(v)
      })
      const avg =
        values.length > 0
          ? +(values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
          : 0
      return { area: AREA_LABEL[key], key, dias: avg }
    })
  }, [rows])

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
