"use client"

/**
 * Cierre de corte de un marker completo.
 *
 * El cortador captura UNA cifra de yardas consumidas por todo el core y las
 * piezas cortadas de cada orden. Las yardas se prorratean a `cyardas` según
 * las piezas de cada pedido, de modo que los indicadores que suman por orden
 * sigan cuadrando con lo que realmente se registró.
 *
 * No se muestran las yardas teóricas del marker: son el dato contra el que
 * se compara este registro, y enseñarlas lo sesgaría.
 */

import { useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Info, Loader2, Ruler, Scissors } from "lucide-react"
import { toast } from "sonner"
import { useCut } from "@/lib/cut-context"
import { prorratearPorPiezas } from "@/lib/marker/cores"
import type { CoreEnCorte } from "./cut-cores-table"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  core: CoreEnCorte
  open: boolean
  onClose: () => void
}

const hoyISO = () => new Date().toISOString().split("T")[0]

/** Semana ISO, igual que el cierre de corte individual. */
function semanaISO(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number)
  const x = new Date(Date.UTC(y, m - 1, d))
  const dow = (x.getUTCDay() + 6) % 7
  x.setUTCDate(x.getUTCDate() - dow + 3)
  const pj = new Date(Date.UTC(x.getUTCFullYear(), 0, 4))
  const pjn = (pj.getUTCDay() + 6) % 7
  pj.setUTCDate(pj.getUTCDate() - pjn + 3)
  return 1 + Math.round((x.getTime() - pj.getTime()) / (7 * 86400000))
}

export function CutCoreFinishModal({ core, open, onClose }: Props) {
  const { refreshOrdenes } = useCut()
  const [yardas, setYardas] = useState("")
  const [piezas, setPiezas] = useState<Record<string, string>>(() =>
    Object.fromEntries(core.ordenes.map((o) => [o.pedido, String(o.pcs ?? "")]))
  )
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  const reparto = useMemo(() => {
    const yd = Number(yardas)
    if (!Number.isFinite(yd) || yd <= 0) return null
    return prorratearPorPiezas(
      yd,
      core.ordenes.map((o) => ({
        pedido: o.pedido,
        piezas: Number(piezas[o.pedido]) || 0,
      }))
    )
  }, [yardas, piezas, core.ordenes])

  const guardar = async () => {
    const yd = Number(yardas)
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas consumidas obligatorias", {
        description: "Ingresa el total de yardas usadas en el marker.",
      })
      return
    }
    for (const o of core.ordenes) {
      const p = Number(piezas[o.pedido])
      if (!Number.isFinite(p) || p <= 0) {
        toast.error(`Piezas cortadas de ${o.pedido}`, {
          description: "Todas las órdenes del marker necesitan piezas cortadas (> 0).",
        })
        return
      }
      if (o.pcs != null && p > o.pcs) {
        toast.error(`${o.pedido}: piezas fuera de rango`, {
          description: `No se puede cortar más de lo pedido (${o.pcs}).`,
        })
        return
      }
    }

    setGuardando(true)
    const fecha = hoyISO()
    const semana = semanaISO(fecha)
    const rep = reparto!

    try {
      for (const o of core.ordenes) {
        const { error } = await supabase
          .schema("telas")
          .from("cabecera")
          .update({
            cfecha_de_corte: fecha,
            csemana_de_corte: semana,
            cpiezas_cortadas: Number(piezas[o.pedido]),
            cyardas: rep.get(o.pedido) ?? null,
            ccomentario_corte: comentario.trim() || undefined,
          })
          .eq("pedido", o.pedido)
        if (error) throw new Error(error.message)
      }

      const { error: coreError } = await supabase
        .schema("telas")
        .from("marker_cores")
        .update({ estado: "Cortado", fecha_corte: fecha, yardas_reales: yd })
        .eq("id", core.core.id)
      if (coreError) throw new Error(coreError.message)

      await refreshOrdenes()
      toast.success(`Marker ${core.core.nombre} cortado`, {
        description: `${core.ordenes.length} órdenes cerradas.`,
      })
      onClose()
    } catch (e) {
      toast.error("No se pudo cerrar el marker", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-4 text-icon-magenta" />
            Terminar corte del marker
          </DialogTitle>
          <DialogDescription>
            {core.core.nombre} · {core.core.tela_principal} ·{" "}
            {core.ordenes.length} órdenes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-yd" className="text-sm">
              Yardas consumidas por el marker{" "}
              <span className="text-rose-600">*</span>
            </Label>
            <div className="relative">
              <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="cc-yd"
                type="number"
                min={0}
                step="0.01"
                value={yardas}
                onChange={(e) => setYardas(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">
              Piezas cortadas por orden <span className="text-rose-600">*</span>
            </Label>
            <div className="max-h-56 space-y-1.5 overflow-auto rounded-lg border border-slate-200 p-2">
              {core.ordenes.map((o) => (
                <div key={o.pedido} className="flex items-center gap-2 text-sm">
                  <span className="min-w-[5.5rem] font-medium text-slate-800">
                    {o.pedido}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    {o.cliente || "-"}
                  </span>
                  <span className="text-xs text-slate-400">
                    de {o.pcs ?? "?"}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={piezas[o.pedido] ?? ""}
                    onChange={(e) =>
                      setPiezas((p) => ({ ...p, [o.pedido]: e.target.value }))
                    }
                    className="h-8 w-24"
                  />
                  {reparto && (
                    <span className="w-20 text-right text-xs tabular-nums text-slate-500">
                      {reparto.get(o.pedido)} yd
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-cm" className="text-sm">
              Comentario (opcional)
            </Label>
            <Textarea
              id="cc-cm"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
            />
          </div>

          <p className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Las yardas se reparten entre las órdenes según sus piezas y la
            fecha de corte se registra igual para todas.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {guardando ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Scissors className="mr-1.5 size-3.5" />
            )}
            Cerrar marker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
