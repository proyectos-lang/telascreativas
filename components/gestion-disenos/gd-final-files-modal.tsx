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
import { FolderCheck } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDFileUploader } from "./gd-file-uploader"
import type { GestionDiseno, GestionDisenoProposal } from "@/lib/gestion-disenos-types"

interface GDFinalFilesModalProps {
  gestion: GestionDiseno
  propuesta: GestionDisenoProposal
  open: boolean
  onClose: () => void
}

export function GDFinalFilesModal({
  gestion,
  propuesta,
  open,
  onClose,
}: GDFinalFilesModalProps) {
  const { updateProposal, updateSolicitud } = useGD()
  const [archivos, setArchivos] = useState<string[]>(propuesta.archivos_finales_urls ?? [])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!archivos.length) {
      toast.error("Debes subir al menos un archivo final")
      return
    }
    setLoading(true)
    try {
      const propRes = await updateProposal(propuesta.id, {
        archivos_finales_urls: archivos,
        fecha_archivos_finales: new Date().toISOString(),
        estado: "Aprobada",
      })
      if (!propRes.success) {
        toast.error("Error al guardar archivos", { description: propRes.error })
        return
      }
      const solRes = await updateSolicitud(gestion.id, {
        estado: "Finalizado",
        estado_turno: "Finalizado",
      })
      if (solRes.success) {
        toast.success("Archivos entregados — Solicitud finalizada", {
          description: `${archivos.length} archivo${archivos.length > 1 ? "s" : ""} subido${archivos.length > 1 ? "s" : ""}.`,
        })
        onClose()
      } else {
        toast.error("Error al finalizar solicitud", { description: solRes.error })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar Archivos Finales</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
            El diseño fue aprobado. Sube los archivos finales en los formatos requeridos (.ai, .pdf, .png) y
            presiona "Finalizar" para cerrar la solicitud.
          </div>

          <GDFileUploader
            label="Archivos finales (.ai, .pdf, .png, etc.)"
            value={archivos}
            onChange={setArchivos}
            pathPrefix={`gd_${gestion.id}_final`}
            maxFiles={10}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !archivos.length}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <FolderCheck className="size-4" />
            {loading ? "Finalizando..." : "Entregar y Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
