"use client"

import { useEffect, useState } from "react"
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
import { Loader2, RotateCcw, X } from "lucide-react"

interface ReversionModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  /**
   * Callback que dispara el UPDATE a telas.cabecera con:
   *  - estado_aprobado_rechazado: "Aprobado"
   *  - motivo_reversion: motivo
   *  - fechas objetivo recalculadas desde hoy
   * El componente padre (OrderDetail) resuelve la logica concreta.
   */
  onConfirm: (motivo: string) => Promise<void>
}

/**
 * Modal para revertir una orden previamente "Rechazada" al estado "Aprobado".
 * Exige un `motivo_reversion` no vacio.
 *
 * Visual: acento ambar para comunicar que es una accion de reversion
 * (ni aprobacion limpia, ni rechazo).
 */
export function ReversionModal({
  orden,
  open,
  onClose,
  onConfirm,
}: ReversionModalProps) {
  const [motivo, setMotivo] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset del textarea al reabrir el modal, para no arrastrar texto
  // de una reversion previa.
  useEffect(() => {
    if (open) setMotivo("")
  }, [open])

  const trimmed = motivo.trim()
  const canSubmit = trimmed.length > 0 && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-amber-600" />
              Volver a Aprobar Orden
            </DialogTitle>
            <DialogDescription>
              La orden{" "}
              <span className="font-semibold">{orden.pedido}</span> pasara de{" "}
              <span className="font-semibold text-destructive">Rechazada</span>{" "}
              a{" "}
              <span className="font-semibold text-emerald-600">Aprobada</span>.
              Las fechas objetivo se recalcularan desde hoy.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="motivo_reversion">
                Motivo de la reversion{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo_reversion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Explica por que se reactiva esta orden..."
                rows={4}
                autoFocus
                className="resize-none"
                disabled={isSubmitting}
                required
              />
              {trimmed.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  El motivo es obligatorio para poder reactivar la orden.
                </p>
              )}
            </div>
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
              disabled={!canSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 size-4" />
              )}
              Confirmar Reversion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
