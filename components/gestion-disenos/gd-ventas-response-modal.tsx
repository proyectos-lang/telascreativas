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
import { CheckCircle, RefreshCw, AlertCircle, Download } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDFileUploader } from "./gd-file-uploader"
import type { GestionDiseno, GestionDisenoProposal } from "@/lib/gestion-disenos-types"

interface GDVentasResponseModalProps {
  gestion: GestionDiseno
  propuesta: GestionDisenoProposal
  open: boolean
  onClose: () => void
}

export function GDVentasResponseModal({
  gestion,
  propuesta,
  open,
  onClose,
}: GDVentasResponseModalProps) {
  const { updateProposal, updateSolicitud } = useGD()
  const [decision, setDecision] = useState<"Aprobada" | "Con Cambios" | null>(null)
  const [comentario, setComentario] = useState("")
  const [imagenCambio, setImagenCambio] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const atLimit = gestion.total_propuestas >= 5
  const nearLimit = gestion.total_propuestas === 4

  const handleSubmit = async () => {
    if (decision === "Con Cambios" && atLimit) {
      toast.error("Se alcanzó el límite de 5 propuestas. Crea una nueva solicitud.")
      return
    }
    setLoading(true)
    try {
      const now = new Date().toISOString()
      const propRes = await updateProposal(propuesta.id, {
        respuesta_ventas: decision,
        comentario_ventas: comentario.trim() || null,
        imagen_cambio_url: imagenCambio[0] ?? null,
        fecha_respuesta_ventas: now,
        estado: decision === "Aprobada" ? "Aprobada" : "Con Cambios",
        // If the client link was already active, also register as client response
        ...(propuesta.estado === "En Cliente"
          ? {
              respuesta_cliente: decision === "Aprobada" ? "Aprobada" : "Con Cambios",
              comentario_cliente: "(Registrado directamente por Ventas)",
              fecha_respuesta_cliente: now,
            }
          : {}),
      })
      if (!propRes.success) {
        toast.error("Error", { description: propRes.error })
        return
      }

      const solicitudUpdates: Partial<GestionDiseno> =
        decision === "Aprobada"
          ? { estado: "Pendiente Aprobacion", estado_turno: "En Ventas" }
          : { estado: "En Progreso", estado_turno: "En Diseño" }

      const solRes = await updateSolicitud(gestion.id, solicitudUpdates)
      if (solRes.success) {
        toast.success(
          decision === "Aprobada" ? "Propuesta aprobada por Ventas" : "Cambios enviados a Diseño",
          {
            description:
              decision === "Aprobada"
                ? "Confirma la aprobación final para terminar."
                : "El diseñador recibirá los comentarios.",
          }
        )
        onClose()
      } else {
        toast.error("Error", { description: solRes.error })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Respuesta de Ventas</DialogTitle>
          <DialogDescription>
            Propuesta {propuesta.numero_propuesta} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {propuesta.imagen_mockup_url && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-500">Imagen del mockup</span>
              <a
                href={propuesta.imagen_mockup_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="size-3.5" />
                Descargar
              </a>
            </div>
          )}
          {propuesta.estado === "En Cliente" && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              El link del cliente está activo. Al responder aquí, la decisión quedará registrada también en el link del cliente.
            </div>
          )}
          {(atLimit || nearLimit) && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                atLimit
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {atLimit
                ? "Este es el último ajuste disponible. Solo puedes aprobar la propuesta."
                : "Solo queda 1 ajuste disponible después de este."}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDecision("Aprobada")}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                decision === "Aprobada"
                  ? "border-green-500 bg-green-50"
                  : "border-slate-200 hover:border-green-300"
              }`}
            >
              <CheckCircle
                className={decision === "Aprobada" ? "size-6 text-green-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">Aprobar</span>
            </button>

            <button
              type="button"
              onClick={() => !atLimit && setDecision("Con Cambios")}
              disabled={atLimit}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                atLimit
                  ? "cursor-not-allowed opacity-40 border-slate-200"
                  : decision === "Con Cambios"
                  ? "border-amber-500 bg-amber-50"
                  : "border-slate-200 hover:border-amber-300"
              }`}
            >
              <RefreshCw
                className={
                  decision === "Con Cambios" ? "size-6 text-amber-600" : "size-6 text-slate-400"
                }
              />
              <span className="text-sm font-medium">Solicitar cambios</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Comentario {decision === "Con Cambios" ? "*" : "(opcional)"}</Label>
            <Textarea
              placeholder={
                decision === "Aprobada"
                  ? "Comentario de aprobación (opcional)..."
                  : "Describe qué debe cambiar el diseñador..."
              }
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>

          {decision === "Con Cambios" && (
            <GDFileUploader
              label="Imagen de referencia para el cambio (opcional)"
              value={imagenCambio}
              onChange={setImagenCambio}
              pathPrefix={`gd_${gestion.id}_cambio${propuesta.numero_propuesta}`}
              maxFiles={1}
            />
          )}
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
              (decision === "Con Cambios" && !comentario.trim())
            }
            className={
              decision === "Aprobada"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-amber-600 hover:bg-amber-700"
            }
          >
            {loading ? "Procesando..." : decision === "Aprobada" ? "Aprobar propuesta" : "Enviar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
