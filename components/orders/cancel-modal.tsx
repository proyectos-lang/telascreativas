"use client"

import { useEffect, useState } from "react"
import { Orden } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Ban, Loader2, X } from "lucide-react"

interface CancelModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  /** Se invoca una vez que el usuario confirma; el caller escribe en BD. */
  onConfirm: () => Promise<void>
}

/**
 * Modal de confirmacion para cancelar una orden en el modulo de Programacion.
 * La cancelacion escribe "cancelado" en estado_aprobado_rechazado y hace que
 * la orden desaparezca de todos los modulos de produccion y entregas.
 * A diferencia del rechazo, no requiere capturar un motivo.
 */
export function CancelModal({ orden, open, onClose, onConfirm }: CancelModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) setIsSubmitting(false)
  }, [open])

  const handleConfirm = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isSubmitting) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-orange-100 p-1.5">
              <Ban className="size-5 text-orange-600" />
            </div>
            Cancelar orden {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Esta accion marcara la orden{" "}
            <span className="font-semibold text-foreground">{orden.pedido}</span>{" "}
            como <span className="font-semibold text-orange-600">Cancelada</span>.
            La orden dejara de aparecer en todos los modulos de produccion y entregas.
            Esta operacion se puede revertir manualmente desde el modulo de Programacion.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="mr-1 size-4" />
            Volver
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <Ban className="mr-1 size-4" />
                Confirmar Cancelacion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
