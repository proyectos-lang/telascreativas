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
import { CheckCircle, RefreshCw, AlertCircle, Download, Expand } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDFileUploader } from "./gd-file-uploader"
import { GDWatermarkImage } from "./gd-watermark-image"
import { GDImageLightbox } from "./gd-image-lightbox"
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const imagenesUrls = propuesta.imagenes_propuesta_urls?.length
    ? propuesta.imagenes_propuesta_urls
    : propuesta.imagen_mockup_url
    ? [propuesta.imagen_mockup_url]
    : []

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Respuesta de Ventas</DialogTitle>
          <DialogDescription>
            Propuesta {propuesta.numero_propuesta} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image preview */}
          {imagenesUrls.length > 0 && (
            <div className="space-y-2">
              {imagenesUrls.length === 1 ? (
                <div
                  className="relative group overflow-hidden rounded-lg border border-slate-200 cursor-pointer"
                  onClick={() => setLightboxSrc(imagenesUrls[0])}
                >
                  <GDWatermarkImage src={imagenesUrls[0]} alt="mockup propuesta" className="rounded-lg" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                    <div className="rounded-full bg-black/50 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Expand className="size-5 text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {imagenesUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative group aspect-square overflow-hidden rounded-lg border border-slate-200 cursor-pointer"
                      onClick={() => setLightboxSrc(url)}
                    >
                      <img src={url} alt={`imagen ${i + 1}`} className="h-full w-full object-cover" />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                        <Expand className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {imagenesUrls.length > 1 ? `${imagenesUrls.length} imágenes` : "Propuesta de diseño"}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(imagenesUrls[0])}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Expand className="size-3" />
                    Ampliar
                  </button>
                  {propuesta.imagen_mockup_url && (
                    <a
                      href={propuesta.imagen_mockup_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="size-3" />
                      Descargar
                    </a>
                  )}
                </div>
              </div>
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

      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />
      )}
    </Dialog>
  )
}
