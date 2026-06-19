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

interface PrintReceiveModalProps {
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

/**
 * Modal de RECIBIR - Impresion.
 *
 * Historicamente este modal capturaba todos los parametros de produccion
 * (codigo de patron, impresora, perfil, papel, soporte, cantidad, inches,
 * yardas). Esos campos se movieron al modal de TERMINAR porque el
 * impresor recien los conoce al momento de despachar la orden. Aqui solo
 * se registra que la orden llego al area, el motivo de demora (si aplica)
 * y un comentario libre. La fecha de ingreso se setea automaticamente.
 */
export function PrintReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: PrintReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  const [formData, setFormData] = useState({
    imotivo_demora_recibido_i: orden.imotivo_demora_recibido_i || "",
    icomentario_impresion: orden.icomentario_impresion || "",
  })

  // Reset form when modal reopens
  useEffect(() => {
    if (open) {
      setFormData({
        imotivo_demora_recibido_i: orden.imotivo_demora_recibido_i || "",
        icomentario_impresion: orden.icomentario_impresion || "",
      })
    }
  }, [open, orden])

  useEffect(() => {
    async function fetchLists() {
      if (!supabase || !open) return
      setLoadingLists(true)

      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")

      if (!error && data) {
        setMotivosDemora(mapToList(data))
      }

      setLoadingLists(false)
    }

    fetchLists()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Register today's date automatically as ifecha_de_ingreso_imp
    const today = new Date().toISOString().split("T")[0]

    const dataToSubmit: Partial<Orden> = {
      imotivo_demora_recibido_i:
        formData.imotivo_demora_recibido_i || undefined,
      icomentario_impresion: formData.icomentario_impresion || undefined,
      ifecha_de_ingreso_imp: today,
    }

    await onReceive(dataToSubmit)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-icon-cyan" />
            Recibir en Impresion - {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Registre la recepcion de la orden en el area de Impresion. La fecha
            de recepcion se registrara automaticamente. Los parametros de
            produccion (codigo de patron, impresora, perfil, papel, cantidad,
            etc.) se capturan al momento de terminar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="imotivo_demora_recibido_i" className="text-sm">
              Motivo de Demora (Recibido)
            </Label>
            <Select
              value={formData.imotivo_demora_recibido_i}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  imotivo_demora_recibido_i: value,
                }))
              }
            >
              <SelectTrigger id="imotivo_demora_recibido_i" className="w-full">
                <SelectValue
                  placeholder={
                    loadingLists
                      ? "Cargando motivos..."
                      : "Seleccione motivo de demora (si aplica)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingLists && (
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
            <Label htmlFor="icomentario_impresion" className="text-sm">
              Comentario de Recepcion
            </Label>
            <Textarea
              id="icomentario_impresion"
              placeholder="Ingrese comentarios sobre la recepcion en impresion..."
              rows={3}
              value={formData.icomentario_impresion}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  icomentario_impresion: e.target.value,
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
