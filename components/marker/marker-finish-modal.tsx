"use client"

/**
 * Entrega del trazo de una orden SUELTA (sin core).
 *
 * Registra las yardas teóricas y, al entregar, recalcula el objetivo de
 * Corte a 4 días hábiles contados DESDE ESTA ENTREGA: Corte no podía
 * empezar sin el trazo, así que su plazo arranca aquí. No se toca ninguna
 * otra fecha objetivo ni el compromiso con el cliente.
 *
 * Las órdenes agrupadas en un core no pasan por aquí: las entrega el core
 * completo desde la pestaña de agrupación.
 */

import { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, Info, Loader2, Ruler } from "lucide-react"
import { toast } from "sonner"
import { Orden } from "@/lib/types"
import { useMarker } from "@/lib/marker-context"
import {
  objetivoCorteDesdeMarker,
  DIAS_OBJETIVO_CORTE,
} from "@/lib/fechas-objetivo"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  orden: Orden
  open: boolean
  onClose: () => void
}

const hoyISO = () => new Date().toISOString().split("T")[0]

function fmt(v: string | undefined) {
  if (!v) return "-"
  const [y, m, d] = v.split("-")
  return `${d}/${m}/${y}`
}

export function MarkerFinishModal({ orden, open, onClose }: Props) {
  const { updateOrden } = useMarker()
  const [motivos, setMotivos] = useState<string[]>([])
  const [yardas, setYardas] = useState("")
  const [responsable, setResponsable] = useState("")
  const [motivo, setMotivo] = useState("")
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  const entrega = hoyISO()
  const nuevoObjetivoCorte = objetivoCorteDesdeMarker(entrega)

  useEffect(() => {
    if (!open) return
    setYardas("")
    setResponsable(orden.mdresponsable ?? "")
    setMotivo("")
    setComentario("")
    void (async () => {
      const { data } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")
      const lista = ((data ?? []) as Record<string, unknown>[])
        .map((r) => String(r.motivo ?? r.nombre ?? "").trim())
        .filter(Boolean)
      setMotivos([...new Set(lista)].sort())
    })()
  }, [open, orden.mdresponsable])

  const guardar = async () => {
    const yd = Number(yardas)
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas teóricas obligatorias", {
        description: "Se comparan luego contra el consumo real de Corte.",
      })
      return
    }
    setGuardando(true)
    const r = await updateOrden(orden.pedido, {
      mdentrega_marker: entrega,
      mdyardas_teoricas: yd,
      mdresponsable: responsable.trim() || undefined,
      mdmotivo_demora_terminado_md: motivo || undefined,
      mdcomentario_entrega_md: comentario.trim() || undefined,
      ...(nuevoObjetivoCorte ? { cfecha_objetivo_c: nuevoObjetivoCorte } : {}),
    })
    setGuardando(false)
    if (r.success) {
      toast.success("Trazo entregado", {
        description: `Corte tiene hasta el ${fmt(nuevoObjetivoCorte)}.`,
      })
      onClose()
    } else {
      toast.error("No se pudo entregar", { description: r.error })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Entregar trazo
          </DialogTitle>
          <DialogDescription>
            Pedido {orden.pedido} — {orden.cliente || "sin cliente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mk-yd" className="text-sm">
              Yardas teóricas <span className="text-rose-600">*</span>
            </Label>
            <div className="relative">
              <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="mk-yd"
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

          <div className="space-y-1.5">
            <Label htmlFor="mk-resp" className="text-sm">
              Responsable
            </Label>
            <Input
              id="mk-resp"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Quién hizo el trazo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Motivo de demora (opcional)</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Sin demora" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mk-cm" className="text-sm">
              Comentario de entrega (opcional)
            </Label>
            <Textarea
              id="mk-cm"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
            />
          </div>

          <p className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Al entregar, Corte recibe {DIAS_OBJETIVO_CORTE} días hábiles desde
            hoy: su fecha objetivo pasa a{" "}
            <strong>{fmt(nuevoObjetivoCorte)}</strong>. El resto de las fechas
            no cambia.
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
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            Entregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
