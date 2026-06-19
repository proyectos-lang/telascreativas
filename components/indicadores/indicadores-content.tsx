"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  Palette,
  Gauge,
  Timer,
  ShieldAlert,
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  X,
} from "lucide-react"
import {
  type IndicadoresFiltro,
  type KpiAdherenciaRow,
  type KpiDisenoRow,
  type KpiLeadTimeRow,
  type KpiReprocesoRow,
  MESES,
  MES_TODOS,
  num,
  periodoLabel,
  supabase,
} from "./shared"
import { TabDiseno } from "./tab-diseno"
import { TabAdherencia } from "./tab-adherencia"
import { TabLeadTimes } from "./tab-lead-times"
import { TabReprocesos } from "./tab-reprocesos"

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_YEAR = 2026
const YEAR_OPTIONS = Array.from(
  new Set([2025, 2026, CURRENT_YEAR, CURRENT_YEAR + 1])
).sort((a, b) => a - b)

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)

type TabKey = "diseno" | "adherencia" | "leadtimes" | "reprocesos"

export function IndicadoresContent() {
  const [filtro, setFiltro] = useState<IndicadoresFiltro>({
    ano: DEFAULT_YEAR,
    mes: MES_TODOS,
    semanas: [],
  })
  const [tab, setTab] = useState<TabKey>("diseno")
  const [semanaOpen, setSemanaOpen] = useState(false)

  const [diseno, setDiseno] = useState<KpiDisenoRow[]>([])
  const [adherencia, setAdherencia] = useState<KpiAdherenciaRow[]>([])
  const [leadTimes, setLeadTimes] = useState<KpiLeadTimeRow[]>([])
  const [reprocesos, setReprocesos] = useState<KpiReprocesoRow[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function toggleSemana(s: number) {
    setFiltro((f) => {
      const semanas = f.semanas.includes(s)
        ? f.semanas.filter((x) => x !== s)
        : [...f.semanas, s].sort((a, b) => a - b)
      return { ...f, semanas }
    })
  }

  const semanaLabel = useMemo(() => {
    if (filtro.semanas.length === 0) return "Todas las semanas"
    if (filtro.semanas.length === 1) return `Semana ${filtro.semanas[0]}`
    if (filtro.semanas.length <= 4)
      return filtro.semanas.map((s) => `S${s}`).join(", ")
    return `${filtro.semanas.length} semanas`
  }, [filtro.semanas])

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      setIsLoading(true)
      setError(null)

      const applyFiltro = (q: any) => {
        let query = q.eq("ano", filtro.ano)
        if (filtro.mes !== MES_TODOS) query = query.eq("mes", filtro.mes)
        if (filtro.semanas.length === 1)
          query = query.eq("semana", filtro.semanas[0])
        else if (filtro.semanas.length > 1)
          query = query.in("semana", filtro.semanas)
        return query
      }

      try {
        const [d, a, l, r] = await Promise.all([
          applyFiltro(
            supabase.schema("telas").from("vista_kpi_diseno").select("*")
          ),
          applyFiltro(
            supabase.schema("telas").from("vista_kpi_adherencia").select("*")
          ),
          applyFiltro(
            supabase.schema("telas").from("vista_kpi_lead_times").select("*")
          ),
          applyFiltro(
            supabase.schema("telas").from("vista_kpi_reprocesos").select("*")
          ),
        ])

        if (cancelled) return

        const firstErr = d.error || a.error || l.error || r.error
        if (firstErr) {
          console.log("[v0] Indicadores - error supabase:", firstErr)
          setError(firstErr.message)
        }

        setDiseno((d.data as KpiDisenoRow[]) || [])
        setAdherencia((a.data as KpiAdherenciaRow[]) || [])
        setLeadTimes((l.data as KpiLeadTimeRow[]) || [])
        setReprocesos((r.data as KpiReprocesoRow[]) || [])
      } catch (err) {
        if (cancelled) return
        console.log("[v0] Indicadores - unexpected error:", err)
        setError(err instanceof Error ? err.message : "Error inesperado")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchAll()
    return () => {
      cancelled = true
    }
  }, [filtro])

  function handleExport() {
    let headers: string[] = []
    let data: (string | number)[][] = []
    let sheet = "Indicadores"

    if (tab === "diseno") {
      sheet = "Rendimiento Diseno"
      headers = [
        "Periodo",
        "Disenador",
        "Disenos Entregados",
        "% Alcance Meta",
        "Bono Ganado",
        "Incidencias",
        "% Cumplimiento OTD",
      ]
      data = diseno.map((r) => [
        periodoLabel(filtro, r),
        r.disenador ?? "",
        num(r.diseños_entregados),
        num(r.porcentaje_alcance),
        num(r.bono_ganado),
        num(r.total_incidencias),
        num(r.porcentaje_cumplimiento),
      ])
    } else if (tab === "adherencia") {
      sheet = "Matriz Adherencia"
      headers = [
        "Periodo",
        "Ordenes",
        "Diseno",
        "Impresion",
        "Sublimacion",
        "Corte",
        "Costura",
        "Empaque",
        "Cumplidos Global",
        "Adherencia Global",
      ]
      data = adherencia.map((r) => [
        periodoLabel(filtro, r),
        num(r.total_ordenes),
        num(r.adherencia_diseno),
        num(r.adherencia_impresion),
        num(r.adherencia_sublimacion),
        num(r.adherencia_corte),
        num(r.adherencia_costura),
        num(r.adherencia_empaque),
        num(r.cumplidos_global),
        num(r.adherencia_global),
      ])
    } else if (tab === "leadtimes") {
      sheet = "Lead Times"
      headers = [
        "Periodo",
        "Lead Time Global",
        "Dias Diseno",
        "Dias Impresion",
        "Dias Sublimacion",
        "Dias Corte",
        "Dias Costura",
        "Dias Empaque",
        "Cola Diseno-Impresion",
        "Cola Impresion-Sublimacion",
        "Cola Sublimacion-Corte",
        "Cola Corte-Costura",
        "Cola Costura-Empaque",
      ]
      data = leadTimes.map((r) => [
        periodoLabel(filtro, r),
        num(r.lead_time_global_promedio),
        num(r.dias_en_diseno),
        num(r.dias_en_impresion),
        num(r.dias_en_sublimacion),
        num(r.dias_en_corte),
        num(r.dias_en_costura),
        num(r.dias_en_empaque),
        num(r.cola_diseno_a_impresion),
        num(r.cola_impresion_a_sublimacion),
        num(r.cola_sublimacion_a_corte),
        num(r.cola_corte_a_costura),
        num(r.cola_costura_a_empaque),
      ])
    } else {
      sheet = "Reprocesos"
      headers = [
        "Periodo",
        "Area Responsable",
        "Piezas Entregadas",
        "Incidencias",
        "% Calidad",
        "Top Parte Afectada",
        "Top Talla",
        "Top Genero",
        "Top Motivo Critico",
      ]
      data = reprocesos.map((r) => [
        periodoLabel(filtro, r),
        r.area_responsable ?? "",
        num(r.total_piezas_entregadas),
        num(r.cantidad_incidencias_reportadas),
        num(r.porcentaje_calidad_cumplimiento),
        r.top_parte_afectada ?? "",
        r.top_talla_error ?? "",
        r.top_genero_error ?? "",
        r.top_motivo_critico ?? "",
      ])
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheet)
    const mesTxt =
      filtro.mes === MES_TODOS ? "anual" : MESES[filtro.mes - 1].toLowerCase()
    const semTxt =
      filtro.semanas.length === 0
        ? ""
        : filtro.semanas.length === 1
          ? `-S${filtro.semanas[0]}`
          : `-S${filtro.semanas[0]}-S${filtro.semanas[filtro.semanas.length - 1]}`
    XLSX.writeFile(
      wb,
      `indicadores-${sheet.toLowerCase().replace(/\s+/g, "-")}-${filtro.ano}-${mesTxt}${semTxt}.xlsx`
    )
  }

  const hasAnyData =
    diseno.length + adherencia.length + leadTimes.length + reprocesos.length > 0

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Dashboard de Indicadores
          </h2>
          <p className="text-xs text-muted-foreground">
            KPIs operativos de diseno, adherencia, lead times y reprocesos
          </p>
        </div>
      </div>

      {/* Barra de filtros globales + exportar */}
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-end">
        {/* Año */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Año</label>
          <Select
            value={String(filtro.ano)}
            onValueChange={(v) =>
              setFiltro((f) => ({ ...f, ano: Number(v) }))
            }
          >
            <SelectTrigger className="w-full md:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Mes</label>
          <Select
            value={String(filtro.mes)}
            onValueChange={(v) =>
              setFiltro((f) => ({ ...f, mes: Number(v) }))
            }
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(MES_TODOS)}>
                Ver todo el año
              </SelectItem>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Semanas — multi-select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            Semana
            {filtro.semanas.length > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {filtro.semanas.length}
              </span>
            )}
          </label>
          <div className="flex items-center gap-1.5">
            <Popover open={semanaOpen} onOpenChange={setSemanaOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-between gap-2 font-normal md:w-52"
                >
                  <span className="truncate text-sm">{semanaLabel}</span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-2"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {/* "Todas" */}
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
                  onClick={() => setFiltro((f) => ({ ...f, semanas: [] }))}
                >
                  <Checkbox
                    checked={filtro.semanas.length === 0}
                    className="pointer-events-none"
                  />
                  <span className="font-medium">Todas las semanas</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-56 overflow-y-auto">
                  {SEMANAS.map((s) => (
                    <button
                      key={s}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100"
                      onClick={() => toggleSemana(s)}
                    >
                      <Checkbox
                        checked={filtro.semanas.includes(s)}
                        className="pointer-events-none"
                      />
                      Semana {s}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Botón limpiar selección */}
            {filtro.semanas.length > 0 && (
              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Limpiar semanas"
                onClick={() => setFiltro((f) => ({ ...f, semanas: [] }))}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-end justify-end">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || !hasAnyData}
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <FileSpreadsheet className="size-4" />
            Exportar a Excel
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>Error al cargar indicadores: {error}</span>
        </Card>
      )}

      {/* Pestañas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="diseno" className="gap-2">
            <Palette className="size-4" />
            Rendimiento Diseno
          </TabsTrigger>
          <TabsTrigger value="adherencia" className="gap-2">
            <Gauge className="size-4" />
            Adherencia
          </TabsTrigger>
          <TabsTrigger value="leadtimes" className="gap-2">
            <Timer className="size-4" />
            Lead Times
          </TabsTrigger>
          <TabsTrigger value="reprocesos" className="gap-2">
            <ShieldAlert className="size-4" />
            Reprocesos
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <TabsContent value="diseno" className="mt-4">
              <TabDiseno rows={diseno} filtro={filtro} />
            </TabsContent>
            <TabsContent value="adherencia" className="mt-4">
              <TabAdherencia rows={adherencia} filtro={filtro} />
            </TabsContent>
            <TabsContent value="leadtimes" className="mt-4">
              <TabLeadTimes rows={leadTimes} />
            </TabsContent>
            <TabsContent value="reprocesos" className="mt-4">
              <TabReprocesos rows={reprocesos} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
