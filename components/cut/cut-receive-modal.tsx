"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, X, Inbox } from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface CutReceiveModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReceive: (data: Partial<Orden>) => Promise<void>
}

export function CutReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: CutReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)

  const [formData, setFormData] = useState({
    cmotivo_demora_recibido_c: orden.cmotivo_demora_recibido_c || "",
    ccomentario_corte: orden.ccomentario_corte || "",
  })

  // Reset form when the modal reopens with a (possibly) new orden
  useEffect(() => {
    if (open) {
      setFormData({
        cmotivo_demora_recibido_c: orden.cmotivo_demora_recibido_c || "",
        ccomentario_corte: orden.ccomentario_corte || "",
      })
    }
  }, [open, orden])

  // Fetch motivos_demora from Supabase
  useEffect(() => {
    async function fetchMotivos() {
      if (!supabase || !open) return

      setLoadingMotivos(true)

      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")

      console.log("[v0] Cut Receive - Motivos raw:", data)
      console.log("[v0] Cut Receive - Error motivos:", error)

      if (!error && data) {
        // Support multiple possible column names
        const motivos = data
          .map(
            (row: Record<string, unknown>) =>
              (row.nombre as string) ||
              (row.motivo as string) ||
              (row.descripcion as string) ||
              ""
          )
          .filter((m: string) => m.length > 0)

        console.log("[v0] Cut Receive - Motivos mapeados:", motivos)
        setMotivosDemora(motivos)
      }

      setLoadingMotivos(false)
    }

    fetchMotivos()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Register today's date automatically as cfecha_de_recepcion
    const today = new Date().toISOString().split("T")[0]

    const dataToSubmit: Partial<Orden> = {
      ...formData,
      cfecha_de_recepcion: today,
    }

    await onReceive(dataToSubmit)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-icon-cyan" />
            Recibir en Corte - {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Registre la recepcion de la orden en el area de Corte. La fecha de
            recepcion se registrara automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cmotivo_demora_recibido_c">
              Motivo de Demora (Recibido)
            </Label>
            <Select
              value={formData.cmotivo_demora_recibido_c}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  cmotivo_demora_recibido_c: value,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingMotivos
                      ? "Cargando motivos..."
                      : "Seleccione motivo de demora"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingMotivos && (
                  <SelectItem value="__none__" disabled>
                    No hay motivos disponibles
                  </SelectItem>
                )}
                {motivosDemora.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccomentario_corte">Comentarios de Corte</Label>
            <Textarea
              id="ccomentario_corte"
              placeholder="Ingrese comentarios sobre la recepcion en corte..."
              value={formData.ccomentario_corte}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ccomentario_corte: e.target.value,
                }))
              }
              rows={4}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="mr-1 size-4 text-icon-coral" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Save className="mr-1 size-4" />
              )}
              Guardar Recepcion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
