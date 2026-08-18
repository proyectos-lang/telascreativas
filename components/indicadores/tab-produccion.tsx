"use client"

/**
 * Indicadores de Producción: unidades entregadas por área, día a día.
 *
 * Para cada área se cuenta cuántas prendas TERMINÓ cada día del mes (fecha de
 * fin del área en `telas.cabecera`, sumando `cabecera.pcs`) y se compara contra
 * la meta diaria, que sale del parámetro "Capacidad (pcs/día)" del módulo
 * Capacidad (`telas.capacidad_areas`). El % de cumplimiento por día es
 * unidades / meta.
 *
 * MISMA DEFINICIÓN QUE CAPACIDAD. El "real por día" de cada área es el
 * **P85 de prendas/día sobre los días CON ACTIVIDAD, excluyendo domingos**,
 * calculado con un percentil continuo equivalente al `percentile_cont` de
 * Postgres. Es exactamente lo que hace `telas.fn_capacidad_calibrar`, de donde
 * sale la meta: así el número de esta pestaña y el de Capacidad → Capacidad
 * real son directamente comparables (mismo periodo ⇒ mismo valor).
 *
 * Consecuencias del criterio, a propósito:
 *  - Los días sin producción NO diluyen el indicador (no entran al percentil).
 *  - Se excluye solo el domingo, aunque Corte/Impresión/Sublimación trabajen
 *    Lun–Vie: si hubo actividad un sábado, cuenta, igual que en la calibración.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Factory, AlertCircle, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchAll } from "@/lib/fetch-all"
import { MES_TODOS, MESES, type IndicadoresFiltro } from "./shared"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Áreas con su fecha de fin en cabecera y su clave en telas.capacidad_areas.
 * El mapeo debe coincidir con el de fn_capacidad_calibrar para que el P85 de
 * esta pestaña sea el mismo que el de Capacidad.
 */
const AREAS = [
  { key: "diseno", label: "Diseño", fin: "dentrega_diseno", capacidad: "Diseno" },
  { key: "impresion", label: "Impresión", fin: "ientrega_impresion", capacidad: "Impresion" },
  { key: "corte", label: "Corte", fin: "cfecha_de_corte", capacidad: "Corte" },
  { key: "sublimacion", label: "Sublimación", fin: "seta_sublimacion", capacidad: "Sublimacion" },
  { key: "costura", label: "Costura", fin: "coseta_costura", capacidad: "Costura" },
  { key: "empaque", label: "Empaque", fin: "efecha_de_empaque", capacidad: "Empaque" },
] as const

type AreaDef = (typeof AREAS)[number]

interface FilaProd {
  pcs: number | string | null
  estado_aprobado_rechazado: string | null
  dentrega_diseno: string | null
  ientrega_impresion: string | null
  cfecha_de_corte: string | null
  seta_sublimacion: string | null
  coseta_costura: string | null
  efecha_de_empaque: string | null
}

interface CapRow {
  area: string
  capacidad_efectiva: number | null
  activo: boolean
}

const CAMPOS =
  "pcs, estado_aprobado_rechazado, dentrega_diseno, ientrega_impresion, cfecha_de_corte, seta_sublimacion, coseta_costura, efecha_de_empaque"

const toPcs = (v: number | string | null): number => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Días del mes (o del año si mes = MES_TODOS agrupa por mes, ver abajo). */
function diasDelMes(ano: number, mes: number): string[] {
  const out: string[] = []
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  for (let d = 1; d <= ultimo; d++) {
    out.push(`${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }
  return out
}

/**
 * Día contable: se excluye SOLO el domingo, exactamente igual que la
 * calibración de Capacidad (`telas.fn_capacidad_calibrar` filtra
 * `extract(dow) <> 0`). Mantener el mismo filtro es lo que permite que el P85
 * de esta pestaña coincida con el de Capacidad → Capacidad real.
 */
function esDiaContable(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0
}

/**
 * Percentil continuo, equivalente a `percentile_cont` de Postgres (el que usa
 * fn_capacidad_calibrar), para que el P85 salga idéntico.
 */
function percentilCont(valores: number[], p: number): number | null {
  if (!valores.length) return null
  const s = [...valores].sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return s[lo]
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

const pct = (v: number | null): string => (v == null ? "—" : `${Math.round(v)}%`)

export function TabProduccion({ filtro }: { filtro: IndicadoresFiltro }) {
  const [rows, setRows] = useState<FilaProd[]>([])
  const [caps, setCaps] = useState<CapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [prod, cap] = await Promise.all([
      fetchAll<FilaProd>((from, to) =>
        supabase.schema("telas").from("cabecera").select(CAMPOS).range(from, to) as never
      ),
      supabase.schema("telas").from("capacidad_areas").select("area, capacidad_efectiva, activo"),
    ])
    if (prod.error) {
      setError(prod.error.message)
      setRows([])
    } else {
      // Canceladas y rechazadas no cuentan como produccion entregada.
      setRows(
        (prod.data ?? []).filter((r) => {
          const e = (r.estado_aprobado_rechazado ?? "").trim().toLowerCase()
          return e !== "cancelado" && e !== "rechazado"
        })
      )
    }
    setCaps((cap.data ?? []) as CapRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const metaDe = useCallback(
    (area: AreaDef): number | null => {
      const c = caps.find((x) => x.area === area.capacidad)
      const v = c?.capacidad_efectiva
      return v != null && v > 0 ? Number(v) : null
    },
    [caps]
  )

  // Mes efectivo: si el filtro está en "todo el año", usamos el mes actual
  // porque este indicador es de control diario.
  const mesEfectivo = filtro.mes === MES_TODOS ? new Date().getMonth() + 1 : filtro.mes

  /**
   * Días del mes hasta HOY. Los días futuros se excluyen: mostrarlos como 0
   * unidades hundía el promedio y hacía ver la línea cayendo a cero al final
   * del mes. En meses ya cerrados se muestra el mes completo.
   */
  const diasVisibles = useMemo(() => {
    const todos = diasDelMes(filtro.ano, mesEfectivo)
    const hoy = new Date()
    const hoyYMD = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    return todos.filter((d) => d <= hoyYMD)
  }, [filtro.ano, mesEfectivo])

  /** Serie diaria por área: unidades entregadas y % de cumplimiento. */
  const series = useMemo(() => {
    const dias = diasVisibles
    return AREAS.map((area) => {
      const meta = metaDe(area)
      // Unidades terminadas por dia.
      const porDia = new Map<string, number>()
      for (const r of rows) {
        const raw = r[area.fin as keyof FilaProd] as string | null
        if (!raw) continue
        const ymd = String(raw).slice(0, 10)
        if (!ymd.startsWith(`${filtro.ano}-${String(mesEfectivo).padStart(2, "0")}`)) continue
        porDia.set(ymd, (porDia.get(ymd) ?? 0) + toPcs(r.pcs))
      }
      const data = dias.filter(esDiaContable).map((d) => {
        const unidades = porDia.get(d) ?? 0
        return {
          dia: d.slice(8),
          fecha: d,
          unidades,
          meta: meta ?? 0,
          cumplimiento: meta ? (unidades / meta) * 100 : null,
        }
      })
      const totalUnidades = data.reduce((a, x) => a + x.unidades, 0)
      const diasCumplidos = data.filter((x) => (x.cumplimiento ?? 0) >= 100).length

      // MISMA definición que la calibración de Capacidad: P85 de prendas/día
      // sobre los días CON ACTIVIDAD (los días en cero no cuentan), excluyendo
      // domingos. Así el "real por día" de aquí es directamente comparable con
      // el P85 de Capacidad → Capacidad real, que es de donde sale la meta.
      const activos = data.filter((x) => x.unidades > 0).map((x) => x.unidades)
      const realPorDia = percentilCont(activos, 0.85)
      const promedioActivos = activos.length
        ? activos.reduce((a, b) => a + b, 0) / activos.length
        : null
      const cumplPromedio =
        meta && realPorDia != null ? (realPorDia / meta) * 100 : null
      return {
        area,
        meta,
        data,
        totalUnidades,
        realPorDia,
        promedioActivos,
        cumplPromedio,
        diasCumplidos,
        diasActivos: activos.length,
        diasContables: data.length,
      }
    })
  }, [rows, diasVisibles, metaDe])

  const sinCapacidad = series.every((s) => s.meta == null)

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Factory className="size-5 text-icon-green" />
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Unidades entregadas por área — {MESES[mesEfectivo - 1]} {filtro.ano}
            </h2>
            <p className="text-xs text-slate-500">
              Prendas terminadas cada día vs. la meta diaria del módulo Capacidad.
              El real por día es el <strong>P85 sobre días con actividad</strong>,
              la misma definición que usa Capacidad. Solo hasta hoy.
              {filtro.mes === MES_TODOS && " (el filtro está en todo el año: se muestra el mes actual)"}
            </p>
          </div>
        </div>
      </div>

      {sinCapacidad && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            No hay metas configuradas. Ejecuta{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              scripts/capacidad-motor.sql
            </code>{" "}
            y define la <strong>Capacidad (pcs/día)</strong> por área en el módulo
            Capacidad → Parámetros.
          </span>
        </div>
      )}

      {/* Resumen por área */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => (
          <Card key={s.area.key} className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{s.area.label}</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  s.cumplPromedio == null
                    ? "text-slate-400"
                    : s.cumplPromedio >= 100
                    ? "border-emerald-300 text-emerald-700"
                    : s.cumplPromedio >= 85
                    ? "border-amber-300 text-amber-700"
                    : "border-rose-300 text-rose-700"
                )}
              >
                {pct(s.cumplPromedio)} cumplimiento
              </Badge>
            </div>
            {/* Real por día vs meta diaria: el dato de control. */}
            <p className="mt-0.5 flex items-baseline gap-1 leading-tight">
              <span
                className={cn(
                  "text-xl font-bold",
                  s.cumplPromedio == null
                    ? "text-slate-800"
                    : s.cumplPromedio >= 100
                    ? "text-emerald-600"
                    : s.cumplPromedio >= 85
                    ? "text-amber-600"
                    : "text-rose-600"
                )}
              >
                {s.realPorDia == null ? "—" : Math.round(s.realPorDia).toLocaleString()}
              </span>
              <span className="text-sm font-medium text-slate-400">
                / {s.meta ? s.meta.toLocaleString() : "—"}
              </span>
              <span className="text-[11px] text-slate-400">pcs/día (P85)</span>
            </p>
            <p className="text-[11px] text-slate-500">
              {s.totalUnidades.toLocaleString()} prendas · {s.diasActivos} día
              {s.diasActivos !== 1 ? "s" : ""} con actividad ·{" "}
              {s.diasCumplidos} sobre la meta
            </p>
          </Card>
        ))}
      </div>

      {/* Un gráfico de líneas por área */}
      <div className="grid gap-3 lg:grid-cols-2">
        {series.map((s) => (
          <Card key={s.area.key} className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <TrendingUp className="size-4 text-icon-green" />
                {s.area.label}
              </p>
              <span className="text-[11px] text-slate-400">
                P85 {s.realPorDia == null ? "—" : Math.round(s.realPorDia)} · prom{" "}
                {s.promedioActivos == null ? "—" : Math.round(s.promedioActivos)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={s.data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, name: string) =>
                    name === "unidades"
                      ? [`${v.toLocaleString()} prendas`, "Entregado"]
                      : [`${v.toLocaleString()}`, "Meta"]
                  }
                  labelFormatter={(l) => `Día ${l}`}
                />
                {s.meta != null && (
                  <ReferenceLine
                    y={s.meta}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `Meta ${s.meta}`,
                      position: "insideTopRight",
                      fill: "#ef4444",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="unidades"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        ))}
      </div>

      {/* Detalle diario: % de cumplimiento por área */}
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-800">
          Cumplimiento diario (%)
        </p>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Día</TableHead>
                {AREAS.map((a) => (
                  <TableHead key={a.key} className="text-center whitespace-nowrap">
                    {a.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {diasVisibles.map((d) => {
                const dow = new Date(d + "T00:00:00Z").getUTCDay()
                if (dow === 0) return null
                return (
                  <TableRow key={d}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {d.slice(8)}{" "}
                      <span className="text-[10px] text-slate-400">
                        {["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dow]}
                      </span>
                    </TableCell>
                    {series.map((s) => {
                      const punto = s.data.find((x) => x.fecha === d)
                      if (!punto)
                        return (
                          <TableCell key={s.area.key} className="text-center text-slate-300">
                            —
                          </TableCell>
                        )
                      const c = punto.cumplimiento
                      return (
                        <TableCell
                          key={s.area.key}
                          className={cn(
                            "text-center tabular-nums",
                            c == null
                              ? "text-slate-400"
                              : c >= 100
                              ? "font-semibold text-emerald-600"
                              : c >= 85
                              ? "text-amber-600"
                              : c > 0
                              ? "text-rose-600"
                              : "text-slate-300"
                          )}
                          title={`${punto.unidades} prendas${s.meta ? ` de ${s.meta}` : ""}`}
                        >
                          {pct(c)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          % = prendas terminadas ese día ÷ meta diaria del área (parámetro
          <strong> Capacidad (pcs/día)</strong> del módulo Capacidad). Se omiten
          únicamente los domingos, igual que la calibración de Capacidad. Pasa el
          mouse sobre una celda para ver las unidades.
        </p>
      </div>
    </div>
  )
}
