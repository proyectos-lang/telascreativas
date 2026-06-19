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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, X, Inbox } from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface SublimationReceiveModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReceive: (data: Partial<Orden>) => Promise<void>
}

// Helper to map records to first non-empty display string
function mapToList(
  data: Record<string, unknown>[],
  keys: string[] = ["nombre", "motivo", "descripcion"]
): string[] {
  return data
    .map((row) => {
      for (const key of keys) {
        const v = row[key]
        if (typeof v === "string" && v.trim().length > 0) return v
      }
      return ""
    })
    .filter((v) => v.length > 0)
}

export function SublimationReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: SublimationReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)

  const [formData, setFormData] = useState({
    smotivo_demora_recibido_s: orden.smotivo_demora_recibido_s || "",
    scomentario_sublimacion: orden.scomentario_sublimacion || "",
  })

  // Reset form when modal reopens
  useEffect(() => {
    if (open) {
      setFormData({
        smotivo_demora_recibido_s: orden.smotivo_demora_recibido_s || "",
        scomentario_sublimacion: orden.scomentario_sublimacion || "",
      })
    }
  }, [open, orden])

  // Fetch motivos_demora when modal opens
  useEffect(() => {
    async function fetchMotivos() {
      if (!supabase || !open) return
      setLoadingMotivos(true)

      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")

      console.log("[v0] Sublimation Receive - Motivos raw:", data)
      console.log("[v0] Sublimation Receive - Error motivos:", error)

      if (!error && data) {
        const motivos = mapToList(data)
        console.log("[v0] Sublimation Receive - Motivos mapeados:", motivos)
        setMotivosDemora(motivos)
      }

      setLoadingMotivos(false)
    }

    fetchMotivos()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Register today's date automatically as sfecha_de_ingreso_sub
    const today = new Date().toISOString().split("T")[0]

    const dataToSubmit: Partial<Orden> = {
      smotivo_demora_recibido_s:
        formData.smotivo_demora_recibido_s || undefined,
      scomentario_sublimacion: formData.scomentario_sublimacion || undefined,
      sfecha_de_ingreso_sub: today,
    }

    await onReceive(dataToSubmit)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-icon-coral" />
            Recibir en Sublimacion - {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Registre la recepcion de la orden en el area de Sublimacion. La
            fecha de recepcion se registrara automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="smotivo_demora_recibido_s" className="text-sm">
              Motivo de Demora (Recibido)
            </Label>
            <Select
              value={formData.smotivo_demora_recibido_s}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  smotivo_demora_recibido_s: value,
                }))
              }
            >
              <SelectTrigger id="smotivo_demora_recibido_s" className="w-full">
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

          {/* Comentario */}
          <div className="space-y-2">
            <Label htmlFor="scomentario_sublimacion" className="text-sm">
              Comentario de Sublimacion
            </Label>
            <Textarea
              id="scomentario_sublimacion"
              placeholder="Ingrese comentarios sobre la recepcion en sublimacion..."
              rows={4}
              value={formData.scomentario_sublimacion}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scomentario_sublimacion: e.target.value,
                }))
              }
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
