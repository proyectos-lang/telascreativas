"use client"

/**
 * IncidenciasReporteContext
 * --------------------------------------------------------------------------
 * Contexto del modulo "Reporte de Incidencias". Centraliza:
 *
 *  1. Fetch unico a `telas.incidencias` (todas las filas — el modulo es un
 *     dashboard analitico, no esta segmentado por area como `IncidenciasTab`).
 *  2. Estado de filtros UI: estado_reposicion, area_genera, rango de fechas
 *     y texto de busqueda libre. Se aplican en cliente sobre la lista cruda.
 *  3. Memos de KPIs y series para los charts (bar, line, pies). Calcular
 *     aqui evita que cada componente recalcule lo mismo, y permite que los
 *     filtros afecten *solo* la tabla mientras los KPIs/charts mantienen la
 *     vista global del periodo seleccionado por el filtro de fechas.
 *  4. Helper `procesarIncidencia` para que la tabla / modal hagan el UPDATE
 *     y mantengan la cache local sin refetch completo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

/** Shape de telas.incidencias (subset usado por el reporte) */
export interface IncidenciaReporte {
  id: number | string
  pedido: string
  area_reporta: string
  area_genera: string
  descripcion: string | null
  genera_reposicion: boolean | null
  partes_reposicion: string | null
  procesos_reposicion: string[] | null
  estado_reposicion: string | null
  fecha_reporte: string | null
  fecha_procesado: string | null
  talla: string | null
  genero: string | null
  motivo_especifico: string | null
  created_at?: string | null
}

export type EstadoFiltro = "todos" | "pendiente" | "procesado" | "sin"
export type AreaFiltro = "todas" | string

export interface FiltrosState {
  estado: EstadoFiltro
  area: AreaFiltro
  desde: string | null // YYYY-MM-DD
  hasta: string | null // YYYY-MM-DD
  search: string
}

interface KpisData {
  /** Top areas que mas reportan incidencias */
  topReporta: { area: string; count: number } | null
  /** Top areas responsables (mas errores generados) */
  topGenera: { area: string; count: number } | null
  /** Total de incidencias en el mes actual (calendario) */
  totalMes: number
  /** Total de incidencias del dia de hoy */
  totalHoy: number
  /**
   * Tiempo promedio entre fecha_reporte y fecha_procesado (solo
   * incluye filas resueltas con ambas fechas presentes), en horas.
   */
  tiempoRespuestaHoras: number | null
  /** N de filas que cuentan para el promedio (transparencia) */
  resueltasCount: number
}

interface IncidenciasReporteContextValue {
  // Datos crudos + estado
  incidencias: IncidenciaReporte[]
  filteredIncidencias: IncidenciaReporte[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  // Acciones
  procesarIncidencia: (id: IncidenciaReporte["id"]) => Promise<{
    ok: boolean
    error?: string
  }>
  // Filtros
  filtros: FiltrosState
  setFiltros: (next: Partial<FiltrosState>) => void
  resetFiltros: () => void
  areasGenera: string[] // dropdown de filtro
  // Memos para charts/KPIs (calculados sobre `filteredIncidencias`)
  kpis: KpisData
  porAreaGenera: { area: string; total: number; pendientes: number }[]
  porFechaSerie: { fecha: string; count: number }[]
  /**
   * Distribucion de incidencias por la(s) parte(s) afectada(s) en
   * `partes_reposicion`. La columna se persiste como CSV (ej. "Cuello,
   * Mangas, Front") por lo que aqui hacemos split y contamos cada parte
   * de forma independiente: una incidencia con 3 partes incrementa 3
   * categorias. Las filas sin reposicion (genera_reposicion = false) o
   * con `partes_reposicion` vacio se ignoran para mantener el chart
   * enfocado solo en lo que realmente hay que reponer.
   */
  porPartesReposicion: { name: string; value: number }[]
  /**
   * Distribucion por `estado_reposicion`. Solo cuenta incidencias con
   * `genera_reposicion = true`. Normaliza valores a:
   *   - "Pendiente"  (estado_reposicion = "pendiente" o null)
   *   - "Procesado"  (estado_reposicion = "procesado")
   *   - "Otro"       (cualquier otro string raro en BD, defensivo)
   * Esto permite ver de un vistazo cuantas reposiciones siguen abiertas
   * vs cerradas en el periodo seleccionado.
   */
  porEstadoReposicion: { name: string; value: number }[]
}

const IncidenciasReporteContext =
  createContext<IncidenciasReporteContextValue | null>(null)

const INITIAL_FILTROS: FiltrosState = {
  estado: "todos",
  area: "todas",
  desde: null,
  hasta: null,
  search: "",
}

/** Devuelve la fecha "YYYY-MM-DD" del valor (preferimos fecha_reporte). */
function getFechaISO(inc: IncidenciaReporte): string | null {
  const raw = inc.fecha_reporte || inc.created_at
  if (!raw) return null
  // raw puede ser "YYYY-MM-DD" o ISO completo. Tomamos los 10 primeros.
  return raw.slice(0, 10)
}

export function IncidenciasReporteProvider({
  children,
}: {
  children: ReactNode
}) {
  const [incidencias, setIncidencias] = useState<IncidenciaReporte[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltrosState] = useState<FiltrosState>(INITIAL_FILTROS)

  const setFiltros = useCallback((next: Partial<FiltrosState>) => {
    setFiltrosState((prev) => ({ ...prev, ...next }))
  }, [])

  const resetFiltros = useCallback(() => {
    setFiltrosState(INITIAL_FILTROS)
  }, [])

  const refetch = useCallback(async () => {
    if (!supabase) {
      setError("Cliente de Supabase no configurado.")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .schema("telas")
      .from("incidencias")
      .select("*")
      .order("fecha_reporte", { ascending: false })

    if (fetchError) {
      console.log("[v0] IncidenciasReporte - fetch error:", fetchError)
      setError(fetchError.message)
      setIsLoading(false)
      return
    }

    setIncidencias((data ?? []) as IncidenciaReporte[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  /**
   * Llamado desde la tabla cuando un Planner confirma la resolucion.
   * Hace el UPDATE en BD y refresca la lista local *sin* refetch para
   * que la UI sienta inmediata.
   */
  const procesarIncidencia = useCallback(
    async (id: IncidenciaReporte["id"]) => {
      if (!supabase) return { ok: false, error: "Supabase no configurado" }
      const nowIso = new Date().toISOString()
      const { error: updateError } = await supabase
        .schema("telas")
        .from("incidencias")
        .update({
          estado_reposicion: "Procesado",
          fecha_procesado: nowIso,
        })
        .eq("id", id)

      if (updateError) {
        console.log("[v0] IncidenciasReporte - update error:", updateError)
        return { ok: false, error: updateError.message }
      }

      setIncidencias((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                estado_reposicion: "Procesado",
                fecha_procesado: nowIso,
              }
            : i
        )
      )
      return { ok: true }
    },
    []
  )

  // ---------- DERIVADOS ----------

  /** Lista de areas distintas que aparecen como `area_genera` en BD. */
  const areasGenera = useMemo(() => {
    const set = new Set<string>()
    for (const i of incidencias) {
      if (i.area_genera) set.add(i.area_genera)
    }
    return Array.from(set).sort()
  }, [incidencias])

  /** Aplica todos los filtros UI en cliente. */
  const filteredIncidencias = useMemo(() => {
    const term = filtros.search.trim().toLowerCase()
    return incidencias.filter((inc) => {
      // Estado
      if (filtros.estado !== "todos") {
        const estado = (inc.estado_reposicion ?? "").toLowerCase()
        if (filtros.estado === "sin") {
          if (inc.genera_reposicion) return false
        } else if (filtros.estado === "pendiente") {
          if (!inc.genera_reposicion) return false
          if (estado !== "pendiente" && estado !== "") return false
        } else if (filtros.estado === "procesado") {
          if (estado !== "procesado") return false
        }
      }
      // Area responsable
      if (filtros.area !== "todas" && inc.area_genera !== filtros.area) {
        return false
      }
      // Rango de fechas
      const fechaISO = getFechaISO(inc)
      if (filtros.desde && (!fechaISO || fechaISO < filtros.desde)) return false
      if (filtros.hasta && (!fechaISO || fechaISO > filtros.hasta)) return false
      // Search libre
      if (term) {
        const haystack = [
          inc.pedido,
          inc.descripcion,
          inc.motivo_especifico,
          inc.area_genera,
          inc.area_reporta,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [incidencias, filtros])

  // ---------- KPIs ----------
  const kpis = useMemo<KpisData>(() => {
    const reportaCounter: Record<string, number> = {}
    const generaCounter: Record<string, number> = {}
    let totalMes = 0
    let totalHoy = 0
    let sumHoras = 0
    let resueltasCount = 0

    const now = new Date()
    const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const todayISO = `${yyyyMM}-${String(now.getDate()).padStart(2, "0")}`

    for (const inc of filteredIncidencias) {
      if (inc.area_reporta) {
        reportaCounter[inc.area_reporta] =
          (reportaCounter[inc.area_reporta] || 0) + 1
      }
      if (inc.area_genera) {
        generaCounter[inc.area_genera] =
          (generaCounter[inc.area_genera] || 0) + 1
      }
      const fechaISO = getFechaISO(inc)
      if (fechaISO?.startsWith(yyyyMM)) totalMes++
      if (fechaISO === todayISO) totalHoy++

      if (inc.fecha_reporte && inc.fecha_procesado) {
        const start = new Date(inc.fecha_reporte).getTime()
        const end = new Date(inc.fecha_procesado).getTime()
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          sumHoras += (end - start) / (1000 * 60 * 60)
          resueltasCount++
        }
      }
    }

    const pickTop = (
      counter: Record<string, number>
    ): { area: string; count: number } | null => {
      let best: { area: string; count: number } | null = null
      for (const [area, count] of Object.entries(counter)) {
        if (!best || count > best.count) best = { area, count }
      }
      return best
    }

    return {
      topReporta: pickTop(reportaCounter),
      topGenera: pickTop(generaCounter),
      totalMes,
      totalHoy,
      tiempoRespuestaHoras: resueltasCount > 0 ? sumHoras / resueltasCount : null,
      resueltasCount,
    }
  }, [filteredIncidencias])

  // ---------- Series para charts ----------
  const porAreaGenera = useMemo(() => {
    const map: Record<string, { total: number; pendientes: number }> = {}
    for (const inc of filteredIncidencias) {
      const area = inc.area_genera || "Sin area"
      const slot = map[area] || { total: 0, pendientes: 0 }
      slot.total += 1
      if (
        inc.genera_reposicion &&
        (inc.estado_reposicion ?? "").toLowerCase() !== "procesado"
      ) {
        slot.pendientes += 1
      }
      map[area] = slot
    }
    return Object.entries(map)
      .map(([area, v]) => ({ area, total: v.total, pendientes: v.pendientes }))
      .sort((a, b) => b.total - a.total)
  }, [filteredIncidencias])

  const porFechaSerie = useMemo(() => {
    // Si el filtro abarca > 60 dias agrupamos por mes; si no, por dia.
    // Asi la linea no se ve abarrotada en rangos largos.
    const byDay: Record<string, number> = {}
    let minISO: string | null = null
    let maxISO: string | null = null
    for (const inc of filteredIncidencias) {
      const f = getFechaISO(inc)
      if (!f) continue
      byDay[f] = (byDay[f] || 0) + 1
      if (!minISO || f < minISO) minISO = f
      if (!maxISO || f > maxISO) maxISO = f
    }
    if (!minISO || !maxISO) return []

    const dayMs = 24 * 60 * 60 * 1000
    const span = (Date.parse(maxISO) - Date.parse(minISO)) / dayMs
    const groupByMonth = span > 60

    if (groupByMonth) {
      const byMonth: Record<string, number> = {}
      for (const [day, count] of Object.entries(byDay)) {
        const ym = day.slice(0, 7)
        byMonth[ym] = (byMonth[ym] || 0) + count
      }
      return Object.entries(byMonth)
        .map(([fecha, count]) => ({ fecha, count }))
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    }
    return Object.entries(byDay)
      .map(([fecha, count]) => ({ fecha, count }))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  }, [filteredIncidencias])

  /**
   * Distribucion por parte a reponer. Se splitea el CSV de
   * `partes_reposicion` y se cuenta cada parte como una unidad. Solo
   * filas con `genera_reposicion = true` contribuyen.
   */
  const porPartesReposicion = useMemo(() => {
    const map: Record<string, number> = {}
    for (const inc of filteredIncidencias) {
      if (!inc.genera_reposicion) continue
      const raw = (inc.partes_reposicion ?? "").trim()
      if (!raw) continue
      const partes = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
      for (const parte of partes) {
        map[parte] = (map[parte] || 0) + 1
      }
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredIncidencias])

  /**
   * Distribucion por estado de reposicion. Normaliza valores a un set
   * cerrado para que la leyenda del pie sea consistente entre cargas.
   */
  const porEstadoReposicion = useMemo(() => {
    const map: Record<string, number> = {
      Pendiente: 0,
      Procesado: 0,
    }
    for (const inc of filteredIncidencias) {
      if (!inc.genera_reposicion) continue
      const estado = (inc.estado_reposicion ?? "").trim().toLowerCase()
      if (estado === "procesado") {
        map["Procesado"] += 1
      } else if (estado === "" || estado === "pendiente") {
        map["Pendiente"] += 1
      } else {
        // Defensivo: agrupa cualquier estado inesperado bajo "Otro".
        map["Otro"] = (map["Otro"] || 0) + 1
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredIncidencias])

  return (
    <IncidenciasReporteContext.Provider
      value={{
        incidencias,
        filteredIncidencias,
        isLoading,
        error,
        refetch,
        procesarIncidencia,
        filtros,
        setFiltros,
        resetFiltros,
        areasGenera,
        kpis,
        porAreaGenera,
        porFechaSerie,
        porPartesReposicion,
        porEstadoReposicion,
      }}
    >
      {children}
    </IncidenciasReporteContext.Provider>
  )
}

export function useIncidenciasReporte() {
  const ctx = useContext(IncidenciasReporteContext)
  if (!ctx) {
    throw new Error(
      "useIncidenciasReporte must be used within IncidenciasReporteProvider"
    )
  }
  return ctx
}
