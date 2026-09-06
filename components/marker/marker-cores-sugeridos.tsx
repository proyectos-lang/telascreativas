"use client"

/**
 * Sugerencia de agrupación de cores.
 *
 * El sistema propone qué órdenes se pueden cortar juntas (misma tela, sin
 * pasar del tope de piezas) y el marker decide: puede marcar y desmarcar
 * libremente antes de confirmar. La fecha de entrega al cliente se muestra
 * SOLO como información para esa decisión.
 *
 * Al confirmar se pide el nombre del marker (manual) y las yardas teóricas
 * del trazo, que es el dato que luego se contrasta contra el consumo real
 * que registre Corte.
 */

import { useMemo, useState } from "react"
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Loader2,
  Ruler,
  Save,
  Scissors,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useMarker } from "@/lib/marker-context"
import {
  sugerirCores,
  telasPorPedido,
  type CoreSugerido,
  type OrdenEnCore,
} from "@/lib/marker/cores"

function fmtFecha(v: string | null | undefined): string {
  if (!v) return "—"
  const [y, m, d] = String(v).slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

/** Ventana de entregas del core, para leer de un vistazo su urgencia. */
function Ventana({ desde, hasta }: { desde: string | null; hasta: string | null }) {
  if (!desde) return <span className="text-slate-400">sin fecha</span>
  return (
    <span className="tabular-nums">
      {fmtFecha(desde)}
      {hasta && hasta !== desde ? ` — ${fmtFecha(hasta)}` : ""}
    </span>
  )
}

export function MarkerCoresSugeridos() {
  const { ordenes, lineas, topePcs, isLoading, crearCore, guardarTopePcs } =
    useMarker()
  const { usuarioActual } = useAuth()

  const [tope, setTope] = useState<string>("")
  const [abierto, setAbierto] = useState<Record<string, boolean>>({})
  /** Órdenes desmarcadas por el usuario, por core. */
  const [excluidas, setExcluidas] = useState<Record<string, Set<string>>>({})
  const [dialogo, setDialogo] = useState<CoreSugerido | null>(null)
  const [nombre, setNombre] = useState("")
  const [yardas, setYardas] = useState("")
  const [guardando, setGuardando] = useState(false)

  const topeEfectivo = topePcs

  // Solo las órdenes que aún no tienen trazo ni core.
  const enCola = useMemo(
    () => ordenes.filter((o) => !o.mdentrega_marker && !o.mdcore_id),
    [ordenes]
  )

  const sugerencia = useMemo(() => {
    const telas = telasPorPedido(lineas)
    return sugerirCores(
      enCola.map((o) => ({
        pedido: o.pedido,
        cliente: o.cliente ?? null,
        fecha_de_entrega: o.fecha_de_entrega ?? null,
        pcs: typeof o.pcs === "number" ? o.pcs : null,
        es_urgente: o.es_urgente ?? null,
      })),
      telas,
      { topePcs: topeEfectivo }
    )
  }, [enCola, lineas, topeEfectivo])

  const seleccionadas = (core: CoreSugerido): OrdenEnCore[] => {
    const fuera = excluidas[core.id] ?? new Set<string>()
    return core.ordenes.filter((o) => !fuera.has(o.pedido))
  }

  const alternar = (coreId: string, pedido: string) => {
    setExcluidas((prev) => {
      const fuera = new Set(prev[coreId] ?? [])
      if (fuera.has(pedido)) fuera.delete(pedido)
      else fuera.add(pedido)
      return { ...prev, [coreId]: fuera }
    })
  }

  const aplicarTope = async () => {
    const n = Number(tope)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Tope inválido", { description: "Debe ser un número mayor que cero." })
      return
    }
    const r = await guardarTopePcs(n)
    if (r.success) {
      setTope("")
      setExcluidas({})
      toast.success(`Tope actualizado a ${n} piezas`)
    } else {
      toast.error("No se pudo guardar el tope", { description: r.error })
    }
  }

  const abrirDialogo = (core: CoreSugerido) => {
    if (seleccionadas(core).length === 0) {
      toast.error("Selecciona al menos una orden")
      return
    }
    setDialogo(core)
    setNombre("")
    setYardas("")
  }

  const confirmar = async () => {
    if (!dialogo) return
    const sel = seleccionadas(dialogo)
    const yd = Number(yardas)
    if (!nombre.trim()) {
      toast.error("El nombre del marker es obligatorio")
      return
    }
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas teóricas obligatorias", {
        description: "Se comparan luego contra el consumo real de Corte.",
      })
      return
    }
    setGuardando(true)
    const r = await crearCore({
      nombre: nombre.trim(),
      telaPrincipal: dialogo.telaPrincipal,
      yardasTeoricas: yd,
      ordenes: sel,
      creadoPor: usuarioActual?.nombre ?? null,
    })
    setGuardando(false)
    if (r.success) {
      toast.success(`Marker "${nombre.trim()}" creado`, {
        description: `${sel.length} órdenes agrupadas.`,
      })
      setDialogo(null)
    } else {
      toast.error("No se pudo crear el marker", { description: r.error })
    }
  }

  if (isLoading)
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )

  const totalEnCores = sugerencia.cores.reduce((s, c) => s + c.ordenes.length, 0)

  return (
    <div className="space-y-4">
      {/* Parámetro de agrupación */}
      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Layers className="size-4 text-icon-cyan" />
            Agrupación de cores
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Las órdenes se agrupan por su tela mayoritaria y se ordenan por
            fecha de entrega; al llegar al tope se abre otro core. Puedes
            marcar y desmarcar antes de confirmar.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="tope" className="text-xs">
              Tope por core (pcs)
            </Label>
            <Input
              id="tope"
              type="number"
              min={1}
              value={tope}
              placeholder={String(topeEfectivo)}
              onChange={(e) => setTope(e.target.value)}
              className="h-9 w-32"
            />
          </div>
          <Button variant="outline" size="sm" onClick={aplicarTope} className="h-9">
            <Save className="mr-1.5 size-3.5" />
            Guardar
          </Button>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">En cola</p>
          <p className="text-2xl font-bold text-slate-800">{enCola.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Cores sugeridos
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {sugerencia.cores.length}
          </p>
          <p className="text-[10px] text-slate-400">{totalEnCores} órdenes</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Sin agrupar
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {sugerencia.sueltas.length}
          </p>
          <p className="text-[10px] text-slate-400">se procesan sueltas</p>
        </Card>
      </div>

      {sugerencia.cores.length === 0 && sugerencia.sueltas.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          No hay órdenes pendientes de trazo.
        </Card>
      )}

      {/* Cores sugeridos */}
      {sugerencia.cores.map((core) => {
        const sel = seleccionadas(core)
        const pcsSel = sel.reduce((s, o) => s + o.piezas, 0)
        const expandido = abierto[core.id] ?? true
        const excede = pcsSel > topeEfectivo
        return (
          <Card key={core.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  setAbierto((p) => ({ ...p, [core.id]: !expandido }))
                }
                className="flex items-center gap-2 text-left"
              >
                {expandido ? (
                  <ChevronDown className="size-4 text-slate-400" />
                ) : (
                  <ChevronRight className="size-4 text-slate-400" />
                )}
                <Boxes className="size-4 text-icon-cyan" />
                <span className="font-semibold text-slate-800">
                  {core.telaPrincipal}
                </span>
              </button>

              <Badge variant="outline" className="text-[11px]">
                {sel.length} de {core.ordenes.length} órdenes
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] tabular-nums",
                  excede && "border-rose-300 bg-rose-50 text-rose-700"
                )}
              >
                {pcsSel} / {topeEfectivo} pcs
              </Badge>
              {core.conMultiTela > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-[11px] text-amber-800"
                  title="Estas órdenes llevan piezas de otra tela: requieren un trazo aparte."
                >
                  {core.conMultiTela} multi-tela
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                Entregas: <Ventana desde={core.entregaDesde} hasta={core.entregaHasta} />
              </span>

              <Button
                size="sm"
                onClick={() => abrirDialogo(core)}
                disabled={sel.length === 0}
                className="ml-auto h-8 bg-indigo-600 hover:bg-indigo-700"
              >
                <Check className="mr-1.5 size-3.5" />
                Crear marker
              </Button>
            </div>

            {expandido && (
              <div className="divide-y divide-slate-100">
                {core.ordenes.map((o) => {
                  const fuera = (excluidas[core.id] ?? new Set()).has(o.pedido)
                  return (
                    <label
                      key={o.pedido}
                      className={cn(
                        "flex cursor-pointer flex-wrap items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50",
                        fuera && "opacity-45"
                      )}
                    >
                      <Checkbox
                        checked={!fuera}
                        onCheckedChange={() => alternar(core.id, o.pedido)}
                      />
                      <span className="min-w-[5.5rem] font-medium text-slate-800">
                        {o.pedido}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-600">
                        {o.cliente ?? "—"}
                      </span>
                      {o.es_urgente && (
                        <Badge className="bg-rose-500 text-[10px] text-white hover:bg-rose-600">
                          Urgente
                        </Badge>
                      )}
                      {o.telasSecundarias.length > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                          title="Piezas de otra tela: sacar un trazo aparte para estas."
                        >
                          + {o.telasSecundarias.join(", ")}
                        </Badge>
                      )}
                      <span className="w-16 text-right tabular-nums text-slate-700">
                        {o.piezas} pcs
                      </span>
                      <span
                        className="w-24 text-right text-xs tabular-nums text-slate-500"
                        title="Fecha de entrega al cliente (informativa)"
                      >
                        {fmtFecha(o.fecha_de_entrega)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}

      {/* Sueltas */}
      {sugerencia.sueltas.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <Scissors className="size-4 text-slate-400" />
            <span className="font-semibold text-slate-800">Sin agrupar</span>
            <Badge variant="outline" className="text-[11px]">
              {sugerencia.sueltas.length}
            </Badge>
            <span className="text-xs text-slate-500">
              No comparten tela con ninguna otra orden en cola.
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {sugerencia.sueltas.map((o) => (
              <div
                key={o.pedido}
                className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="min-w-[5.5rem] font-medium text-slate-800">
                  {o.pedido}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {o.cliente ?? "—"}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {o.telaPrincipal || "sin tela"}
                </Badge>
                <span className="w-16 text-right tabular-nums text-slate-700">
                  {o.piezas} pcs
                </span>
                <span className="w-24 text-right text-xs tabular-nums text-slate-500">
                  {fmtFecha(o.fecha_de_entrega)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmación */}
      <Dialog open={!!dialogo} onOpenChange={(v) => !v && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="size-4 text-icon-cyan" />
              Crear marker
            </DialogTitle>
            <DialogDescription>
              {dialogo && (
                <>
                  {seleccionadas(dialogo).length} órdenes de{" "}
                  <strong>{dialogo.telaPrincipal}</strong> ·{" "}
                  {seleccionadas(dialogo).reduce((s, o) => s + o.piezas, 0)} pcs
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mk-nombre" className="text-sm">
                Nombre del marker <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="mk-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. DRYFIT-SEM37-A"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Debe ser único: identifica el trazo en planta y en Corte.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mk-yardas" className="text-sm">
                Yardas teóricas del trazo <span className="text-rose-600">*</span>
              </Label>
              <div className="relative">
                <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mk-yardas"
                  type="number"
                  min={0}
                  step="0.01"
                  value={yardas}
                  onChange={(e) => setYardas(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            <p className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              Las yardas se reparten entre las órdenes según sus piezas para
              poder compararlas con el consumo real que registre Corte. El
              cortador no las ve.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {guardando ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-3.5" />
              )}
              Crear marker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
