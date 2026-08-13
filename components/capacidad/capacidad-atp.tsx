"use client"

/**
 * Tab "Disponibilidad (ATP)" — heatmap área × día.
 *
 * ATP = capacidad_dia − carga_dia − reservas − colchón de urgentes.
 * La carga por día sale de las etapas PENDIENTES de las órdenes activas,
 * reservadas en la fecha objetivo de cada área (backlog vencido → hoy).
 * Semáforo: ≤85% verde · ≤100% ámbar · >100% rojo.
 */

import { useMemo } from "react"
import { Flame, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useCapacidadDatos } from "@/lib/capacidad/capacidad-data"
import {
  cargaPorAreaDia,
  reservasPorAreaDia,
  construirSeriesATP,
  cuelloDeBotella,
  backlogPorArea,
  type ContextoATP,
} from "@/lib/capacidad/motor"
import { fmtDiaSemana, parseYMD } from "@/lib/capacidad/fechas"
import { AyudaCapacidad, Termino } from "./capacidad-ayuda"

const DIAS_HEATMAP = 21

export function CapacidadATP() {
  const { datos, loading, error, refresh } = useCapacidadDatos()

  const { series, cuello, backlog } = useMemo(() => {
    if (!datos) return { series: [], cuello: null, backlog: null }
    const ctx: ContextoATP = {
      params: datos.params,
      carga: cargaPorAreaDia(datos.ordenes),
      reservas: reservasPorAreaDia(datos.reservas),
      excepciones: datos.excepciones,
    }
    const series = construirSeriesATP(ctx, DIAS_HEATMAP)
    return {
      series,
      cuello: cuelloDeBotella(series),
      backlog: backlogPorArea(datos.ordenes),
    }
  }, [datos])

  // Top días en sobrecarga global (suma de excesos de todas las áreas).
  const topSobrecarga = useMemo(() => {
    const porDia = new Map<string, number>()
    for (const s of series)
      for (const c of s.celdas)
        if (c.semaforo === "rojo")
          porDia.set(c.fecha, (porDia.get(c.fecha) ?? 0) + Math.max(0, c.carga + c.reservado - c.capacidad))
    return [...porDia.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [series])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error || !datos)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error ?? "Sin datos"}
      </div>
    )

  const fechas = series[0]?.celdas.map((c) => c.fecha) ?? []

  return (
    <div className="space-y-4">
      {datos.errorMotor && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {datos.errorMotor}
        </div>
      )}

      <AyudaCapacidad>
        <Termino nombre="Capacidad del día">
          el parámetro del área (pestaña Parámetros; se aplica el menor entre capacidad y límite
          físico) multiplicado por el factor de excepción del día (paros/feriados). Los domingos la
          capacidad es 0.
        </Termino>
        <Termino nombre="Carga">
          prendas de las etapas PENDIENTES de las órdenes activas, colocadas en la fecha objetivo
          que el Planner fijó para cada área.
        </Termino>
        <Termino nombre="¿Por qué HOY puede salir en rojo con más de 100%?">
          todo el trabajo cuya fecha objetivo ya venció (o que no tiene fecha) cae en el primer día
          hábil: el % de hoy es la <strong>deuda acumulada</strong> del área, no lo programado del
          día. Ejemplo: 300% en Corte = necesita ~3 días completos solo para ponerse al día.
        </Termino>
        <Termino nombre="Colchón de urgentes">
          porcentaje de la capacidad (15% por defecto) que se aparta cada día y solo lo consumen los
          pedidos urgentes.
        </Termino>
        <Termino nombre="ATP (Available To Promise)">
          capacidad − carga − reservas − colchón = las prendas que ese día aún se pueden comprometer
          sin desplazar a nadie.
        </Termino>
        <Termino nombre="Semáforo">
          verde = hasta 85% ocupado (hay espacio) · ámbar = 85–100% (al límite) · rojo = más de 100%
          (sobrecargado: hay más trabajo que capacidad).
        </Termino>
        <Termino nombre="Área restrictiva (cuello de botella)">
          el área con mayor utilización promedio en la ventana: es la que define cuándo puede
          entregar la planta.
        </Termino>
      </AyudaCapacidad>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Utilización por área — próximos {DIAS_HEATMAP} días hábiles
          </h2>
          <p className="text-xs text-slate-500">
            Carga comprometida (etapas pendientes en su fecha objetivo) vs capacidad diaria.
            El backlog vencido cae en el primer día hábil.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="mr-1.5 size-4" />
          Actualizar
        </Button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid gap-3 sm:grid-cols-2">
        {cuello && (
          <Card className="border-rose-200 bg-rose-50/50 p-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-rose-600" />
              <p className="text-xs font-semibold uppercase text-rose-700">Área restrictiva</p>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-800">{cuello.label}</p>
            <p className="text-xs text-slate-500">
              Utilización promedio{" "}
              {cuello.utilPromedio != null ? `${Math.round(cuello.utilPromedio * 100)}%` : "—"} ·{" "}
              {cuello.diasRojo} día{cuello.diasRojo !== 1 ? "s" : ""} en rojo en la ventana
            </p>
          </Card>
        )}
        <Card className="p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Top días en sobrecarga</p>
          {topSobrecarga.length === 0 ? (
            <p className="mt-1 text-sm text-emerald-600">Sin días en rojo en la ventana ✔</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              {topSobrecarga.map(([fecha, exceso]) => (
                <li key={fecha}>
                  <span className="font-medium">{fmtDiaSemana(parseYMD(fecha)!)}</span>{" "}
                  <span className="text-rose-600">
                    +{Math.round(exceso).toLocaleString()} pcs sobre capacidad
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Aviso de backlog en el primer día */}
      {backlog && backlog.total > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>
              <strong>
                La sobrecarga del primer día ({fechas[0] ? fmtDiaSemana(parseYMD(fechas[0])!) : "hoy"})
                es backlog, no carga de ese día.
              </strong>{" "}
              Hay <strong>{Math.round(backlog.total).toLocaleString()} prendas</strong> en{" "}
              {backlog.totalOrdenes.toLocaleString()} orden
              {backlog.totalOrdenes !== 1 ? "es" : ""} cuya etapa ya venció o nunca tuvo fecha
              objetivo. El motor las coloca en el primer día hábil para que la deuda quede visible;
              los días siguientes sí muestran solo lo programado para esa fecha.
            </p>
            <p className="text-xs">
              Backlog por área:{" "}
              {backlog.porArea.map((b, i) => {
                const p = datos.params.find((x) => x.area === b.area)
                const cap = p?.capacidad_efectiva ?? 0
                const dias = cap > 0 ? b.pcs / cap : null
                return (
                  <span key={b.area}>
                    {i > 0 && " · "}
                    <strong>{b.label}</strong> {Math.round(b.pcs).toLocaleString()} pcs
                    {dias != null && ` (~${dias.toFixed(1)} días para ponerse al día)`}
                  </span>
                )
              })}
            </p>
            {backlog.porArea.some((b) => b.pcsSinFecha > 0) && (
              <p className="text-xs text-amber-700">
                Incluye{" "}
                <strong>
                  {Math.round(
                    backlog.porArea.reduce((s, b) => s + b.pcsSinFecha, 0)
                  ).toLocaleString()}{" "}
                  prendas sin fecha objetivo
                </strong>{" "}
                (órdenes que aún no pasaron por Programación): al aprobarlas y darles fecha se
                repartirán en el calendario y esta sobrecarga bajará.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b bg-white px-2 py-1.5 text-left font-semibold text-slate-600">
                  Área
                </th>
                {fechas.map((f, i) => {
                  const d = parseYMD(f)!
                  const esPrimero = i === 0 && !!backlog && backlog.total > 0
                  return (
                    <th
                      key={f}
                      className={cn(
                        "whitespace-nowrap border-b px-1 py-1.5 text-center font-medium text-slate-500",
                        esPrimero && "bg-amber-50 text-amber-800"
                      )}
                      title={
                        esPrimero
                          ? "Incluye el backlog: etapas vencidas o sin fecha objetivo"
                          : undefined
                      }
                    >
                      {fmtDiaSemana(d)}
                      {esPrimero && (
                        <span className="block text-[9px] font-normal">+ backlog</span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.area}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b bg-white px-2 py-1 font-medium text-slate-700">
                    {s.label}
                  </td>
                  {s.celdas.map((c) => {
                    const pct = c.utilizacion != null ? Math.round(c.utilizacion * 100) : null
                    const bg =
                      c.semaforo === "rojo"
                        ? "bg-rose-500 text-white"
                        : c.semaforo === "ambar"
                        ? "bg-amber-400 text-amber-950"
                        : c.semaforo === "verde"
                        ? pct != null && pct > 0
                          ? "bg-emerald-400/80 text-emerald-950"
                          : "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    return (
                      <td key={c.fecha} className="border-b p-0.5">
                        <div
                          className={cn(
                            "flex h-8 min-w-[44px] items-center justify-center rounded font-semibold tabular-nums",
                            bg
                          )}
                          title={`${s.label} — ${fmtDiaSemana(parseYMD(c.fecha)!)}
Capacidad: ${Math.round(c.capacidad).toLocaleString()}
Carga: ${Math.round(c.carga).toLocaleString()}${c.reservado > 0 ? `\nReservado: ${Math.round(c.reservado).toLocaleString()}` : ""}
Colchón urgentes: ${Math.round(c.colchon).toLocaleString()}
ATP: ${Math.round(c.atp).toLocaleString()}`}
                        >
                          {pct != null ? `${pct}%` : "—"}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded bg-emerald-400/80" /> ≤85% disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded bg-amber-400" /> 85–100% al límite
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded bg-rose-500" /> &gt;100% sobrecargada
        </span>
        <span>Pasa el mouse sobre una celda para ver capacidad / carga / ATP.</span>
      </div>
    </div>
  )
}
