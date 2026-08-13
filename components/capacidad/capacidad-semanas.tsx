"use client"

/**
 * Tab "Semanas" del módulo Capacidad.
 *
 * Lee directamente de `telas.cabecera` (fuente de verdad) para incluir TODAS
 * las órdenes por su fecha de entrega al cliente — incluidas las que aún no
 * han pasado por Programación. Suma las prendas (`pcs`) por semana de entrega
 * vs la capacidad semanal (meta total desde telas.capacidad_maquinas, editable
 * en pantalla) y muestra además la ocupación semanal por máquina de costura
 * (Plana / Sorgete) contra sus capacidades (325 / 1500 por semana).
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
  Scissors,
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
import {
  addDaysUTC,
  fmtDia,
  lunesDeSemana,
  parseYMD,
  semanaISO,
  toPcs,
  toYMD,
} from "@/lib/capacidad/fechas"
import {
  capacidadSemanalMaquina,
  metaSemanalTotal,
  ocupacionPorMaquinaSemana,
  MAQUINA_SIN_ASIGNAR,
  type MaquinaCapacidad,
  type OrdenCapacidad,
} from "@/lib/capacidad/motor"
import { AyudaCapacidad, Termino } from "./capacidad-ayuda"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Capacidad semanal por defecto si la tabla capacidad_maquinas no existe aún.
const CAPACIDAD_DEFAULT = 1825
// Horizonte de semanas a mostrar hacia adelante.
const HORIZONTE_SEMANAS = 12
// Semanas del bloque de ocupación por máquina.
const SEMANAS_MAQUINA = 8
// Lead mínimo de producción en días hábiles (Lun–Sáb) antes de poder entregar
// un pedido nuevo, aunque haya cupo libre. ~ objetivo de Empaque (+8).
const LEAD_MINIMO_HABILES = 8

interface PlanRow {
  pedido: string | null
  cliente: string | null
  pcs: number | string | null
  fecha_de_entrega: string | null
  fecha_de_entreganueva: string | null
  entregado_cliente_si_no: boolean | null
  estado_aprobado_rechazado: string | null
  // Campos para la ocupación por máquina de costura
  maquina_costura: string | null
  coseta_costura: string | null
  tipo_flujo_especial: string | null
  solo_corte_costura: boolean | null
  costura_si_no: boolean | string | null
  accesorios_inventario: string | null
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

function esCanceladaRechazada(r: PlanRow): boolean {
  const est = (r.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase()
  return est === "cancelado" || est === "rechazado"
}
function esEntregada(r: PlanRow): boolean {
  return r.entregado_cliente_si_no === true
}
/** Fecha de entrega efectiva: la reprogramada si existe, si no la original. */
function fechaEntregaEfectiva(r: PlanRow): string | null {
  return r.fecha_de_entreganueva || r.fecha_de_entrega
}

export function CapacidadSemanas() {
  const [rows, setRows] = useState<PlanRow[]>([])
  const [maquinas, setMaquinas] = useState<MaquinaCapacidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capacidad, setCapacidad] = useState(CAPACIDAD_DEFAULT)
  const [capacidadTocada, setCapacidadTocada] = useState(false)
  const [cantidad, setCantidad] = useState<string>("")

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const anoActual = new Date().getUTCFullYear()
    const desde = `${anoActual - 1}-01-01`
    const [{ data, error: err }, maqR] = await Promise.all([
      fetchAll<PlanRow>((from, to) =>
        supabase
          .schema("telas")
          .from("cabecera")
          .select(
            "pedido, cliente, pcs, fecha_de_entrega, fecha_de_entreganueva, entregado_cliente_si_no, estado_aprobado_rechazado, maquina_costura, coseta_costura, tipo_flujo_especial, solo_corte_costura, costura_si_no, accesorios_inventario"
          )
          // Ventana amplia por fecha de entrega + las órdenes SIN fecha (aún no
          // programadas), que también queremos mostrar/sumar.
          .or(
            `fecha_de_entrega.gte.${desde},fecha_de_entreganueva.gte.${desde},fecha_de_entrega.is.null`
          )
          .range(from, to)
      ),
      supabase.schema("telas").from("capacidad_maquinas").select("*").eq("activo", true),
    ])
    if (err) {
      setError(err.message)
      setRows([])
    } else {
      // Excluimos solo canceladas/rechazadas; las ENTREGADAS se conservan
      // porque la semana actual y el acumulado anterior sí las cuentan.
      setRows((data ?? []).filter((r) => !esCanceladaRechazada(r)))
    }
    setMaquinas((maqR.data ?? []) as MaquinaCapacidad[])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Meta semanal desde capacidad_maquinas (si existe y el usuario no la tocó).
  useEffect(() => {
    if (capacidadTocada) return
    const meta = metaSemanalTotal(maquinas)
    if (meta && meta > 0) setCapacidad(meta)
  }, [maquinas, capacidadTocada])

  // Semanas del horizonte + prendas programadas por semana. El backlog vencido
  // (entregas ya pasadas y aún activas) se contabiliza aparte.
  const {
    semanas,
    backlogPcs,
    backlogPedidos,
    anterioresPcs,
    anterioresPedidos,
    sinProgramarPcs,
    sinProgramarPedidos,
    lunesActual,
  } = useMemo(() => {
    const lunes = lunesDeSemana(new Date())
    const lista: SemanaCapacidad[] = []
    for (let i = 0; i < HORIZONTE_SEMANAS; i++) {
      const inicio = addDaysUTC(lunes, i * 7)
      const fin = addDaysUTC(inicio, 6)
      const { ano, numero } = semanaISO(inicio)
      lista.push({ idx: i, inicio, fin, numero, ano, programado: 0, pedidos: 0 })
    }
    let bPcs = 0
    let bPed = 0 // atrasadas: de semanas anteriores, aún NO entregadas
    let aPcs = 0
    let aPed = 0 // acumulado de TODAS las semanas anteriores (incl. entregadas)
    let spPcs = 0
    let spPed = 0 // sin programar: sin fecha de entrega al cliente
    for (const r of rows) {
      const pcs = toPcs(r.pcs)
      const entregada = esEntregada(r)
      const f = parseYMD(fechaEntregaEfectiva(r))
      // Sin fecha de entrega → aún no programada.
      if (!f) {
        if (!entregada) {
          spPcs += pcs
          spPed += 1
        }
        continue
      }
      // Semanas anteriores a la actual → acumulado histórico.
      if (f < lunes) {
        aPcs += pcs
        aPed += 1
        if (!entregada) {
          bPcs += pcs
          bPed += 1
        }
        continue
      }
      const diffDias = Math.floor((f.getTime() - lunes.getTime()) / 86400000)
      const idx = Math.floor(diffDias / 7)
      if (idx < 0 || idx >= HORIZONTE_SEMANAS) continue
      // La semana ACTUAL (idx 0) cuenta también las entregadas; las semanas
      // POSTERIORES solo cuentan lo programado (no entregado).
      if (idx >= 1 && entregada) continue
      lista[idx].programado += pcs
      lista[idx].pedidos += 1
    }
    return {
      semanas: lista,
      backlogPcs: bPcs,
      backlogPedidos: bPed,
      anterioresPcs: aPcs,
      anterioresPedidos: aPed,
      sinProgramarPcs: spPcs,
      sinProgramarPedidos: spPed,
      lunesActual: lunes,
    }
  }, [rows])

  const cap = capacidad > 0 ? capacidad : CAPACIDAD_DEFAULT

  // Ocupación por máquina de costura (pendiente de coser, por semana de entrega).
  const ocupacionMaquinas = useMemo(
    () =>
      ocupacionPorMaquinaSemana(
        rows as unknown as OrdenCapacidad[],
        SEMANAS_MAQUINA
      ),
    [rows]
  )
  const capPlana = capacidadSemanalMaquina(maquinas, "Plana") ?? 325
  const capSorgete = capacidadSemanalMaquina(maquinas, "Sorgete") ?? 1500

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

  // Simulador rápido: cupo libre acumulado + lead mínimo (+ absorbe el backlog).
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
              onChange={(e) => {
                setCapacidadTocada(true)
                setCapacidad(Number(e.target.value) || 0)
              }}
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

      <AyudaCapacidad>
        <Termino nombre="Prendas programadas">
          suma de prendas (pcs) de TODAS las órdenes cuya fecha de entrega al cliente cae en esa
          semana — incluidas las que aún no han pasado por Programación. La <strong>semana
          actual</strong> incluye también lo ya entregado en la semana; las semanas futuras solo
          cuentan lo pendiente.
        </Termino>
        <Termino nombre="Capacidad semanal">
          meta total de la planta (Plana 325 + Sorgete 1,500 = 1,825 prendas/semana). El campo de
          arriba la deja cambiar temporalmente para jugar escenarios; el valor oficial vive en
          Parámetros → máquinas.
        </Termino>
        <Termino nombre="Cupo libre">
          capacidad − programado. Si es negativo, esa semana ya está comprometida por encima de la
          meta.
        </Termino>
        <Termino nombre="Ocupación / Estado">
          programado ÷ capacidad. Hasta 85% = Disponible; 85–100% = Casi llena; más de 100% =
          Sobrecargada.
        </Termino>
        <Termino nombre="Acumulado de semanas anteriores">
          todo lo que tenía entrega antes de esta semana (incluye lo ya entregado): contexto
          histórico.
        </Termino>
        <Termino nombre="Prendas atrasadas">
          la parte de ese acumulado que AÚN no se entrega: entra a competir por la capacidad antes
          que los pedidos nuevos.
        </Termino>
        <Termino nombre="Sin programar">
          órdenes sin fecha de entrega asignada; no ocupan ninguna semana hasta que se les ponga
          fecha.
        </Termino>
        <Termino nombre="Estimador rápido">
          reparte el pedido nuevo en el cupo libre de las próximas semanas (absorbiendo primero el
          atrasado) con un mínimo de 8 días hábiles de producción. Para una fecha por etapas según
          el tipo de producción usa la pestaña Simulador.
        </Termino>
        <Termino nombre="Ocupación por máquina">
          prendas de órdenes que aún no cierran Costura, por semana de entrega, contra la capacidad
          de cada máquina (Plana 325/sem, Sorgete 1,500/sem). “Sin asignar” = órdenes a las que el
          Planner no les definió máquina.
        </Termino>
      </AyudaCapacidad>

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
      {!loading && anterioresPcs > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div>
            Acumulado de <strong>semanas anteriores</strong> (hasta la semana pasada):{" "}
            <strong>{anterioresPcs.toLocaleString()} prendas</strong> en{" "}
            {anterioresPedidos.toLocaleString()} pedido
            {anterioresPedidos !== 1 ? "s" : ""} programados (incluye entregadas).
          </div>
        </div>
      )}
      {!loading && sinProgramarPcs > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-900">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-indigo-500" />
          <div>
            <strong>{sinProgramarPcs.toLocaleString()} prendas sin programar</strong> en{" "}
            {sinProgramarPedidos.toLocaleString()} pedido
            {sinProgramarPedidos !== 1 ? "s" : ""} (aún sin fecha de entrega al cliente).
            Todavía no ocupan ninguna semana; entrarán a la capacidad cuando se les asigne fecha.
          </div>
        </div>
      )}
      {!loading && backlogPcs > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>{backlogPcs.toLocaleString()} prendas atrasadas</strong> en{" "}
            {backlogPedidos.toLocaleString()} pedido{backlogPedidos !== 1 ? "s" : ""} con entrega
            vencida y aún sin entregar. Consumen capacidad antes que los pedidos nuevos.
          </div>
        </div>
      )}

      {/* Simulador rápido por cupo semanal */}
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
          Estimación rápida por cupo libre semanal. Para una fecha por etapas según el tipo de
          producción (matriz de tiempos) usa la pestaña <strong>Simulador</strong>.
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
                          <span className="ml-1 text-[10px] text-slate-400">
                            (actual · incluye entregadas)
                          </span>
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

      {/* Ocupación semanal por máquina de costura */}
      {!loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 text-icon-purple" />
            <h2 className="text-sm font-semibold text-slate-800">
              Ocupación por máquina de costura (pendiente de coser)
            </h2>
            <span className="text-xs text-slate-400">
              Plana {capPlana.toLocaleString()}/sem · Sorgete {capSorgete.toLocaleString()}/sem
            </span>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Semana</TableHead>
                    <TableHead className="w-[260px]">Plana</TableHead>
                    <TableHead className="w-[260px]">Sorgete</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Sin asignar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocupacionMaquinas.map((s, i) => {
                    const plana = s.porMaquina["Plana"] ?? 0
                    const sorgete = s.porMaquina["Sorgete"] ?? 0
                    const sinAsignar = s.porMaquina[MAQUINA_SIN_ASIGNAR] ?? 0
                    const renderBarra = (valor: number, capMaq: number) => {
                      const pct = capMaq > 0 ? Math.round((valor / capMaq) * 100) : 0
                      const color =
                        pct > 100 ? "bg-rose-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-500"
                      return (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full transition-all", color)}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-slate-600">
                            {valor.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                      )
                    }
                    return (
                      <TableRow key={i} className={i === 0 ? "bg-slate-50" : undefined}>
                        <TableCell className="whitespace-nowrap font-medium">
                          Sem {s.numero}
                          <span className="ml-1 text-[10px] text-slate-400">
                            {fmtDia(s.inicio)}–{fmtDia(s.fin)}
                          </span>
                          {i === 0 && (
                            <span className="ml-1 text-[10px] text-slate-400">
                              (actual + atrasado)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{renderBarra(plana, capPlana)}</TableCell>
                        <TableCell>{renderBarra(sorgete, capSorgete)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            sinAsignar > 0 ? "text-amber-600 font-medium" : "text-slate-400"
                          )}
                        >
                          {sinAsignar.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Prendas de órdenes activas que aún no cierran Costura, por semana de entrega (las
            vencidas caen en la semana actual). Capacidades por máquina en Parámetros: Plana
            (POLO 30/día, Social/Columbia 20/día, Varios 15/día = 65/día) y Sorgete 300/día.
          </p>
        </div>
      )}
    </div>
  )
}
