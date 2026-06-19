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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, X } from "lucide-react"

interface RejectModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  // onConfirm recibe el motivo ya validado (no vacio) y devuelve una promise
  onConfirm: (motivo: string) => Promise<void>
  /**
   * Cuando la orden ya estaba "Aprobada", el contexto del rechazo cambia:
   * se trata de una revocacion posterior, no de un rechazo antes de iniciar
   * produccion. El modal ajusta el texto explicativo segun este flag.
   */
  wasApproved?: boolean
}

/**
 * Modal de confirmacion para rechazar una orden en el modulo de Programacion.
 * Funciona para dos escenarios:
 *   - Orden Pendiente: rechazo inicial antes de entrar a produccion.
 *   - Orden Aprobada: revocacion posterior de una orden ya aprobada.
 *
 * Exige capturar un "Motivo del rechazo" obligatorio antes de ejecutar el UPDATE.
 * La escritura real a telas.cabecera la hace el caller (order-detail.tsx).
 */
export function RejectModal({
  orden,
  open,
  onClose,
  onConfirm,
  wasApproved = false,
}: RejectModalProps) {
  const [motivo, setMotivo] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Limpiamos el textarea cada vez que se abre el modal para un nuevo rechazo
  useEffect(() => {
    if (open) {
      setMotivo("")
    }
  }, [open])

  const trimmedMotivo = motivo.trim()
  const isValid = trimmedMotivo.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onConfirm(trimmedMotivo)
      // El caller se encarga de mostrar el toast y cerrar el modal
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-destructive/10 p-1.5">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              {wasApproved
                ? "¿Revocar aprobacion de la orden?"
                : "¿Confirmar Rechazo de Orden?"}
            </DialogTitle>
            <DialogDescription>
              {wasApproved ? (
                <>
                  La orden{" "}
                  <span className="font-semibold text-foreground">
                    {orden.pedido}
                  </span>{" "}
                  estaba <span className="font-semibold text-emerald-600">Aprobada</span>.
                  Al confirmar pasara a estado{" "}
                  <span className="font-semibold text-destructive">Rechazado</span>{" "}
                  y quedara en espera hasta que sea reactivada manualmente.
                </>
              ) : (
                <>
                  Esta accion marcara la orden{" "}
                  <span className="font-semibold text-foreground">
                    {orden.pedido}
                  </span>{" "}
                  como rechazada y no continuara en el flujo de produccion.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="motivo_rechazo" className="text-sm">
                Motivo del rechazo{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo_rechazo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Escribe el motivo por el cual se rechaza esta orden..."
                rows={4}
                disabled={isSubmitting}
                autoFocus
                required
                aria-required="true"
                aria-invalid={!isValid && motivo.length > 0}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                El motivo es obligatorio y quedara registrado en la orden para
                referencia del equipo.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="mr-1 size-4" />
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Rechazando...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-1 size-4" />
                  Confirmar Rechazo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
