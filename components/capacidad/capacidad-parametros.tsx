"use client"

/**
 * Tab "Parámetros" — configuración del motor de capacidad.
 *
 * Los ADMIN editan la capacidad objetivo por área (unidades/día, días de
 * proceso objetivo, límite físico, colchón de urgentes, activo, notas) y las
 * excepciones de calendario (paros / feriados / mantenimiento). El resto de
 * usuarios ve todo en solo lectura. Incluye como referencia la matriz de
 * tiempos por tipo de producción y las capacidades por máquina de costura.
 */

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Settings2,
  Save,
  Loader2,
  CalendarOff,
  Trash2,
  Plus,
  Table2,
  Scissors,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  actualizarAreaParametro,
  crearExcepcion,
  eliminarExcepcion,
} from "@/lib/capacidad/capacidad-data"
import { AREAS_MOTOR } from "@/lib/capacidad/motor"
import { getTodayISO } from "@/lib/date-utils"
import { AyudaCapacidad, Termino } from "./capacidad-ayuda"

interface DraftArea {
  capacidad_efectiva: string
  limite_fisico: string
  dias_proceso_objetivo: string
  colchon_pct: string // en % (15 = 0.15)
  activo: boolean
  notas: string
}

const num = (s: string): number | null => {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function CapacidadParametros() {
  const { usuarioActual } = useAuth()
  const esAdmin = usuarioActual?.mod_admin === true
  const { datos, loading, error, refresh } = useCapacidadDatos()

  const [drafts, setDrafts] = useState<Record<string, DraftArea>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  // Excepciones: formulario de alta
  const [excArea, setExcArea] = useState("*")
  const [excFecha, setExcFecha] = useState("")
  const [excFactor, setExcFactor] = useState("0")
  const [excMotivo, setExcMotivo] = useState("")
  const [excGuardando, setExcGuardando] = useState(false)

  useEffect(() => {
    if (!datos) return
    const d: Record<string, DraftArea> = {}
    for (const p of datos.params) {
      d[p.area] = {
        capacidad_efectiva: p.capacidad_efectiva != null ? String(p.capacidad_efectiva) : "",
        limite_fisico: p.limite_fisico != null ? String(p.limite_fisico) : "",
        dias_proceso_objetivo:
          p.dias_proceso_objetivo != null ? String(p.dias_proceso_objetivo) : "",
        colchon_pct: String(Math.round((p.colchon_urgentes_pct ?? 0.15) * 100)),
        activo: p.activo,
        notas: p.notas ?? "",
      }
    }
    setDrafts(d)
  }, [datos])

  const ordenAreas = useMemo(() => {
    if (!datos) return []
    const orden = [...AREAS_MOTOR.map((a) => a.key), "Accesorios"]
    return [...datos.params].sort(
      (a, b) =>
        (orden.indexOf(a.area) + 1 || 99) - (orden.indexOf(b.area) + 1 || 99)
    )
  }, [datos])

  const labelDe = (area: string) =>
    AREAS_MOTOR.find((a) => a.key === area)?.label ?? area

  const guardarArea = async (area: string) => {
    const d = drafts[area]
    if (!d) return
    const colchon = num(d.colchon_pct)
    setGuardando(area)
    const r = await actualizarAreaParametro(area, {
      capacidad_efectiva: num(d.capacidad_efectiva),
      limite_fisico: num(d.limite_fisico),
      dias_proceso_objetivo: num(d.dias_proceso_objetivo),
      colchon_urgentes_pct: colchon != null ? colchon / 100 : 0.15,
      activo: d.activo,
      notas: d.notas.trim() || null,
    })
    setGuardando(null)
    if (r.success) {
      toast.success(`Parámetros de ${labelDe(area)} guardados`)
      await refresh()
    } else {
      toast.error("No se pudo guardar", { description: r.error })
    }
  }

  const agregarExcepcion = async () => {
    if (!excFecha) return toast.error("Selecciona la fecha de la excepción")
    const factor = Number(excFactor)
    setExcGuardando(true)
    const r = await crearExcepcion({
      area: excArea,
      fecha: excFecha,
      factor,
      motivo: excMotivo.trim() || null,
    })
    setExcGuardando(false)
    if (r.success) {
      toast.success("Excepción registrada")
      setExcFecha("")
      setExcMotivo("")
      await refresh()
    } else {
      toast.error("No se pudo registrar", { description: r.error })
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
    <div className="space-y-6">
      {datos.errorMotor && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {datos.errorMotor}
        </div>
      )}

      <AyudaCapacidad>
        <Termino nombre="Capacidad (pcs/día)">
          el parámetro OBJETIVO de cada área: cuántas prendas por día se asume que puede procesar.
          Es el número que usan el heatmap ATP y el Simulador. Se puede calibrar contra el
          histórico en la pestaña “Capacidad real” (P85).
        </Termino>
        <Termino nombre="Límite físico">
          tope duro de máquina/proceso (opcional). El motor usa el MENOR entre la capacidad y este
          límite — sirve para que un parámetro optimista no supere lo físicamente posible.
        </Termino>
        <Termino nombre="Días objetivo">
          los días hábiles que el área debería tardar por orden (SLA): Diseño 3, Corte 3, Impresión
          4, Sublimación 5, Costura 6, Empaque 8.
        </Termino>
        <Termino nombre="Colchón urgentes %">
          porcentaje de la capacidad diaria que se aparta para pedidos urgentes (15% por defecto).
          El ATP normal no lo incluye; solo lo consumen las urgentes.
        </Termino>
        <Termino nombre="Activa">
          si se desmarca, el motor deja de calcular esa área (p. ej. Accesorios, que es una línea
          separada sin fechas propias en el sistema).
        </Termino>
        <Termino nombre="cuello: operador_impresion">
          recordatorio de la restricción física: 2 impresoras pero 1 solo operador — la capacidad
          no se duplica por tener 2 máquinas.
        </Termino>
        <Termino nombre="Excepciones">
          días con capacidad reducida: factor 0 = paro total, 0.5 = media capacidad, etc. Aplican a
          un área o a todas (“Todas las áreas”) y se reflejan de inmediato en el ATP.
        </Termino>
        <Termino nombre="Matriz de tiempos y máquinas">
          tablas de referencia que alimentan el Simulador y la pestaña Semanas: días por etapa
          según tipo de producción, y capacidad de costura por tipo de construcción.
        </Termino>
      </AyudaCapacidad>

      {/* Parámetros por área */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-icon-cyan" />
          <h2 className="text-sm font-semibold text-slate-800">Capacidad objetivo por área</h2>
          {!esAdmin && (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Solo lectura (edición: administradores)
            </Badge>
          )}
        </div>
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-sm [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead className="whitespace-nowrap">Capacidad (pcs/día)</TableHead>
                  <TableHead className="whitespace-nowrap">Límite físico</TableHead>
                  <TableHead className="whitespace-nowrap">Días objetivo</TableHead>
                  <TableHead className="whitespace-nowrap">Colchón urg. %</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead className="min-w-[220px]">Notas / restricciones</TableHead>
                  {esAdmin && <TableHead className="text-right">Guardar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenAreas.map((p) => {
                  const d = drafts[p.area]
                  if (!d) return null
                  const set = (patch: Partial<DraftArea>) =>
                    setDrafts((prev) => ({ ...prev, [p.area]: { ...prev[p.area], ...patch } }))
                  return (
                    <TableRow key={p.area} className={!d.activo ? "opacity-60" : undefined}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {labelDe(p.area)}
                        {p.recurso_cuello && (
                          <Badge className="ml-1.5 border border-amber-300 bg-amber-100 px-1 py-0 text-[9px] text-amber-800 hover:bg-amber-200">
                            cuello: {p.recurso_cuello}
                          </Badge>
                        )}
                        {p.puestos != null && (
                          <span className="ml-1 text-[10px] text-slate-400">
                            {p.puestos} puesto{p.puestos !== 1 ? "s" : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          disabled={!esAdmin}
                          value={d.capacidad_efectiva}
                          onChange={(e) => set({ capacidad_efectiva: e.target.value })}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          disabled={!esAdmin}
                          placeholder="—"
                          value={d.limite_fisico}
                          onChange={(e) => set({ limite_fisico: e.target.value })}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          disabled={!esAdmin}
                          value={d.dias_proceso_objetivo}
                          onChange={(e) => set({ dias_proceso_objetivo: e.target.value })}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          disabled={!esAdmin}
                          value={d.colchon_pct}
                          onChange={(e) => set({ colchon_pct: e.target.value })}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          disabled={!esAdmin}
                          checked={d.activo}
                          onChange={(e) => set({ activo: e.target.checked })}
                          className="accent-indigo-600"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={!esAdmin}
                          value={d.notas}
                          onChange={(e) => set({ notas: e.target.value })}
                          className="h-8 text-xs"
                          title={d.notas}
                        />
                      </TableCell>
                      {esAdmin && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={guardando === p.area}
                            onClick={() => void guardarArea(p.area)}
                            className="h-8"
                          >
                            {guardando === p.area ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Save className="size-3.5" />
                            )}
                          </Button>
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
          La capacidad final del área usada por el motor = MIN(capacidad, límite físico) ×
          factor de excepción del día. El colchón de urgentes se descuenta del ATP y solo lo
          consumen los pedidos urgentes.
        </p>
      </div>

      {/* Excepciones de calendario */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarOff className="size-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-slate-800">
            Excepciones (paros, feriados, mantenimiento, ausencias)
          </h2>
        </div>
        {esAdmin && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Área</label>
              <Select value={excArea} onValueChange={setExcArea}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Todas las áreas</SelectItem>
                  {AREAS_MOTOR.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Fecha</label>
              <Input
                type="date"
                min={getTodayISO()}
                value={excFecha}
                onChange={(e) => setExcFecha(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Factor de capacidad</label>
              <Select value={excFactor} onValueChange={setExcFactor}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 — paro total</SelectItem>
                  <SelectItem value="0.25">0.25 — cuarto de capacidad</SelectItem>
                  <SelectItem value="0.5">0.5 — media capacidad</SelectItem>
                  <SelectItem value="0.75">0.75 — tres cuartos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              <label className="text-xs text-slate-500">Motivo</label>
              <Input
                value={excMotivo}
                onChange={(e) => setExcMotivo(e.target.value)}
                placeholder="Feriado, mantenimiento…"
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={() => void agregarExcepcion()} disabled={excGuardando}>
              {excGuardando ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1 size-3.5" />
              )}
              Agregar
            </Button>
          </div>
        )}
        {datos.excepciones.length === 0 ? (
          <p className="text-xs text-slate-400">Sin excepciones futuras registradas.</p>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Factor</TableHead>
                  <TableHead>Motivo</TableHead>
                  {esAdmin && <TableHead className="text-right">Quitar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.excepciones.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.fecha}</TableCell>
                    <TableCell>{e.area === "*" ? "Todas" : labelDe(e.area)}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-white",
                          e.factor === 0
                            ? "bg-rose-600"
                            : e.factor < 1
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                      >
                        {e.factor === 0 ? "Paro" : `${Math.round(e.factor * 100)}%`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{e.motivo || "—"}</TableCell>
                    {esAdmin && (
                      <TableCell className="text-right">
                        <button
                          onClick={async () => {
                            const r = await eliminarExcepcion(e.id)
                            if (r.success) await refresh()
                            else toast.error("No se pudo quitar", { description: r.error })
                          }}
                          className="text-slate-400 hover:text-rose-500"
                          title="Quitar excepción"
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
        )}
      </div>

      {/* Matriz de tiempos (referencia) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Table2 className="size-4 text-icon-green" />
          <h2 className="text-sm font-semibold text-slate-800">
            Matriz de tiempos por tipo de producción (días hábiles por etapa)
          </h2>
        </div>
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead className="text-right">Diseño</TableHead>
                  <TableHead className="text-right">Corte</TableHead>
                  <TableHead className="text-right">Aprob.</TableHead>
                  <TableHead className="text-right">Impresión</TableHead>
                  <TableHead className="text-right">Sublim.</TableHead>
                  <TableHead className="text-right">Costura</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.matriz.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap font-medium" title={m.concepto ?? undefined}>
                      {m.tipo_codigo}. {m.tipo_nombre}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.rango === "menor_24" ? "< 24 pcs" : "≥ 24 pcs"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_diseno}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_corte}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_aprobacion}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_impresion}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_sublimacion}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.dias_costura}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {m.total_dias}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Capacidad por máquina (referencia) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Scissors className="size-4 text-icon-purple" />
          <h2 className="text-sm font-semibold text-slate-800">
            Capacidad de costura por tipo de construcción
          </h2>
        </div>
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Máquina</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">pcs/día</TableHead>
                <TableHead className="text-right">pcs/semana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.maquinas.map((m) => (
                <TableRow key={m.id} className={!m.categoria ? "bg-slate-50 font-medium" : undefined}>
                  <TableCell>{m.maquina}</TableCell>
                  <TableCell>{m.categoria ?? "TOTAL"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(m.pcs_dia).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(m.pcs_semana).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-slate-500">
          Meta total general: 365 pcs/día · 1,825 pcs/semana (Plana 65/día + Sorgete 300/día).
        </p>
      </div>
    </div>
  )
}
