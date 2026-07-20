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
import { toast } from "sonner"
import { useGD } from "@/lib/gestion-disenos-context"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { Send } from "lucide-react"

interface GDSendModalProps {
  gestion: GestionDiseno
  open: boolean
  onClose: () => void
}

export function GDSendModal({ gestion, open, onClose }: GDSendModalProps) {
  const { updateSolicitud } = useGD()
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    setLoading(true)
    try {
      const res = await updateSolicitud(gestion.id, {
        estado: "Pendiente Revision",
        estado_turno: "En Diseño",
        motivo_rechazo_diseno: null,
      })
      if (res.success) {
        toast.success("Esquemático enviado a Diseño", {
          description: "El diseñador será asignado al momento de aceptar la solicitud.",
        })
        onClose()
      } else {
        toast.error("Error al enviar", { description: res.error })
      }
    } finally {
      setLoading(false)
    }
  }

  const missingFields: string[] = []
  if (!gestion.tipo_diseno) missingFields.push("Tipo de diseño")
  if (gestion.tipo_diseno !== "Editable" && gestion.tipo_diseno !== "Existente" && !gestion.tematica) missingFields.push("Temática")
  if (!gestion.tipos_prenda?.length) missingFields.push("Tipo de prenda")
  if (gestion.tipo_diseno !== "Editable" && gestion.tipo_diseno !== "Existente" && !gestion.color_fondo) missingFields.push("Color de fondo")
  if (gestion.tipo_diseno !== "Editable" && gestion.tipo_diseno !== "Existente" && !gestion.color_secundario) missingFields.push("Color secundario")
  if (gestion.tipo_diseno === "Existente" && !gestion.cambios_solicitados?.trim()) missingFields.push("Cambios solicitados")

  const canSend = missingFields.length === 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enviar a Diseño</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        {!canSend ? (
          <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Campos obligatorios incompletos:</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs">
              {missingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            El esquemático se enviará al equipo de diseño para revisión. El diseñador será asignado cuando se acepte la solicitud.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || loading}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="size-4" />
            {loading ? "Enviando..." : "Enviar a Diseño"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
