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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CheckCircle, XCircle } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"

interface GDReviewModalProps {
  gestion: GestionDiseno
  open: boolean
  onClose: () => void
}

export function GDReviewModal({ gestion, open, onClose }: GDReviewModalProps) {
  const { updateSolicitud } = useGD()
  const [decision, setDecision] = useState<"aceptar" | "rechazar" | null>(null)
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (decision === "rechazar" && !motivo.trim()) {
      toast.error("Indica el motivo del rechazo")
      return
    }
    setLoading(true)
    try {
      const updates: Partial<GestionDiseno> =
        decision === "aceptar"
          ? { estado: "En Progreso", estado_turno: "En Diseño" }
          : {
              estado: "Rechazado",
              estado_turno: "En Ventas",
              motivo_rechazo_diseno: motivo.trim(),
            }

      const res = await updateSolicitud(gestion.id, updates)
      if (res.success) {
        toast.success(decision === "aceptar" ? "Esquemático aceptado" : "Esquemático rechazado", {
          description:
            decision === "aceptar"
              ? "El diseño está ahora En Progreso."
              : "Se notificó a Ventas con el motivo.",
        })
        onClose()
      } else {
        toast.error("Error", { description: res.error })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Revisar Esquemático</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDecision("aceptar")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                decision === "aceptar"
                  ? "border-green-500 bg-green-50"
                  : "border-slate-200 hover:border-green-300"
              }`}
            >
              <CheckCircle
                className={decision === "aceptar" ? "size-6 text-green-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">Aceptar</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision("rechazar")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                decision === "rechazar"
                  ? "border-red-500 bg-red-50"
                  : "border-slate-200 hover:border-red-300"
              }`}
            >
              <XCircle
                className={decision === "rechazar" ? "size-6 text-red-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">Rechazar</span>
            </button>
          </div>

          {decision === "rechazar" && (
            <div className="space-y-1.5">
              <Label className="text-sm">Motivo del rechazo <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Explica qué información falta o qué hay que corregir en el esquemático..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {decision === "aceptar" && (
            <p className="text-sm text-slate-600">
              Al aceptar, el diseño pasará a estado "En Progreso" y podrás comenzar a trabajar en la propuesta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!decision || loading}
            className={
              decision === "aceptar"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {loading ? "Procesando..." : decision === "aceptar" ? "Aceptar diseño" : "Rechazar diseño"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
