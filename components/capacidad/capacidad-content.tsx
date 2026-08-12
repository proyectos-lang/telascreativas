"use client"

/**
 * Módulo "Capacidad" (para comercial).
 *
 * Se apoya en la misma fuente que Plan Semanal (`telas.vista_plan_semanal`):
 * una fila por pedido con su semana de entrega precalculada. Suma las prendas
 * (`pcs`) programadas por semana y las compara contra la capacidad semanal de
 * la planta para:
 *   1) mostrar cuántos pedidos/prendas hay programados en cada semana,
 *   2) avisar si la planta está sobrecargada, y
 *   3) estimar, con un simulador, para cuándo se puede entregar un pedido
 *      nuevo de X prendas montado hoy (cupo libre acumulado + lead mínimo).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Gauge,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  CalendarClock,
  PackageCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { fetchAll } from "@/lib/fetch-all"
import { addDaysSkippingSundays, getTodayISO } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Capacidad semanal de la planta en prendas (dato de negocio).
const CAPACIDAD_DEFAULT = 1825
// Horizonte de semanas a mostrar hacia adelante.
const HORIZONTE_SEMANAS = 12
// Lead mínimo de producción en días hábiles (Lun–Sáb) antes de poder entregar
// un pedido nuevo, aunque haya cupo libre. ~ objetivo de Empaque (+8).
const LEAD_MINIMO_HABILES = 8

interface PlanRow {
  pedido: string | null
  cliente: string | null
  pcs: number | string | null
  fecha_de_entrega: string | null
  ano_entrega: number | null
  semana_ano: number | null
  estatus_actual: string | null
  estado_aprobado_rechazado: string | null
}

interface SemanaCapacidad {
  idx: number
  inicio: Date
  fin: Date
  numero: number
  ano: number
  programado: number
  pedidos: number
}

// --- Utilidades de fecha (UTC, coherente con el resto de la app) ---
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
/** Lunes (inicio ISO) de la semana que contiene `d`. */
function lunesDeSemana(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Lun=0 … Dom=6
  return addDaysUTC(x, -dow)
}
/** Número de semana ISO-8601 y su año. */
function semanaISO(d: Date): { ano: number; numero: number } {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - dayNum + 3) // jueves de esta semana
  const ano = x.getUTCFullYear()
  const primerJueves = new Date(Date.UTC(ano, 0, 4))
  const pjNum = (primerJueves.getUTCDay() + 6) % 7
  primerJueves.setUTCDate(primerJueves.getUTCDate() - pjNum + 3)
  const numero = 1 + Math.round((x.getTime() - primerJueves.getTime()) / (7 * 86400000))
  return { ano, numero }
}
function fmtDia(d: Date): string {
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
function toPcs(v: number | string | null): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function esActiva(r: PlanRow): boolean {
  const est = (r.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase()
  if (est === "cancelado" || est === "rechazado") return false
  const status = (r.estatus_actual ?? "").toString().trim().toUpperCase()
  if (status === "ENTREGADO" || status === "ENTREGAS") return false
  return true
}

export function CapacidadContent() {
  const [rows, setRows] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capacidad, setCapacidad] = useState(CAPACIDAD_DEFAULT)
  const [cantidad, setCantidad] = useState<string>("")

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const anoActual = new Date().getUTCFullYear()
    const { data, error: err } = await fetchAll<PlanRow>((from, to) =>
      supabase
        .schema("telas")
        .from("vista_plan_semanal")
        .select(
          "pedido, cliente, pcs, fecha_de_entrega, ano_entrega, semana_ano, estatus_actual, estado_aprobado_rechazado"
        )
        .gte("ano_entrega", anoActual - 1)
        .range(from, to)
    )
    if (err) {
      setError(err.message)
      setRows([])
    } else {
      setRows((data ?? []).filter(esActiva))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Semanas del horizonte + prendas programadas por semana. El backlog vencido
  // (entregas ya pasadas y aún activas) se contabiliza aparte.
  const { semanas, backlogPcs, backlogPedidos, lunesActual } = useMemo(() => {
    const lunes = lunesDeSemana(new Date())
    const lista: SemanaCapacidad[] = []
    for (let i = 0; i < HORIZONTE_SEMANAS; i++) {
      const inicio = addDaysUTC(lunes, i * 7)
      const fin = addDaysUTC(inicio, 6)
      const { ano, numero } = semanaISO(inicio)
      lista.push({ idx: i, inicio, fin, numero, ano, programado: 0, pedidos: 0 })
    }
    let bPcs = 0
    let bPed = 0
    for (const r of rows) {
      const f = parseYMD(r.fecha_de_entrega)
      if (!f) continue
      const pcs = toPcs(r.pcs)
      if (f < lunes) {
        bPcs += pcs
        bPed += 1
        continue
      }
      const diffDias = Math.floor((f.getTime() - lunes.getTime()) / 86400000)
      const idx = Math.floor(diffDias / 7)
      if (idx < 0 || idx >= HORIZONTE_SEMANAS) continue
      lista[idx].programado += pcs
      lista[idx].pedidos += 1
    }
    return { semanas: lista, backlogPcs: bPcs, backlogPedidos: bPed, lunesActual: lunes }
  }, [rows])

  const cap = capacidad > 0 ? capacidad : CAPACIDAD_DEFAULT

  // Alerta de sobrecarga: semanas del horizonte cuyo programado supera la
  // capacidad (prioriza las próximas 4).
  const semanasSobrecargadas = useMemo(
    () => semanas.filter((s) => s.programado > cap),
    [semanas, cap]
  )
  const sobrecargaProxima = useMemo(
    () => semanas.slice(0, 4).some((s) => s.programado > cap),
    [semanas, cap]
  )

  // Simulador: cupo libre acumulado + lead mínimo (+ absorbe el backlog).
  const simulacion = useMemo(() => {
    const x = Number(cantidad)
    if (!cantidad.trim() || !Number.isFinite(x) || x <= 0) return null

    const fechaMin = addDaysSkippingSundays(getTodayISO(), LEAD_MINIMO_HABILES)
    // Primera semana del horizonte cuyo fin ya alcanza el lead mínimo.
    let startIdx = semanas.findIndex((s) => toYMD(s.fin) >= fechaMin)
    if (startIdx < 0) startIdx = 0

    let deuda = backlogPcs // el atrasado consume cupo primero (catch-up)
    let restante = x
    let idxEntrega = -1
    for (let k = startIdx; k < semanas.length; k++) {
      let libre = Math.max(0, cap - semanas[k].programado)
      if (deuda > 0) {
        const usa = Math.min(libre, deuda)
        deuda -= usa
        libre -= usa
      }
      if (libre > 0) {
        restante -= libre
        if (restante <= 0) {
          idxEntrega = k
          break
        }
      }
    }

    if (idxEntrega >= 0) {
      const s = semanas[idxEntrega]
      return {
        dentroHorizonte: true,
        semanasDesdeAhora: idxEntrega,
        inicio: s.inicio,
        fin: s.fin,
        numero: s.numero,
        ano: s.ano,
      }
    }
    // Más allá del horizonte: semanas vacías (cupo = cap) absorben lo restante.
    const pendiente = restante + deuda
    const extra = Math.max(1, Math.ceil(pendiente / cap))
    const idxFinal = semanas.length - 1 + extra
    const inicio = addDaysUTC(lunesActual, idxFinal * 7)
    const fin = addDaysUTC(inicio, 6)
    const { ano, numero } = semanaISO(inicio)
    return {
      dentroHorizonte: false,
      semanasDesdeAhora: idxFinal,
      inicio,
      fin,
      numero,
      ano,
    }
  }, [cantidad, semanas, backlogPcs, cap, lunesActual])

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="size-6 text-icon-cyan" />
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Capacidad de planta</h1>
            <p className="text-xs text-slate-500">
              Carga programada por semana vs. capacidad. Consulta antes de comprometer una venta.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Capacidad semanal</label>
            <Input
              type="number"
              min={1}
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value) || 0)}
              className="h-8 w-24"
            />
            <span className="text-xs text-slate-400">prendas</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 size-4", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          No se pudo cargar la capacidad: {error}
        </div>
      )}

      {/* Alertas */}
      {!loading && sobrecargaProxima && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Planta sobrecargada</strong> en las próximas semanas: hay semanas con más
            de {cap.toLocaleString()} prendas programadas. Los pedidos nuevos entrarán más tarde.
          </div>
        </div>
      )}
      {!loading && backlogPcs > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>{backlogPcs.toLocaleString()} prendas atrasadas</strong> en{" "}
            {backlogPedidos.toLocaleString()} pedido{backlogPedidos !== 1 ? "s" : ""} con entrega
            vencida y aún en producción. Consumen capacidad antes que los pedidos nuevos.
          </div>
        </div>
      )}

      {/* Simulador */}
      <Card className="border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="size-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-indigo-900">
            ¿Para cuándo puedo entregar un pedido nuevo?
          </h2>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Prendas del pedido nuevo</label>
            <Input
              type="number"
              min={1}
              placeholder="Ej. 300"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-9 w-40 bg-white"
            />
          </div>
          {simulacion && (
            <div className="flex-1 rounded-lg border border-indigo-200 bg-white px-4 py-2.5">
              <p className="text-xs text-slate-500">Entrega estimada</p>
              <p className="text-lg font-semibold text-indigo-900">
                Semana {simulacion.numero} · {fmtDia(simulacion.inicio)} – {fmtDia(simulacion.fin)}{" "}
                {simulacion.ano}
              </p>
              <p className="text-xs text-slate-500">
                {simulacion.semanasDesdeAhora === 0
                  ? "Esta semana (según lead mínimo)"
                  : `En ~${simulacion.semanasDesdeAhora} semana${simulacion.semanasDesdeAhora !== 1 ? "s" : ""}`}
                {!simulacion.dentroHorizonte && " (más allá del horizonte mostrado)"}
              </p>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Estimación por cupo libre semanal (1 − programado/capacidad) acumulado desde un lead
          mínimo de {LEAD_MINIMO_HABILES} días hábiles, absorbiendo primero el atrasado. Es una
          guía; la fecha final la confirma Programación.
        </p>
      </Card>

      {/* Tabla por semana */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Semana</TableHead>
                <TableHead className="whitespace-nowrap">Fechas</TableHead>
                <TableHead className="text-right whitespace-nowrap">Pedidos</TableHead>
                <TableHead className="text-right whitespace-nowrap">Prendas program.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cupo libre</TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">Ocupación</TableHead>
                <TableHead className="whitespace-nowrap">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                semanas.map((s) => {
                  const libre = cap - s.programado
                  const pct = cap > 0 ? Math.round((s.programado / cap) * 100) : 0
                  const sobrecargada = s.programado > cap
                  const casiLleno = !sobrecargada && pct >= 85
                  const barColor = sobrecargada
                    ? "bg-rose-500"
                    : casiLleno
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  const esActual = s.idx === 0
                  return (
                    <TableRow key={s.idx} className={esActual ? "bg-slate-50" : undefined}>
                      <TableCell className="font-medium">
                        Semana {s.numero}
                        {esActual && (
                          <span className="ml-1 text-[10px] text-slate-400">(actual)</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {fmtDia(s.inicio)} – {fmtDia(s.fin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.pedidos.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {s.programado.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          libre < 0 ? "text-rose-600 font-medium" : "text-slate-600"
                        )}
                      >
                        {libre.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full transition-all", barColor)}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                            {pct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sobrecargada ? (
                          <Badge className="bg-rose-500 text-white hover:bg-rose-600">
                            <AlertTriangle className="mr-1 size-3" />
                            Sobrecargada
                          </Badge>
                        ) : casiLleno ? (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                            Casi llena
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700">
                            <CheckCircle2 className="mr-1 size-3" />
                            Disponible
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!loading && semanasSobrecargadas.length > 0 && (
        <p className="text-xs text-slate-500">
          {semanasSobrecargadas.length} de las {HORIZONTE_SEMANAS} semanas mostradas superan la
          capacidad de {cap.toLocaleString()} prendas.
        </p>
      )}
    </div>
  )
}
