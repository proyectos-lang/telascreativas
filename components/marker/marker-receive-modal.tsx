"use client"

/**
 * Recepción de una orden en Marker Digital.
 *
 * Registra `mdfecha_de_recepcion` y, si aplica, el motivo de la demora.
 * Los motivos salen del catálogo compartido `telas.motivos_demora`, igual
 * que en el resto de las áreas.
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Inbox, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Orden } from "@/lib/types"
import { useMarker } from "@/lib/marker-context"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  orden: Orden
  open: boolean
  onClose: () => void
}

export function MarkerReceiveModal({ orden, open, onClose }: Props) {
  const { updateOrden } = useMarker()
  const [motivos, setMotivos] = useState<string[]>([])
  const [motivo, setMotivo] = useState("")
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const guardar = async () => {
    setGuardando(true)
    const r = await updateOrden(orden.pedido, {
      mdfecha_de_recepcion: new Date().toISOString().split("T")[0],
      mdmotivo_demora_recibido_md: motivo || undefined,
      mdcomentario_marker: comentario.trim() || undefined,
    })
    setGuardando(false)
    if (r.success) {
      toast.success("Orden recibida en Marker Digital")
      onClose()
    } else {
      toast.error("No se pudo recibir", { description: r.error })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-icon-cyan" />
            Recibir en Marker Digital
          </DialogTitle>
          <DialogDescription>
            Pedido {orden.pedido} — {orden.cliente || "sin cliente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label htmlFor="mk-com" className="text-sm">
              Comentario (opcional)
            </Label>
            <Textarea
              id="mk-com"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Inbox className="mr-1.5 size-3.5" />
            )}
            Recibir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
