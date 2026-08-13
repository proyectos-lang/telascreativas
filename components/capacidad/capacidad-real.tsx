"use client"

/**
 * Tab "Capacidad real" — calibración desde el histórico consolidado.
 *
 * Muestra EN PARALELO el parámetro vigente de cada área (capacidad objetivo)
 * y la capacidad REAL de la planta calculada del histórico de cabecera
 * (P50/P85/P95 de pcs/día sobre días con actividad, excluyendo domingos),
 * en ventanas de 180 y 365 días. El P85 es la referencia de calibración.
 *
 * "Recalibrar" ejecuta telas.fn_capacidad_calibrar en la BD (registra en el
 * log SIN pisar el parámetro); "Aplicar P85" copia el valor real al parámetro
 * del área (solo admins).
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Activity, RefreshCw, Loader2, AlertTriangle, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  useCapacidadDatos,
  recalibrar,
  actualizarAreaParametro,
} from "@/lib/capacidad/capacidad-data"
import { AREAS_MOTOR, type CalibracionLog } from "@/lib/capacidad/motor"
import { AyudaCapacidad, Termino } from "./capacidad-ayuda"

const VENTANAS = [180, 365] as const

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function CapacidadReal() {
  const { usuarioActual } = useAuth()
  const esAdmin = usuarioActual?.mod_admin === true
  const { datos, loading, error, refresh } = useCapacidadDatos()
  const [ventana, setVentana] = useState<(typeof VENTANAS)[number]>(365)
  const [calibrando, setCalibrando] = useState(false)
  const [aplicando, setAplicando] = useState<string | null>(null)

  // Última calibración por (área, ventana) — el log viene ordenado desc.
  const ultimaPorArea = useMemo(() => {
    const mapa = new Map<string, CalibracionLog>()
    for (const c of datos?.calibraciones ?? []) {
      if (c.ventana_dias !== ventana) continue
      if (!mapa.has(c.area)) mapa.set(c.area, c)
    }
    return mapa
  }, [datos, ventana])

  const hayCalibraciones = (datos?.calibraciones ?? []).length > 0

  const ejecutarCalibracion = async () => {
    setCalibrando(true)
    // Ambas ventanas, para tener 180 y 365 al día.
    const r180 = await recalibrar(180, false)
    const r365 = r180.success ? await recalibrar(365, false) : r180
    setCalibrando(false)
    if (r365.success) {
      toast.success("Calibración ejecutada", {
        description: "Se recalculó la capacidad real (ventanas 180 y 365 días).",
      })
      await refresh()
    } else {
      toast.error("No se pudo calibrar", { description: r365.error })
    }
  }

  const aplicarP85 = async (area: string, p85: number, ordP85: number | null) => {
    setAplicando(area)
    const r = await actualizarAreaParametro(area, {
      capacidad_efectiva: p85,
      ...(ordP85 != null ? { ordenes_dia_p85: ordP85 } : {}),
    })
    setAplicando(null)
    if (r.success) {
      toast.success(`Parámetro de ${area} actualizado al P85 real (${p85})`)
      await refresh()
    } else {
      toast.error("No se pudo aplicar", { description: r.error })
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error || !datos)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error ?? "Sin datos"}
      </div>
    )

  return (
    <div className="space-y-4">
      {datos.errorMotor && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {datos.errorMotor}
        </div>
      )}

      <AyudaCapacidad>
        <Termino nombre="¿Qué se calcula aquí?">
          por cada área se cuenta cuántas prendas TERMINÓ cada día (según las fechas de cierre
          registradas en el sistema, sin domingos) dentro de la ventana elegida (180 o 365 días), y
          sobre esos días con actividad se sacan los percentiles.
        </Termino>
        <Termino nombre="P50 (mediana)">
          el día típico: la mitad de los días el área produjo menos que esto y la mitad más. Es el
          ritmo normal.
        </Termino>
        <Termino nombre="P85 real">
          el 85% de los días se produjo esto o menos; solo el 15% de los días se superó. Es un
          <strong> día bueno pero repetible</strong> — la referencia recomendada de capacidad
          efectiva: planear con menos subestima la planta, planear con más no es sostenible.
        </Termino>
        <Termino nombre="P95">
          los días excepcionales (solo el 5% lo superó): horas extra, órdenes gigantes. No sirve
          para comprometer entregas todos los días.
        </Termino>
        <Termino nombre="Promedio">
          la media aritmética; los días flojos la arrastran hacia abajo, por eso suele ser menor
          que el P85.
        </Termino>
        <Termino nombre="Días activos / baja confianza">
          cuántos días con producción hubo en la ventana. Con menos de 60, el percentil se calcula
          con pocos datos y se marca “baja confianza”.
        </Termino>
        <Termino nombre="Parámetro vs Desvío">
          el parámetro es la capacidad vigente que usa el motor (pestaña Parámetros). El desvío lo
          compara contra el P85 real: dentro de ±2% se considera calibrado; “Aplicar P85” copia el
          valor real al parámetro.
        </Termino>
      </AyudaCapacidad>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-icon-green" />
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Capacidad real (histórico) vs parámetro
            </h2>
            <p className="text-xs text-slate-500">
              P85 de prendas/día sobre días con actividad, excluyendo domingos. Fuente:
              fechas de fin por área en cabecera (volumen = pcs del pedido).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {VENTANAS.map((v) => (
              <button
                key={v}
                onClick={() => setVentana(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  ventana === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                )}
              >
                {v} días
              </button>
            ))}
          </div>
          {esAdmin && (
            <Button size="sm" onClick={() => void ejecutarCalibracion()} disabled={calibrando}>
              {calibrando ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-4" />
              )}
              Recalibrar
            </Button>
          )}
        </div>
      </div>

      {!hayCalibraciones && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-900">
          Aún no hay calibraciones registradas.{" "}
          {esAdmin
            ? "Pulsa “Recalibrar” para calcular la capacidad real desde el histórico."
            : "Pide a un administrador ejecutar la calibración."}
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead className="text-right whitespace-nowrap">Parámetro (pcs/día)</TableHead>
                <TableHead className="text-right whitespace-nowrap">P85 real</TableHead>
                <TableHead className="text-right">P50</TableHead>
                <TableHead className="text-right">P95</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
                <TableHead className="text-right whitespace-nowrap">Órd/día P85</TableHead>
                <TableHead className="text-right whitespace-nowrap">Días activos</TableHead>
                <TableHead className="text-right whitespace-nowrap">Desvío</TableHead>
                {esAdmin && <TableHead className="text-right whitespace-nowrap">Acción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {AREAS_MOTOR.map((a) => {
                const p = datos.params.find((x) => x.area === a.key)
                const c = ultimaPorArea.get(a.key)
                const param = p?.capacidad_efectiva ?? null
                const p85 = c?.pcs_dia_p85 ?? null
                const desvio =
                  param != null && p85 != null && p85 > 0
                    ? ((param - p85) / p85) * 100
                    : null
                return (
                  <TableRow key={a.key}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {a.label}
                      {c?.baja_confianza && (
                        <Badge className="ml-1.5 border border-amber-300 bg-amber-100 px-1 py-0 text-[9px] text-amber-800 hover:bg-amber-200">
                          baja confianza
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {param != null ? param.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-indigo-700">
                      {p85 != null ? p85.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {c?.pcs_dia_p50 ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {c?.pcs_dia_p95 ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {c?.pcs_dia_prom ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {c?.ordenes_dia_p85 ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {c?.dias_activos ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        desvio == null
                          ? "text-slate-400"
                          : Math.abs(desvio) <= 2
                          ? "text-emerald-600"
                          : Math.abs(desvio) <= 10
                          ? "text-amber-600"
                          : "text-rose-600 font-medium"
                      )}
                    >
                      {desvio != null ? `${desvio > 0 ? "+" : ""}${desvio.toFixed(1)}%` : "—"}
                    </TableCell>
                    {esAdmin && (
                      <TableCell className="text-right">
                        {p85 != null && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs"
                            disabled={aplicando === a.key}
                            onClick={() =>
                              void aplicarP85(a.key, p85, c?.ordenes_dia_p85 ?? null)
                            }
                            title="Copiar el P85 real al parámetro del área"
                          >
                            {aplicando === a.key ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="size-3" />
                            )}
                            Aplicar P85
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        “Baja confianza” = menos de 60 días con actividad en la ventana. El desvío compara el
        parámetro vigente contra el P85 real (±2% se considera calibrado).
      </p>

      {/* Histórico de calibraciones */}
      {hayCalibraciones && (
        <details className="rounded-lg border bg-white p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Histórico de calibraciones ({datos.calibraciones.length})
          </summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <Table className="text-xs [&_td]:px-2 [&_td]:py-1 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Ventana</TableHead>
                  <TableHead className="text-right">Días act.</TableHead>
                  <TableHead className="text-right">P50</TableHead>
                  <TableHead className="text-right">P85</TableHead>
                  <TableHead className="text-right">P95</TableHead>
                  <TableHead className="text-right">Prom</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.calibraciones.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{fmtFecha(c.fecha_calculo)}</TableCell>
                    <TableCell>{c.area}</TableCell>
                    <TableCell className="text-right">{c.ventana_dias}d</TableCell>
                    <TableCell className="text-right">{c.dias_activos}</TableCell>
                    <TableCell className="text-right">{c.pcs_dia_p50 ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{c.pcs_dia_p85 ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.pcs_dia_p95 ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.pcs_dia_prom ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      )}
    </div>
  )
}
