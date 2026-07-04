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
import { Upload } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDFileUploader } from "./gd-file-uploader"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"

interface GDUploadProposalModalProps {
  gestion: GestionDiseno
  open: boolean
  onClose: () => void
}

export function GDUploadProposalModal({ gestion, open, onClose }: GDUploadProposalModalProps) {
  const { addProposal, updateSolicitud } = useGD()
  const [comentario, setComentario] = useState("")
  const [imagenesUrls, setImagenesUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const nextNum = (gestion.propuestas?.length ?? 0) + 1
  const prefix = `gd_${gestion.id}_prop${nextNum}`

  const handleSubmit = async () => {
    if (!imagenesUrls.length) {
      toast.error("Debes subir al menos una imagen de mockup")
      return
    }
    setLoading(true)
    try {
      const [propRes] = await Promise.all([
        addProposal(gestion.id, {
          numero_propuesta: nextNum,
          imagen_mockup_url: imagenesUrls[0],
          imagenes_propuesta_urls: imagenesUrls,
          comentario_diseno: comentario.trim() || null,
          fecha_subida: new Date().toISOString(),
          estado: "Pendiente",
        }),
      ])
      if (!propRes.success) {
        toast.error("Error al subir propuesta", { description: propRes.error })
        return
      }
      const updateRes = await updateSolicitud(gestion.id, {
        estado: "Esperando Retroalimentacion",
        estado_turno: "En Ventas",
        total_propuestas: nextNum,
      })
      if (updateRes.success) {
        toast.success(`Propuesta ${nextNum} subida`, {
          description: "Ventas recibirá la notificación para revisar.",
        })
        setComentario("")
        setImagenesUrls([])
        onClose()
      } else {
        toast.error("Error al actualizar solicitud", { description: updateRes.error })
      }
    } finally {
      setLoading(false)
    }
  }

  const atLimit = nextNum > 5

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Propuesta {nextNum}</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        {atLimit ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-700">
            Se ha alcanzado el límite de 5 propuestas para esta solicitud.
            <br />
            Si se requieren más cambios, se debe crear una nueva solicitud de diseño.
          </div>
        ) : (
          <div className="space-y-4">
            {nextNum >= 5 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                ⚠️ Esta es la propuesta <strong>{nextNum} de 5</strong>. Es el último ajuste disponible.
              </div>
            )}
            {nextNum === 4 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠️ Solo queda 1 propuesta más disponible después de esta.
              </div>
            )}

            <GDFileUploader
              label="Imágenes del mockup * (máx. 5)"
              value={imagenesUrls}
              onChange={setImagenesUrls}
              pathPrefix={prefix}
              maxFiles={5}
            />

            <div className="space-y-1.5">
              <Label className="text-sm">Comentario del diseñador (opcional)</Label>
              <Textarea
                placeholder="Describe cambios realizados, decisiones de diseño, alternativas consideradas..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {!atLimit && (
            <Button
              onClick={handleSubmit}
              disabled={loading || !imagenesUrls.length}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="size-4" />
              {loading ? "Subiendo..." : "Subir propuesta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
