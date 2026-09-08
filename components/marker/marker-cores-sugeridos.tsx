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
  Sparkles,
  Wand2,
  X,
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
  armarCoreManual,
  sugerirCores,
  telasPorPedido,
  type CoreSugerido,
  type OrdenEnCore,
} from "@/lib/marker/cores"
import { MarkerReferencias } from "./marker-referencias"
import { registrarPiezasMarker } from "@/lib/marker/piezas-extra"

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
  const {
    ordenes,
    lineas,
    cores,
    topePcs,
    isLoading,
    crearCore,
    entregarCore,
    guardarTopePcs,
  } = useMarker()
  const { usuarioActual } = useAuth()

  const [tope, setTope] = useState<string>("")
  const [abierto, setAbierto] = useState<Record<string, boolean>>({})
  /** Órdenes desmarcadas por el usuario, por core. */
  const [excluidas, setExcluidas] = useState<Record<string, Set<string>>>({})
  const [dialogo, setDialogo] = useState<CoreSugerido | null>(null)
  /** Modo manual: el usuario arma el marker eligiendo orden por orden. */
  const [manual, setManual] = useState(false)
  const [enManual, setEnManual] = useState<Set<string>>(new Set())
  const [dialogoManual, setDialogoManual] = useState(false)
  /** Pedidos con sus referencias (líneas de detalle) desplegadas. */
  const [refsAbiertas, setRefsAbiertas] = useState<Set<string>>(new Set())
  const [entregando, setEntregando] = useState<number | null>(null)
  const [nombre, setNombre] = useState("")
  const [yardas, setYardas] = useState("")
  /** Piezas de mas que deja el trazo. Van al inventario de piezas extra. */
  const [piezasExtra, setPiezasExtra] = useState("")
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

  /** Markers ya armados que aún no han entregado el trazo. */
  const coresAbiertos = useMemo(
    () => cores.filter((c) => c.estado === "Abierto"),
    [cores]
  )

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

  /** Todas las órdenes en cola, con su tela resuelta (para el modo manual). */
  const todasConTela = useMemo<OrdenEnCore[]>(
    () => [...sugerencia.cores.flatMap((c) => c.ordenes), ...sugerencia.sueltas],
    [sugerencia]
  )

  /** Referencias (líneas de detalle) por pedido. */
  const refsPorPedido = useMemo(() => {
    const m = new Map<string, typeof lineas>()
    for (const l of lineas) {
      const arr = m.get(l.pedido) ?? []
      arr.push(l)
      m.set(l.pedido, arr)
    }
    return m
  }, [lineas])

  const alternarRefs = (pedido: string) =>
    setRefsAbiertas((prev) => {
      const n = new Set(prev)
      if (n.has(pedido)) n.delete(pedido)
      else n.add(pedido)
      return n
    })

  const seleccionManual = useMemo(
    () => todasConTela.filter((o) => enManual.has(o.pedido)),
    [todasConTela, enManual]
  )
  const resumenManual = useMemo(
    () => armarCoreManual(seleccionManual, topeEfectivo),
    [seleccionManual, topeEfectivo]
  )

  const alternarManual = (pedido: string) =>
    setEnManual((prev) => {
      const n = new Set(prev)
      if (n.has(pedido)) n.delete(pedido)
      else n.add(pedido)
      return n
    })

  const confirmarManual = async () => {
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
      telaPrincipal: resumenManual.telaPrincipal || "MIXTO",
      yardasTeoricas: yd,
      ordenes: seleccionManual,
      creadoPor: usuarioActual?.nombre ?? null,
      notas:
        resumenManual.telas.length > 1
          ? `Marker manual con varias telas: ${resumenManual.telas.join(", ")}`
          : "Marker armado manualmente",
    })
    setGuardando(false)
    if (r.success) {
      await guardarPiezasExtra(r.id ?? null, resumenManual.telaPrincipal)
      toast.success(`Marker "${nombre.trim()}" creado`, {
        description: `${seleccionManual.length} órdenes agrupadas a mano.`,
      })
      setDialogoManual(false)
      setEnManual(new Set())
      setManual(false)
    } else {
      toast.error("No se pudo crear el marker", { description: r.error })
    }
  }

  /**
   * Registra las piezas extra del trazo, si el marker las declaró. Un
   * fallo aquí NO tumba la creación del marker: el core ya existe y sería
   * peor perderlo por un dato accesorio.
   */
  const guardarPiezasExtra = async (coreId: number | null, tela: string) => {
    const n = Number(piezasExtra)
    if (!Number.isFinite(n) || n <= 0) return
    const r = await registrarPiezasMarker({
      coreId,
      cantidad: n,
      tela: tela || null,
      registradoPor: usuarioActual?.nombre ?? null,
    })
    if (r.success)
      toast.success(`${n} piezas extra registradas`, {
        description: "Quedan en el inventario a la espera del detalle de Corte.",
      })
    else
      toast.error("El marker se creó, pero no se registraron las piezas extra", {
        description: r.error,
      })
  }

  const abrirDialogo = (core: CoreSugerido) => {
    if (seleccionadas(core).length === 0) {
      toast.error("Selecciona al menos una orden")
      return
    }
    setDialogo(core)
    setNombre("")
    setYardas("")
    setPiezasExtra("")
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
      await guardarPiezasExtra(r.id ?? null, dialogo.telaPrincipal)
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
          <Button
            size="sm"
            variant={manual ? "default" : "outline"}
            onClick={() => {
              setManual((v) => !v)
              setEnManual(new Set())
            }}
            className={cn("h-9", manual && "bg-indigo-600 hover:bg-indigo-700")}
          >
            <Wand2 className="mr-1.5 size-3.5" />
            {manual ? "Salir del modo manual" : "Armar marker manual"}
          </Button>
        </div>
      </Card>

      {/* MARKERS ARMADOS pendientes de entregar.
          Crear el core y entregarlo son dos pasos: al crearlo se agrupan
          las ordenes y se reparten las yardas, pero el trazo todavia no
          esta impreso. Sin este panel no habia forma de dar el segundo
          paso, y los markers se quedaban en 'Abierto' para siempre. */}
      {coresAbiertos.length > 0 && (
        <Card className="overflow-hidden border-amber-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-3">
            <Boxes className="size-4 text-amber-700" />
            <span className="font-semibold text-amber-900">
              Markers armados, pendientes de entregar
            </span>
            <Badge variant="outline" className="border-amber-300 text-[11px]">
              {coresAbiertos.length}
            </Badge>
            <span className="text-xs text-amber-800/80">
              Al entregar, las órdenes pasan a Corte con la misma fecha.
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {coresAbiertos.map((c) => {
              const suyas = ordenes.filter((o) => o.mdcore_id === c.id)
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <Boxes className="size-4 text-icon-cyan" />
                  <span className="font-semibold text-slate-800">{c.nombre}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {c.tela_principal}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] tabular-nums">
                    {suyas.length} órdenes · {c.total_pcs ?? 0} pcs
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {c.yardas_teoricas ?? 0} yd teóricas
                  </span>
                  <Button
                    size="sm"
                    disabled={entregando === c.id}
                    onClick={async () => {
                      setEntregando(c.id)
                      const r = await entregarCore(c.id)
                      setEntregando(null)
                      if (r.success)
                        toast.success(`Marker ${c.nombre} entregado`, {
                          description: `${suyas.length} órdenes liberadas a Corte.`,
                        })
                      else
                        toast.error("No se pudo entregar", {
                          description: r.error,
                        })
                    }}
                    className="ml-auto h-8 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {entregando === c.id ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 size-3.5" />
                    )}
                    Entregar trazo
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* MODO MANUAL: el usuario arma el marker orden por orden. */}
      {manual && (
        <Card className="overflow-hidden border-indigo-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-3">
            <Wand2 className="size-4 text-indigo-600" />
            <span className="font-semibold text-indigo-900">Marker manual</span>
            <Badge variant="outline" className="border-indigo-300 text-[11px]">
              {seleccionManual.length} órdenes · {resumenManual.totalPcs} pcs
            </Badge>
            {resumenManual.telas.length > 0 && (
              <Badge variant="outline" className="text-[11px]">
                {resumenManual.telas.length === 1
                  ? resumenManual.telas[0]
                  : `${resumenManual.telas.length} telas`}
              </Badge>
            )}
            <span className="text-xs text-indigo-800/80">
              Entregas: <Ventana desde={resumenManual.entregaDesde} hasta={resumenManual.entregaHasta} />
            </span>
            <div className="ml-auto flex items-center gap-2">
              {seleccionManual.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEnManual(new Set())}
                  className="h-8 text-slate-500"
                >
                  <X className="mr-1 size-3.5" />
                  Limpiar
                </Button>
              )}
              <Button
                size="sm"
                disabled={seleccionManual.length === 0}
                onClick={() => {
                  setDialogoManual(true)
                  setNombre("")
                  setYardas("")
                  setPiezasExtra("")
                }}
                className="h-8 bg-indigo-600 hover:bg-indigo-700"
              >
                <Check className="mr-1.5 size-3.5" />
                Crear marker
              </Button>
            </div>
          </div>

          {/* Avisos: no bloquean, informan para que la decision sea consciente. */}
          {resumenManual.avisos.length > 0 && (
            <div className="space-y-1 border-b border-amber-100 bg-amber-50 px-4 py-2">
              {resumenManual.avisos.map((a) => (
                <p key={a} className="flex gap-1.5 text-[11px] text-amber-900">
                  <Info className="mt-0.5 size-3 shrink-0" />
                  {a}
                </p>
              ))}
            </div>
          )}

          <div className="max-h-[26rem] divide-y divide-slate-100 overflow-auto">
            {todasConTela.map((o) => {
              const dentro = enManual.has(o.pedido)
              const refs = refsPorPedido.get(o.pedido) ?? []
              const abiertas = refsAbiertas.has(`m-${o.pedido}`)
              return (
                <div key={o.pedido} className={cn(dentro && "bg-indigo-50/40")}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                    <Checkbox
                      checked={dentro}
                      onCheckedChange={() => alternarManual(o.pedido)}
                    />
                    <button
                      type="button"
                      onClick={() => alternarRefs(`m-${o.pedido}`)}
                      className="flex items-center gap-1 text-slate-400 hover:text-slate-700"
                      title="Ver referencias"
                    >
                      {abiertas ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </button>
                    <span className="min-w-[5.5rem] font-medium text-slate-800">
                      {o.pedido}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {o.cliente ?? "—"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {o.telaPrincipal || "sin tela"}
                    </Badge>
                    {o.es_urgente && (
                      <Badge className="bg-rose-500 text-[10px] text-white hover:bg-rose-600">
                        Urgente
                      </Badge>
                    )}
                    <span className="w-16 text-right tabular-nums text-slate-700">
                      {o.piezas} pcs
                    </span>
                    <span className="w-24 text-right text-xs tabular-nums text-slate-500">
                      {fmtFecha(o.fecha_de_entrega)}
                    </span>
                  </div>
                  {abiertas && (
                    <div className="border-t border-slate-100 bg-slate-50/60 pb-1">
                      <MarkerReferencias lineas={refs} compacto />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
                  const refs = refsPorPedido.get(o.pedido) ?? []
                  const refsOpen = refsAbiertas.has(`${core.id}-${o.pedido}`)
                  return (
                    <div key={o.pedido}>
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50",
                        fuera && "opacity-45"
                      )}
                    >
                      <Checkbox
                        checked={!fuera}
                        onCheckedChange={() => alternar(core.id, o.pedido)}
                      />
                      <button
                        type="button"
                        onClick={() => alternarRefs(`${core.id}-${o.pedido}`)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-700"
                        title="Ver referencias de la orden"
                      >
                        {refsOpen ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
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
                    </div>
                    {refsOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 pb-1">
                        <MarkerReferencias
                          lineas={refs}
                          telaPrincipal={core.telaPrincipal}
                          compacto
                        />
                      </div>
                    )}
                    </div>
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

      {/* Confirmación del marker MANUAL */}
      <Dialog open={dialogoManual} onOpenChange={(v) => !v && setDialogoManual(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-4 text-indigo-600" />
              Crear marker manual
            </DialogTitle>
            <DialogDescription>
              {seleccionManual.length} órdenes · {resumenManual.totalPcs} pcs ·{" "}
              {resumenManual.telas.length === 1
                ? resumenManual.telas[0]
                : `${resumenManual.telas.length} telas`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {resumenManual.avisos.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                {resumenManual.avisos.map((a) => (
                  <p key={a} className="flex gap-1.5 text-[11px] text-amber-900">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    {a}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="mkm-nombre" className="text-sm">
                Nombre del marker <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="mkm-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. MIXTO-URGENTES-37"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mkm-yardas" className="text-sm">
                Yardas teóricas del trazo <span className="text-rose-600">*</span>
              </Label>
              <div className="relative">
                <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mkm-yardas"
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

            <div className="space-y-1.5">
              <Label htmlFor="mkm-extra" className="text-sm">
                Piezas extra <span className="text-slate-400">(opcional)</span>
              </Label>
              <div className="relative">
                <Layers className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mkm-extra"
                  type="number"
                  min={0}
                  value={piezasExtra}
                  onChange={(e) => setPiezasExtra(e.target.value)}
                  className="pl-8"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Piezas de más que deja el trazo. Entran al inventario de
                piezas extra; Corte registrará luego su talla y referencia.
              </p>
            </div>

            <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
              {seleccionManual.map((o) => (
                <div
                  key={o.pedido}
                  className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1 text-xs last:border-0"
                >
                  <span className="min-w-[5rem] font-medium text-slate-800">
                    {o.pedido}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">
                    {o.cliente ?? "—"}
                  </span>
                  <Badge variant="outline" className="px-1 py-0 text-[9px]">
                    {o.telaPrincipal || "—"}
                  </Badge>
                  <span className="tabular-nums text-slate-600">{o.piezas}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogoManual(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarManual}
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

            <div className="space-y-1.5">
              <Label htmlFor="mk-extra" className="text-sm">
                Piezas extra <span className="text-slate-400">(opcional)</span>
              </Label>
              <div className="relative">
                <Layers className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mk-extra"
                  type="number"
                  min={0}
                  value={piezasExtra}
                  onChange={(e) => setPiezasExtra(e.target.value)}
                  className="pl-8"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Piezas de más que deja el trazo. Entran al inventario de
                piezas extra; Corte registrará luego su talla y referencia.
              </p>
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
