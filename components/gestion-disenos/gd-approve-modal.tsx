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
import { GDFileUploader } from "./gd-file-uploader"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"

interface GDApproveModalProps {
  gestion: GestionDiseno
  open: boolean
  onClose: () => void
}

export function GDApproveModal({ gestion, open, onClose }: GDApproveModalProps) {
  const { updateSolicitud } = useGD()
  const [decision, setDecision] = useState<"APROBADO" | "NO APROBADO" | null>(null)
  const [comentario, setComentario] = useState("")
  const [imagenAprobada, setImagenAprobada] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await updateSolicitud(gestion.id, {
        aprobacion_ventas: decision,
        comentario_aprobacion: comentario.trim() || null,
        imagen_aprobada_url: imagenAprobada[0] ?? null,
        fecha_aprobacion: new Date().toISOString(),
        estado: decision === "APROBADO" ? "Aprobado" : "Rechazado",
        estado_turno: decision === "APROBADO" ? "En Diseño" : "En Ventas",
      })
      if (res.success) {
        toast.success(
          decision === "APROBADO" ? "Diseño aprobado definitivamente" : "Diseño no aprobado",
          {
            description:
              decision === "APROBADO"
                ? "El diseñador podrá ahora entregar los archivos finales."
                : "La solicitud ha sido rechazada.",
          }
        )
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobación Final del Diseño</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta es la aprobación definitiva. Si apruebas, el diseñador procederá a entregar los archivos finales.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDecision("APROBADO")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                decision === "APROBADO"
                  ? "border-green-500 bg-green-50"
                  : "border-slate-200 hover:border-green-300"
              }`}
            >
              <CheckCircle
                className={decision === "APROBADO" ? "size-6 text-green-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">Aprobado</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision("NO APROBADO")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                decision === "NO APROBADO"
                  ? "border-red-500 bg-red-50"
                  : "border-slate-200 hover:border-red-300"
              }`}
            >
              <XCircle
                className={decision === "NO APROBADO" ? "size-6 text-red-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">No Aprobado</span>
            </button>
          </div>

          {decision === "APROBADO" && (
            <GDFileUploader
              label="Imagen aprobada (opcional — para referencia)"
              value={imagenAprobada}
              onChange={setImagenAprobada}
              pathPrefix={`gd_${gestion.id}_aprobada`}
              maxFiles={1}
            />
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">
              Comentario {decision === "NO APROBADO" ? "*" : "(opcional)"}
            </Label>
            <Textarea
              placeholder={
                decision === "APROBADO"
                  ? "Notas de la aprobación..."
                  : "Motivo del rechazo definitivo..."
              }
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !decision ||
              loading ||
              (decision === "NO APROBADO" && !comentario.trim())
            }
            className={
              decision === "APROBADO"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {loading
              ? "Procesando..."
              : decision === "APROBADO"
              ? "Confirmar aprobación"
              : "Confirmar rechazo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
