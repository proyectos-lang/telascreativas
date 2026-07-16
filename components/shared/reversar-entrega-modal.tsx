"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RotateCcw, AlertTriangle } from "lucide-react"

interface ReversarEntregaModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  modulo: string
}

export function ReversarEntregaModal({
  open,
  onClose,
  onConfirm,
  modulo,
}: ReversarEntregaModalProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-rose-500" />
            Reversar entrega — {modulo}
          </DialogTitle>
          <DialogDescription>
            Se borrarán todos los registros de entrega de este proceso.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              Esta acción eliminará la fecha de entrega, observaciones y demás
              datos registrados en <strong>{modulo}</strong>. El pedido
              volverá al estado <strong>Recibido</strong> en este proceso.
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="gap-2 bg-rose-600 hover:bg-rose-700"
          >
            <RotateCcw className="size-4" />
            {loading ? "Reversando..." : "Reversar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
