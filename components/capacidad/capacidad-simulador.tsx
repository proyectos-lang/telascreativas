"use client"

/**
 * Tab "Simulador" — ¿qué pasa si programo una orden nueva?
 *
 * Usa la matriz de tiempos por tipo de producción (días hábiles por etapa,
 * rango <24 / ≥24 pcs) y el ATP diario por área para programar la orden hacia
 * adelante y devolver la fecha más temprana posible, el área restrictiva y
 * (si es urgente y ni el colchón alcanza) las órdenes que se desplazarían.
 * "Reservar" persiste la carga simulada para que el ATP la descuente.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  FlaskConical,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Bookmark,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  guardarReservas,
  eliminarReservasPorDetalle,
} from "@/lib/capacidad/capacidad-data"
import {
  cargaPorAreaDia,
  reservasPorAreaDia,
  filaMatriz,
  simular,
  ocupacionPorMaquinaSemana,
  capacidadSemanalMaquina,
  type ContextoATP,
  type SimResultado,
} from "@/lib/capacidad/motor"
import {
  addDaysUTC,
  esLaboral,
  fmtDia,
  fmtDiaSemana,
  lunesDeSemana,
  parseYMD,
  semanaISO,
} from "@/lib/capacidad/fechas"
import { AyudaCapacidad, Termino } from "./capacidad-ayuda"

export function CapacidadSimulador() {
  const { usuarioActual } = useAuth()
  const esAdmin = usuarioActual?.mod_admin === true
  const { datos, loading, error, refresh } = useCapacidadDatos()

  const [tipoCodigo, setTipoCodigo] = useState<string>("")
  const [cantidad, setCantidad] = useState<string>("")
  const [maquina, setMaquina] = useState<string>("ninguna")
  const [urgente, setUrgente] = useState(false)
  const [fechaDeseada, setFechaDeseada] = useState("")
  const [resultado, setResultado] = useState<SimResultado | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [reservando, setReservando] = useState(false)
  const [ultimaEtiqueta, setUltimaEtiqueta] = useState<string | null>(null)

  const tipos = useMemo(() => {
    const vistos = new Map<number, { codigo: number; nombre: string; concepto: string | null }>()
    for (const m of datos?.matriz ?? []) {
      if (!vistos.has(m.tipo_codigo))
        vistos.set(m.tipo_codigo, {
          codigo: m.tipo_codigo,
          nombre: m.tipo_nombre,
          concepto: m.concepto,
        })
    }
    return [...vistos.values()].sort((a, b) => a.codigo - b.codigo)
  }, [datos])

  const ctx: ContextoATP | null = useMemo(() => {
    if (!datos) return null
    return {
      params: datos.params,
      carga: cargaPorAreaDia(datos.ordenes),
      reservas: reservasPorAreaDia(datos.reservas),
      excepciones: datos.excepciones,
    }
  }, [datos])

  // Advertencia de máquina: ocupación de la semana de entrega estimada + cantidad.
  const advertenciaMaquina = useMemo(() => {
    if (!datos || !resultado?.fechaMasTemprana || maquina === "ninguna") return null
    const capSem = capacidadSemanalMaquina(datos.maquinas, maquina)
    if (capSem == null) return null
    const entrega = parseYMD(resultado.fechaMasTemprana)!
    const lunes = lunesDeSemana(new Date())
    const idx = Math.floor((lunesDeSemana(entrega).getTime() - lunes.getTime()) / (7 * 86400000))
    if (idx < 0) return null
    const ocupacion = ocupacionPorMaquinaSemana(datos.ordenes, idx + 1)
    const enSemana = ocupacion[idx]?.porMaquina[maquina] ?? 0
    const total = enSemana + Number(cantidad || 0)
    if (total > capSem) {
      return `La máquina ${maquina} quedaría en ${total.toLocaleString()} pcs esa semana (capacidad ${capSem.toLocaleString()}). Sobrecarga de ${(total - capSem).toLocaleString()} pcs.`
    }
    return null
  }, [datos, resultado, maquina, cantidad])

  const ejecutar = () => {
    if (!datos || !ctx) return
    const cant = Number(cantidad)
    if (!tipoCodigo) return toast.error("Selecciona el tipo de producción")
    if (!Number.isFinite(cant) || cant <= 0) return toast.error("Ingresa la cantidad de prendas")
    const fila = filaMatriz(datos.matriz, Number(tipoCodigo), cant)
    if (!fila)
      return toast.error("No hay matriz de tiempos para ese tipo", {
        description: "Ejecuta scripts/capacidad-motor.sql o revisa la tabla capacidad_matriz_tiempos.",
      })
    setSimulando(true)
    setUltimaEtiqueta(null)
    try {
      const res = simular(
        { fila, cantidad: cant, esUrgente: urgente, fechaDeseada: fechaDeseada || null },
        ctx
      )
      setResultado(res)
    } finally {
      setSimulando(false)
    }
  }

  const reservar = async () => {
    if (!resultado || !datos) return
    const filas: {
      area: string
      fecha_planificada: string
      pcs_reservadas: number
      detalle: string
      creado_por: string | null
    }[] = []
    const etiqueta = `SIM ${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${
      tipos.find((t) => String(t.codigo) === tipoCodigo)?.nombre ?? "tipo"
    } · ${cantidad} pcs`
    for (const e of resultado.etapas) {
      if (e.esEspera || !e.inicio || !e.fin || e.cuotaDiaria <= 0) continue
      let d = parseYMD(e.inicio)!
      const fin = parseYMD(e.fin)!
      while (d <= fin) {
        if (esLaboral(d)) {
          filas.push({
            area: e.key,
            fecha_planificada: d.toISOString().slice(0, 10),
            pcs_reservadas: Math.round(e.cuotaDiaria * 100) / 100,
            detalle: etiqueta,
            creado_por: (usuarioActual?.email as string) ?? null,
          })
        }
        d = addDaysUTC(d, 1)
      }
    }
    if (!filas.length) return toast.error("La simulación no tiene etapas productivas que reservar")
    setReservando(true)
    const r = await guardarReservas(filas)
    setReservando(false)
    if (r.success) {
      setUltimaEtiqueta(etiqueta)
      toast.success("Capacidad reservada", {
        description: `${filas.length} día(s)-área reservados. El ATP ya la descuenta.`,
      })
      await refresh()
    } else {
      toast.error("No se pudo reservar", { description: r.error })
    }
  }

  // Reservas activas agrupadas por etiqueta (detalle).
  const reservasAgrupadas = useMemo(() => {
    const grupos = new Map<
      string,
      { detalle: string; pcs: number; desde: string; hasta: string; creadoPor: string | null }
    >()
    for (const r of datos?.reservas ?? []) {
      const key = r.detalle ?? `#${r.id}`
      const g = grupos.get(key)
      if (!g) {
        grupos.set(key, {
          detalle: key,
          pcs: Number(r.pcs_reservadas),
          desde: r.fecha_planificada,
          hasta: r.fecha_planificada,
          creadoPor: r.creado_por,
        })
      } else {
        g.pcs += Number(r.pcs_reservadas)
        if (r.fecha_planificada < g.desde) g.desde = r.fecha_planificada
        if (r.fecha_planificada > g.hasta) g.hasta = r.fecha_planificada
      }
    }
    return [...grupos.values()]
  }, [datos])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error || !datos)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error ?? "Sin datos"}
      </div>
    )

  const tipoSel = tipos.find((t) => String(t.codigo) === tipoCodigo)

  return (
    <div className="space-y-4">
      {datos.errorMotor && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {datos.errorMotor}
        </div>
      )}

      <AyudaCapacidad>
        <Termino nombre="Tipo de producción">
          define los días hábiles de cada etapa según la matriz entregada por producción (10
          tipos). El rango se elige solo por la cantidad: menos de 24 piezas o 24 y más.
        </Termino>
        <Termino nombre="¿Cómo calcula la fecha?">
          programa la orden hacia adelante etapa por etapa (Diseño → Corte → Aprobación → Impresión
          → Sublimación → Costura), buscando días con ATP suficiente. La cuota/día = cantidad ÷ días
          de la etapa.
        </Termino>
        <Termino nombre="Aprobación">
          es espera del cliente/ventas: consume días de calendario pero NO capacidad de planta.
        </Termino>
        <Termino nombre="Se deslizó">
          la etapa no cupo en su fecha ideal (no había ATP) y se movió hacia adelante. La etapa que
          más se desliza es el <strong>área restrictiva</strong> de esa simulación.
        </Termino>
        <Termino nombre="Urgente">
          no se desliza: entra de una, puede consumir el colchón de urgentes y, si ni así alcanza,
          se listan las <strong>órdenes ya comprometidas que se desplazarían</strong> (las de
          entrega más lejana primero) — decide con esa información.
        </Termino>
        <Termino nombre="Fecha deseada">
          si la pones, el resultado dice FACTIBLE o NO según la fecha más temprana calculada.
        </Termino>
        <Termino nombre="Máquina costura">
          valida además la ocupación semanal de esa máquina (Plana 325/sem, Sorgete 1,500/sem) en la
          semana de entrega estimada.
        </Termino>
        <Termino nombre="Reservar esta capacidad">
          aparta la carga simulada en firme: el ATP de todos los usuarios la descuenta hasta que un
          administrador la elimine. Úsalo cuando la venta esté prácticamente cerrada.
        </Termino>
      </AyudaCapacidad>

      {/* Formulario */}
      <Card className="border-indigo-200 bg-indigo-50/40 p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-indigo-900">
            Simular una orden nueva (matriz de tiempos + ATP por área)
          </h2>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-col gap-1">
            <label className="text-xs text-slate-600">Tipo de producción</label>
            <Select value={tipoCodigo} onValueChange={setTipoCodigo}>
              <SelectTrigger className="h-9 bg-white text-sm">
                <SelectValue placeholder="Selecciona el tipo…" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.codigo} value={String(t.codigo)}>
                    {t.codigo}. {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Prendas</label>
            <Input
              type="number"
              min={1}
              placeholder="Ej. 120"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="h-9 w-28 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Máquina costura</label>
            <Select value={maquina} onValueChange={setMaquina}>
              <SelectTrigger className="h-9 w-36 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">—</SelectItem>
                <SelectItem value="Plana">Plana</SelectItem>
                <SelectItem value="Sorgete">Sorgete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Fecha deseada (opcional)</label>
            <Input
              type="date"
              value={fechaDeseada}
              onChange={(e) => setFechaDeseada(e.target.value)}
              className="h-9 w-40 bg-white"
            />
          </div>
          <label className="flex h-9 items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={urgente}
              onChange={(e) => setUrgente(e.target.checked)}
              className="accent-rose-600"
            />
            Urgente
          </label>
          <Button onClick={ejecutar} disabled={simulando} className="h-9">
            {simulando ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-1.5 size-4" />
            )}
            Simular
          </Button>
        </div>
        {tipoSel?.concepto && (
          <p className="mt-2 text-[11px] text-slate-500">{tipoSel.concepto}</p>
        )}
        {cantidad && Number(cantidad) > 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            Rango de la matriz: <strong>{Number(cantidad) < 24 ? "menos de 24" : "24 o más"}</strong>{" "}
            piezas. {urgente && "Urgente: consume el colchón de urgentes y no se desliza."}
          </p>
        )}
      </Card>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              resultado.factible && resultado.desplazadas.length === 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : resultado.factible
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-rose-300 bg-rose-50 text-rose-800"
            )}
          >
            {resultado.factible && resultado.desplazadas.length === 0 ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            )}
            <div>
              {resultado.fallo ? (
                <strong>{resultado.fallo}</strong>
              ) : (
                <>
                  <strong>
                    {resultado.factible ? "Factible" : "NO factible para la fecha deseada"}
                  </strong>{" "}
                  — entrega más temprana:{" "}
                  <strong>
                    {resultado.fechaMasTemprana
                      ? fmtDiaSemana(parseYMD(resultado.fechaMasTemprana)!)
                      : "—"}
                  </strong>{" "}
                  ({resultado.diasHabilesRequeridos} días hábiles desde{" "}
                  {fmtDia(parseYMD(resultado.fechaInicio)!)}).
                  {resultado.fechaMasTemprana && (
                    <>
                      {" "}Semana {semanaISO(parseYMD(resultado.fechaMasTemprana)!).numero}.
                    </>
                  )}
                </>
              )}
              {resultado.areaRestrictiva && (
                <p className="mt-0.5 text-xs">
                  Área restrictiva: <strong>{resultado.areaRestrictiva}</strong>
                </p>
              )}
              {advertenciaMaquina && <p className="mt-0.5 text-xs">{advertenciaMaquina}</p>}
            </div>
          </div>

          {/* Detalle por etapa */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="whitespace-nowrap">Inicio</TableHead>
                  <TableHead className="whitespace-nowrap">Fin</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cuota/día</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Se deslizó</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.etapas
                  .filter((e) => e.dias > 0)
                  .map((e) => (
                    <TableRow key={e.key} className={e.esEspera ? "bg-slate-50/60" : undefined}>
                      <TableCell className="font-medium">
                        {e.label}
                        {e.esEspera && (
                          <span className="ml-1 text-[10px] text-slate-400">(espera)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.dias}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {e.inicio ? fmtDia(parseYMD(e.inicio)!) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {e.fin ? fmtDia(parseYMD(e.fin)!) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {e.cuotaDiaria > 0 ? Math.ceil(e.cuotaDiaria).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          e.diasEmpujada > 0 ? "font-medium text-amber-600" : "text-slate-400"
                        )}
                      >
                        {e.diasEmpujada > 0 ? `+${e.diasEmpujada} día(s)` : "no"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {/* Órdenes desplazadas (urgente sin colchón suficiente) */}
          {resultado.desplazadas.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-white overflow-hidden">
              <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                ⚠ Esta urgente desplazaría {resultado.desplazadas.length} orden
                {resultado.desplazadas.length !== 1 ? "es" : ""} ya comprometida
                {resultado.desplazadas.length !== 1 ? "s" : ""}:
              </div>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Pcs</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Día en conflicto</TableHead>
                    <TableHead>Entrega comprometida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.desplazadas.map((d, i) => (
                    <TableRow key={`${d.pedido}-${i}`}>
                      <TableCell className="font-medium">{d.pedido}</TableCell>
                      <TableCell>{d.cliente ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.pcs.toLocaleString()}
                      </TableCell>
                      <TableCell>{d.area}</TableCell>
                      <TableCell>{fmtDia(parseYMD(d.fecha)!)}</TableCell>
                      <TableCell>{d.entrega ? fmtDia(parseYMD(d.entrega)!) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Reservar */}
          {!resultado.fallo && !ultimaEtiqueta && (
            <Button
              variant="outline"
              onClick={() => void reservar()}
              disabled={reservando}
              className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              {reservando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bookmark className="size-4" />
              )}
              Reservar esta capacidad
            </Button>
          )}
          {ultimaEtiqueta && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CalendarCheck className="size-4" /> Reserva guardada: {ultimaEtiqueta}
            </p>
          )}
        </div>
      )}

      {/* Reservas activas */}
      {reservasAgrupadas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Reservas de capacidad activas</h3>
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Reserva</TableHead>
                  <TableHead className="text-right">Pcs totales</TableHead>
                  <TableHead className="whitespace-nowrap">Rango</TableHead>
                  <TableHead>Creada por</TableHead>
                  {esAdmin && <TableHead className="text-right">Quitar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservasAgrupadas.map((g) => (
                  <TableRow key={g.detalle}>
                    <TableCell className="max-w-[320px] truncate" title={g.detalle}>
                      <Badge variant="outline" className="text-[10px]">
                        simulación
                      </Badge>{" "}
                      {g.detalle}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(g.pcs).toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {fmtDia(parseYMD(g.desde)!)} – {fmtDia(parseYMD(g.hasta)!)}
                    </TableCell>
                    <TableCell className="text-slate-500">{g.creadoPor ?? "—"}</TableCell>
                    {esAdmin && (
                      <TableCell className="text-right">
                        <button
                          onClick={async () => {
                            const r = await eliminarReservasPorDetalle(g.detalle)
                            if (r.success) {
                              toast.success("Reserva eliminada")
                              await refresh()
                            } else toast.error("No se pudo eliminar", { description: r.error })
                          }}
                          className="text-slate-400 hover:text-rose-500"
                          title="Eliminar reserva (libera el ATP)"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
