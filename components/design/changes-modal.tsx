"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Save, X, Edit3, Loader2 } from "lucide-react"

interface ChangesModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Orden>) => Promise<void>
}

interface ChangeSectionProps {
  index: 1 | 2 | 3
  fechaValue: string
  motivoValue: string
  onFechaChange: (value: string) => void
  onMotivoChange: (value: string) => void
  disabled: boolean
}

function ChangeSection({
  index,
  fechaValue,
  motivoValue,
  onFechaChange,
  onMotivoChange,
  disabled,
}: ChangeSectionProps) {
  const colors = {
    1: "text-icon-cyan",
    2: "text-icon-magenta",
    3: "text-icon-yellow",
  }

  return (
    <div className="space-y-3 rounded-lg border bg-white/50 p-4">
      <div className="flex items-center gap-2">
        <div className={`rounded-md bg-muted p-1.5 ${colors[index]}`}>
          <Edit3 className="size-3.5" />
        </div>
        <h4 className="text-sm font-semibold">Cambio {index}</h4>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`dfecha_cambio_${index}`} className="text-xs">
            Fecha del Cambio
          </Label>
          <Input
            id={`dfecha_cambio_${index}`}
            type="date"
            value={fechaValue}
            onChange={(e) => onFechaChange(e.target.value)}
            disabled={disabled}
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`dmotivo_cambio_${index}`} className="text-xs">
            Motivo del Cambio
          </Label>
          <Input
            id={`dmotivo_cambio_${index}`}
            type="text"
            value={motivoValue}
            onChange={(e) => onMotivoChange(e.target.value)}
            disabled={disabled}
            placeholder="Descripcion breve del cambio"
            className="text-sm"
          />
        </div>
      </div>
    </div>
  )
}

export function ChangesModal({
  orden,
  open,
  onClose,
  onSave,
}: ChangesModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [fecha1, setFecha1] = useState("")
  const [motivo1, setMotivo1] = useState("")
  const [fecha2, setFecha2] = useState("")
  const [motivo2, setMotivo2] = useState("")
  const [fecha3, setFecha3] = useState("")
  const [motivo3, setMotivo3] = useState("")

  // Precarga con valores actuales cuando se abre el modal
  useEffect(() => {
    if (open) {
      setFecha1(orden.dfecha_cambio_1 || "")
      setMotivo1(orden.dmotivo_cambio_1 || "")
      setFecha2(orden.dfecha_cambio_2 || "")
      setMotivo2(orden.dmotivo_cambio_2 || "")
      setFecha3(orden.dfecha_cambio_3 || "")
      setMotivo3(orden.dmotivo_cambio_3 || "")
    }
  }, [open, orden])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const updates: Partial<Orden> = {
      dfecha_cambio_1: fecha1 || undefined,
      dmotivo_cambio_1: motivo1 || undefined,
      dfecha_cambio_2: fecha2 || undefined,
      dmotivo_cambio_2: motivo2 || undefined,
      dfecha_cambio_3: fecha3 || undefined,
      dmotivo_cambio_3: motivo3 || undefined,
    }

    try {
      await onSave(updates)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-5 text-icon-magenta" />
            Registro de Cambios (Maximo 3)
          </DialogTitle>
          <DialogDescription>
            Registra hasta 3 cambios realizados al diseno de la orden{" "}
            <span className="font-medium text-foreground">{orden.pedido}</span>.
            Puedes rellenar el siguiente cambio disponible o editar los
            existentes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <ChangeSection
            index={1}
            fechaValue={fecha1}
            motivoValue={motivo1}
            onFechaChange={setFecha1}
            onMotivoChange={setMotivo1}
            disabled={isSubmitting}
          />

          <ChangeSection
            index={2}
            fechaValue={fecha2}
            motivoValue={motivo2}
            onFechaChange={setFecha2}
            onMotivoChange={setMotivo2}
            disabled={isSubmitting}
          />

          <ChangeSection
            index={3}
            fechaValue={fecha3}
            motivoValue={motivo3}
            onFechaChange={setFecha3}
            onMotivoChange={setMotivo3}
            disabled={isSubmitting}
          />

          <Separator />

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
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
