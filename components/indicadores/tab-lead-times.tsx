"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Timer, Hourglass, Activity, ArrowDown, ChevronDown, X } from "lucide-react"
import { KpiCard } from "./kpi-card"
import {
  type KpiLeadTimeRow,
  PALETA,
  fmtDec,
  fmtDias,
  num,
} from "./shared"
import { LeadTimesHistorico } from "./lead-times-historico"

interface Props {
  rows: KpiLeadTimeRow[]
}

function avgNoNeg(values: (number | null | undefined)[]): number {
  const nums = values.map(num).filter((n) => n >= 0)
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

const ETAPAS = [
  { label: "Diseno", activo: "dias_en_diseno", cola: "cola_diseno_a_impresion" },
  {
    label: "Impresion",
    activo: "dias_en_impresion",
    cola: "cola_impresion_a_sublimacion",
  },
  {
    label: "Sublimacion",
    activo: "dias_en_sublimacion",
    cola: "cola_sublimacion_a_corte",
  },
  { label: "Corte", activo: "dias_en_corte", cola: "cola_corte_a_costura" },
  {
    label: "Costura",
    activo: "dias_en_costura",
    cola: "cola_costura_a_empaque",
  },
  { label: "Empaque", activo: "dias_en_empaque", cola: null },
] as const

const TODOS_PROCESOS = ETAPAS.map((e) => e.label)

export function TabLeadTimes({ rows }: Props) {
  const [procesosActivos, setProcesosActivos] = useState<string[]>([])
  const [procesoOpen, setProcesoOpen] = useState(false)

  function toggleProceso(p: string) {
    setProcesosActivos((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const procesoLabel = useMemo(() => {
    if (procesosActivos.length === 0) return "Todos los procesos"
    if (procesosActivos.length === 1) return procesosActivos[0]
    return `${procesosActivos.length} procesos`
  }, [procesosActivos])

  const leadGlobal = useMemo(
    () => avgNoNeg(rows.map((r) => r.lead_time_global_promedio)),
    [rows]
  )

  const dataGrafico = useMemo(
    () =>
      ETAPAS.map((e) => {
        const activo = avgNoNeg(
          rows.map((r) => r[e.activo as keyof KpiLeadTimeRow] as number)
        )
        const cola = e.cola
          ? avgNoNeg(
              rows.map((r) => r[e.cola as keyof KpiLeadTimeRow] as number)
            )
          : 0
        return {
          proceso: e.label,
          colaLabel: e.cola
            ? `${e.label} → ${ETAPAS[ETAPAS.findIndex((x) => x.label === e.label) + 1]?.label ?? ""}`
            : null,
          activo: Number(activo.toFixed(1)),
          cola: Number(cola.toFixed(1)),
        }
      }),
    [rows]
  )

  // Filtrar dataGrafico por procesos seleccionados
  const dataFiltrado = useMemo(
    () =>
      procesosActivos.length === 0
        ? dataGrafico
        : dataGrafico.filter((d) => procesosActivos.includes(d.proceso)),
    [dataGrafico, procesosActivos]
  )

  const sumaDescompuesta = useMemo(
    () => dataFiltrado.reduce((acc, d) => acc + d.activo + d.cola, 0),
    [dataFiltrado]
  )

  const totalActivo = useMemo(
    () => dataFiltrado.reduce((a, d) => a + d.activo, 0),
    [dataFiltrado]
  )
  const totalCola = useMemo(
    () => dataFiltrado.reduce((a, d) => a + d.cola, 0),
    [dataFiltrado]
  )

  // Flujo detallado filtrado: incluye estaciones seleccionadas y transiciones
  // entre estaciones AMBAS seleccionadas.
  const flujo = useMemo(() => {
    const setActivos = new Set(
      procesosActivos.length === 0 ? TODOS_PROCESOS : procesosActivos
    )
    const items: {
      tipo: "estacion" | "transicion"
      etiqueta: string
      dias: number
      acumulado: number
    }[] = []
    let acc = 0
    for (const d of dataGrafico) {
      if (!setActivos.has(d.proceso)) continue
      acc += d.activo
      items.push({
        tipo: "estacion",
        etiqueta: d.proceso,
        dias: d.activo,
        acumulado: acc,
      })
      // Mostrar la transición solo si la etapa destino también está seleccionada
      if (d.colaLabel && d.cola > 0) {
        const destLabel =
          ETAPAS[ETAPAS.findIndex((e) => e.label === d.proceso) + 1]?.label
        if (destLabel && setActivos.has(destLabel)) {
          acc += d.cola
          items.push({
            tipo: "transicion",
            etiqueta: d.colaLabel,
            dias: d.cola,
            acumulado: acc,
          })
        }
      }
    }
    return items
  }, [dataGrafico, procesosActivos])

  return (
    <div className="space-y-4">
      {/* Filtro por proceso */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            Proceso
            {procesosActivos.length > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {procesosActivos.length}
              </span>
            )}
          </label>
          <div className="flex items-center gap-1.5">
            <Popover open={procesoOpen} onOpenChange={setProcesoOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-56 justify-between gap-2 font-normal"
                >
                  <span className="truncate text-sm">{procesoLabel}</span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-56 p-2"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100"
                  onClick={() => setProcesosActivos([])}
                >
                  <Checkbox
                    checked={procesosActivos.length === 0}
                    className="pointer-events-none"
                  />
                  <span className="font-medium">Todos los procesos</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                {TODOS_PROCESOS.map((p) => (
                  <button
                    key={p}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100"
                    onClick={() => toggleProceso(p)}
                  >
                    <Checkbox
                      checked={procesosActivos.includes(p)}
                      className="pointer-events-none"
                    />
                    {p}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {procesosActivos.length > 0 && (
              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Limpiar filtro de procesos"
                onClick={() => setProcesosActivos([])}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chips de procesos seleccionados */}
        {procesosActivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {procesosActivos.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {p}
                <button
                  className="ml-0.5 text-slate-400 hover:text-slate-700"
                  onClick={() => toggleProceso(p)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Metricas clave */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Lead Time Global"
          value={fmtDias(leadGlobal)}
          hint="Desde ingreso de venta hasta entrega al cliente"
          icon={<Timer className="size-4" />}
          accentClass="bg-blue-100 text-blue-700"
        />
        <KpiCard
          label={procesosActivos.length > 0 ? "Tiempo activo (filtrado)" : "Tiempo activo total"}
          value={fmtDias(totalActivo)}
          hint="Suma de dias en proceso"
          icon={<Activity className="size-4" />}
          accentClass="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          label={procesosActivos.length > 0 ? "Tiempo en cola (filtrado)" : "Tiempo muerto en colas"}
          value={fmtDias(totalCola)}
          hint="Suma de esperas entre procesos"
          icon={<Hourglass className="size-4" />}
          accentClass="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Grafico de barras apiladas */}
      <Card className="p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Descomposicion del Lead Time
            {procesosActivos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — {procesosActivos.join(", ")}
              </span>
            )}
          </h3>
          <span className="text-xs text-muted-foreground">
            Suma descompuesta: {fmtDec(sumaDescompuesta)} d
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Tiempo activo en proceso + tiempo muerto en cola por estacion (se
          ignoran tiempos negativos)
        </p>
        {rows.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={dataFiltrado}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="proceso"
                tick={{ fontSize: 12, fill: "#64748b" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} unit=" d" />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${fmtDec(value)} d`,
                  name,
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="activo"
                stackId="lt"
                name="Tiempo activo"
                fill={PALETA.teal}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cola"
                stackId="lt"
                name="Tiempo en cola"
                fill={PALETA.amber}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Tabla de flujo detallado */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Linea de tiempo del Lead Time (estacion y transicion)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dias promedio en cada estacion y el tiempo de espera entre una
            estacion y la siguiente, con el lead time acumulado.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead>Etapa / Transicion</TableHead>
              <TableHead className="text-right">Tipo</TableHead>
              <TableHead className="text-right">Dias promedio</TableHead>
              <TableHead className="text-right">% del Lead Time</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 || flujo.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin datos para el periodo seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {flujo.map((f, i) => {
                  const esTransicion = f.tipo === "transicion"
                  const pct =
                    sumaDescompuesta > 0
                      ? (f.dias / sumaDescompuesta) * 100
                      : 0
                  return (
                    <TableRow
                      key={`${f.tipo}-${f.etiqueta}-${i}`}
                      className={
                        esTransicion
                          ? "bg-amber-50/40 hover:bg-amber-50/60"
                          : "hover:bg-slate-50/60"
                      }
                    >
                      <TableCell
                        className={
                          esTransicion
                            ? "pl-8 text-slate-600"
                            : "font-medium text-slate-800"
                        }
                      >
                        <span className="flex items-center gap-1.5">
                          {esTransicion && (
                            <ArrowDown className="size-3.5 text-amber-500" />
                          )}
                          {f.etiqueta}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            esTransicion
                              ? "bg-amber-100 text-amber-700"
                              : "bg-teal-100 text-teal-700"
                          }`}
                        >
                          {esTransicion ? "En cola" : "Activo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtDias(f.dias)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {fmtDec(pct)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-700">
                        {fmtDias(f.acumulado)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold">
                  <TableCell className="text-slate-800">
                    TOTAL Lead Time{procesosActivos.length > 0 ? " (parcial)" : ""}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">—</TableCell>
                  <TableCell className="text-right">
                    {fmtDias(sumaDescompuesta)}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">
                    100%
                  </TableCell>
                  <TableCell className="text-right text-slate-800">
                    {fmtDias(sumaDescompuesta)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
      {/* ── Análisis Histórico ── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Análisis Histórico de Tiempos por Área
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <LeadTimesHistorico />
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
      Sin datos para graficar en el periodo seleccionado.
    </div>
  )
}
