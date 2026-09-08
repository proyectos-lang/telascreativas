"use client"

/**
 * Markers creados: consulta y edición de su composición.
 *
 * Un marker se puede modificar mientras Corte no lo haya RECIBIDO. Después
 * no: sus órdenes ya estarían en la mesa y quitar una cambiaría por detrás
 * lo que el cortador tiene delante.
 *
 * Al editar se piden las yardas teóricas de nuevo, porque el trazo cambió
 * y el total anterior ya no corresponde.
 */

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Pencil,
  Ruler,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useMarker, type MarkerCore } from "@/lib/marker-context"
import {
  sugerirCores,
  telasPorPedido,
  type OrdenEnCore,
} from "@/lib/marker/cores"

function fmt(v: string | null | undefined): string {
  if (!v) return "—"
  const [y, m, d] = String(v).slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

const COLOR_ESTADO: Record<MarkerCore["estado"], string> = {
  Abierto: "border-amber-300 bg-amber-50 text-amber-800",
  Entregado: "border-emerald-300 bg-emerald-50 text-emerald-800",
  "Recibido en Corte": "border-sky-300 bg-sky-50 text-sky-800",
  Cortado: "border-slate-300 bg-slate-100 text-slate-700",
}

export function MarkerListaTab() {
  const { ordenes, lineas, cores, isLoading, editarCore } = useMarker()
  const [abierto, setAbierto] = useState<Record<number, boolean>>({})
  const [filtro, setFiltro] = useState("")

  // Edición
  const [editando, setEditando] = useState<MarkerCore | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [yardas, setYardas] = useState("")
  const [guardando, setGuardando] = useState(false)

  /** Todas las órdenes del área con su tela resuelta. */
  const todas = useMemo<OrdenEnCore[]>(() => {
    const telas = telasPorPedido(lineas)
    const r = sugerirCores(
      ordenes.map((o) => ({
        pedido: o.pedido,
        cliente: o.cliente ?? null,
        fecha_de_entrega: o.fecha_de_entrega ?? null,
        pcs: typeof o.pcs === "number" ? o.pcs : null,
        es_urgente: o.es_urgente ?? null,
      })),
      telas,
      { topePcs: Number.MAX_SAFE_INTEGER }
    )
    return [...r.cores.flatMap((c) => c.ordenes), ...r.sueltas]
  }, [ordenes, lineas])

  const porPedido = useMemo(() => {
    const m = new Map<string, OrdenEnCore>()
    for (const o of todas) m.set(o.pedido, o)
    return m
  }, [todas])

  /** Órdenes que hoy pertenecen a cada marker. */
  const ordenesDe = (coreId: number) =>
    ordenes.filter((o) => o.mdcore_id === coreId)

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return cores
    return cores.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.tela_principal.toLowerCase().includes(q) ||
        ordenesDe(c.id).some(
          (o) =>
            o.pedido.toLowerCase().includes(q) ||
            (o.cliente ?? "").toLowerCase().includes(q)
        )
    )
  }, [cores, filtro, ordenes])

  const editable = (c: MarkerCore) =>
    c.estado === "Abierto" || c.estado === "Entregado"

  const abrirEdicion = (c: MarkerCore) => {
    setEditando(c)
    setSeleccion(new Set(ordenesDe(c.id).map((o) => o.pedido)))
    setYardas(String(c.yardas_teoricas ?? ""))
  }

  /** Candidatas: las del marker más las que están libres en la cola. */
  const candidatas = useMemo(() => {
    if (!editando) return []
    const delCore = new Set(ordenesDe(editando.id).map((o) => o.pedido))
    return todas.filter((o) => {
      if (delCore.has(o.pedido)) return true
      const orden = ordenes.find((x) => x.pedido === o.pedido)
      return orden ? orden.mdcore_id == null && !orden.mdentrega_marker : false
    })
  }, [editando, todas, ordenes])

  const guardar = async () => {
    if (!editando) return
    const elegidas = candidatas.filter((o) => seleccion.has(o.pedido))
    const yd = Number(yardas)
    if (elegidas.length === 0) {
      toast.error("El marker debe conservar al menos una orden")
      return
    }
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas teóricas obligatorias", {
        description: "El trazo cambió: hay que reingresar el total.",
      })
      return
    }
    setGuardando(true)
    const r = await editarCore({
      coreId: editando.id,
      ordenes: elegidas,
      yardasTeoricas: yd,
    })
    setGuardando(false)
    if (r.success) {
      toast.success(`Marker ${editando.nombre} actualizado`, {
        description: `${elegidas.length} órdenes.`,
      })
      setEditando(null)
    } else {
      toast.error("No se pudo actualizar", { description: r.error })
    }
  }

  if (isLoading)
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-24 w-full" />
      </Card>
    )

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <Boxes className="size-4 text-icon-cyan" />
        <h3 className="text-sm font-semibold text-slate-800">
          Markers creados
        </h3>
        <Badge variant="outline" className="text-[11px]">
          {cores.length}
        </Badge>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Marker, tela, pedido o cliente…"
            className="h-8 w-72 pl-8 text-xs"
          />
        </div>
      </Card>

      {visibles.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          {cores.length === 0
            ? "Aún no se ha creado ningún marker."
            : "Ningún marker coincide con la búsqueda."}
        </Card>
      ) : (
        visibles.map((c) => {
          const suyas = ordenesDe(c.id)
          const exp = abierto[c.id] ?? false
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setAbierto((p) => ({ ...p, [c.id]: !exp }))}
                  className="flex items-center gap-2 text-left"
                >
                  {exp ? (
                    <ChevronDown className="size-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="size-4 text-slate-400" />
                  )}
                  <Boxes className="size-4 text-icon-cyan" />
                  <span className="font-semibold text-slate-800">
                    {c.nombre}
                  </span>
                </button>
                <Badge variant="outline" className={cn("text-[11px]", COLOR_ESTADO[c.estado])}>
                  {c.estado}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  {c.tela_principal}
                </Badge>
                <Badge variant="outline" className="text-[11px] tabular-nums">
                  {suyas.length} órdenes · {c.total_pcs ?? 0} pcs
                </Badge>
                <span className="text-xs text-slate-500">
                  {c.yardas_teoricas ?? 0} yd · trazo{" "}
                  {fmt(c.fecha_entrega_marker)}
                </span>

                {editable(c) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirEdicion(c)}
                    className="ml-auto h-8"
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Editar
                  </Button>
                ) : (
                  <span
                    className="ml-auto flex items-center gap-1 text-xs text-slate-500"
                    title="Corte ya lo recibió: modificarlo cambiaría lo que el cortador tiene en la mesa"
                  >
                    <Lock className="size-3.5" />
                    En Corte
                  </span>
                )}
              </div>

              {exp && (
                <div className="divide-y divide-slate-100">
                  {suyas.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      Este marker no tiene órdenes.
                    </p>
                  ) : (
                    suyas.map((o) => (
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
                        <span className="w-16 text-right tabular-nums text-slate-700">
                          {o.pcs ?? "—"} pcs
                        </span>
                        <span className="w-20 text-right text-xs tabular-nums text-slate-500">
                          {o.mdyardas_teoricas ?? "—"} yd
                        </span>
                        <span className="w-24 text-right text-xs tabular-nums text-slate-500">
                          {fmt(o.fecha_de_entrega)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          )
        })
      )}

      {/* Edición de la composición */}
      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-icon-cyan" />
              Editar {editando?.nombre}
            </DialogTitle>
            <DialogDescription>
              Marca las órdenes que quedan en el marker. Las que quites
              vuelven a la cola de Marker Digital.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {editando?.estado === "Entregado" && (
              <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Este marker ya se entregó a Corte. Las órdenes que quites
                pierden su trazo y vuelven a la cola; las que agregues heredan
                la fecha de entrega del marker.
              </p>
            )}

            <div className="max-h-72 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
              {candidatas.map((o) => {
                const dentro = seleccion.has(o.pedido)
                const esNueva = !ordenesDe(editando?.id ?? -1).some(
                  (x) => x.pedido === o.pedido
                )
                return (
                  <label
                    key={o.pedido}
                    className={cn(
                      "flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50",
                      !dentro && "opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={dentro}
                      onCheckedChange={() =>
                        setSeleccion((prev) => {
                          const n = new Set(prev)
                          if (n.has(o.pedido)) n.delete(o.pedido)
                          else n.add(o.pedido)
                          return n
                        })
                      }
                    />
                    <span className="min-w-[5.5rem] font-medium text-slate-800">
                      {o.pedido}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {o.cliente ?? "—"}
                    </span>
                    {esNueva && (
                      <Badge
                        variant="outline"
                        className="border-indigo-300 bg-indigo-50 text-[10px] text-indigo-800"
                      >
                        de la cola
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {o.telaPrincipal || "sin tela"}
                    </Badge>
                    <span className="w-14 text-right tabular-nums text-slate-700">
                      {o.piezas} pcs
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ed-yardas" className="text-sm">
                  Yardas teóricas <span className="text-rose-600">*</span>
                </Label>
                <div className="relative">
                  <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="ed-yardas"
                    type="number"
                    min={0}
                    step="0.01"
                    value={yardas}
                    onChange={(e) => setYardas(e.target.value)}
                    className="w-40 pl-8"
                  />
                </div>
              </div>
              <p className="flex-1 text-[11px] text-muted-foreground">
                El trazo cambia al modificar las órdenes: revisa el total y
                ajústalo si hace falta.
              </p>
              <Badge variant="outline" className="tabular-nums">
                {candidatas
                  .filter((o) => seleccion.has(o.pedido))
                  .reduce((s, o) => s + o.piezas, 0)}{" "}
                pcs
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditando(null)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {guardando ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-3.5" />
              )}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
