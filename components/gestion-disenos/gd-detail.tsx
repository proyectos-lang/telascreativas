"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Upload,
  Share2,
  RotateCcw,
  FolderCheck,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GestionDiseno, GestionDisenoProposal } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS, ESTADO_TURNO_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"
import { GDProposalTimeline } from "./gd-proposal-timeline"
import { GDChatHistory } from "./gd-chat-history"
import { GDSchematicForm } from "./gd-schematic-form"
import { GDSendModal } from "./gd-send-modal"
import { GDReviewModal } from "./gd-review-modal"
import { GDUploadProposalModal } from "./gd-upload-proposal-modal"
import { GDShareClientModal } from "./gd-share-client-modal"
import { GDVentasResponseModal } from "./gd-ventas-response-modal"
import { GDApproveModal } from "./gd-approve-modal"
import { GDFinalFilesModal } from "./gd-final-files-modal"
import { useGD } from "@/lib/gestion-disenos-context"

interface GDDetailProps {
  gestion: GestionDiseno
  usuarioRol: { esVentas: boolean; esDiseno: boolean; esAdmin: boolean }
  onBack: () => void
}

type Modal =
  | "send"
  | "review"
  | "upload"
  | "share"
  | "ventas-resp"
  | "approve"
  | "final-files"
  | null

export function GDDetail({ gestion, usuarioRol, onBack }: GDDetailProps) {
  const { updateSolicitud } = useGD()
  const [modal, setModal] = useState<Modal>(null)
  const [selectedProp, setSelectedProp] = useState<GestionDisenoProposal | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<GestionDiseno>>(gestion)

  const propuestas = gestion.propuestas ?? []
  const activeProp = selectedProp ?? propuestas[propuestas.length - 1] ?? null

  const { esVentas, esDiseno, esAdmin } = usuarioRol

  const handleSaveEdit = async () => {
    await updateSolicitud(gestion.id, editData)
    setIsEditing(false)
  }

  const openShareModal = (prop: GestionDisenoProposal) => {
    setSelectedProp(prop)
    setModal("share")
  }

  const openVentasResp = (prop: GestionDisenoProposal) => {
    setSelectedProp(prop)
    setModal("ventas-resp")
  }

  const canEdit =
    (esVentas || esAdmin) &&
    (gestion.estado === "Borrador" || gestion.estado === "Rechazado")
  const canSend = canEdit && gestion.estado !== "Finalizado"
  const canReview = (esDiseno || esAdmin) && gestion.estado === "Pendiente Revision"
  const canUpload =
    (esDiseno || esAdmin) &&
    gestion.estado === "En Progreso" &&
    gestion.total_propuestas < 5
  const canVentasResp =
    (esVentas || esAdmin) &&
    gestion.estado === "Esperando Retroalimentacion" &&
    activeProp !== null &&
    (activeProp.estado === "Pendiente" || activeProp.estado === "En Cliente")
  const canShare =
    (esVentas || esAdmin) &&
    gestion.estado === "Esperando Retroalimentacion" &&
    activeProp !== null
  const canApprove = (esVentas || esAdmin) && gestion.estado === "Pendiente Aprobacion"
  const canFinalFiles = (esDiseno || esAdmin) && gestion.estado === "Aprobado"

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-indigo-700">{gestion.numero}</span>
              <span className="text-slate-400">·</span>
              <span className="font-semibold text-slate-800">{gestion.cliente}</span>
              <Badge className={cn("text-xs", ESTADO_GD_COLORS[gestion.estado])}>
                {gestion.estado}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-xs", ESTADO_TURNO_COLORS[gestion.estado_turno])}
              >
                {gestion.estado_turno}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {gestion.vendedora}
              {gestion.disenador ? ` · ${gestion.disenador}` : ""}
              {" · "}
              {format(new Date(gestion.fecha_creacion), "dd MMM yyyy", { locale: es })}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-1.5 h-8"
            >
              <Pencil className="size-3.5" />
              Editar
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="h-8">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="h-8 bg-indigo-600 hover:bg-indigo-700">
                Guardar
              </Button>
            </>
          )}
          {canSend && !isEditing && (
            <Button size="sm" onClick={() => setModal("send")} className="gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-700">
              <Send className="size-3.5" />
              Enviar a Diseño
            </Button>
          )}
          {canReview && (
            <Button size="sm" onClick={() => setModal("review")} className="gap-1.5 h-8 bg-amber-500 hover:bg-amber-600">
              <CheckCircle className="size-3.5" />
              Revisar
            </Button>
          )}
          {canUpload && (
            <Button size="sm" onClick={() => setModal("upload")} className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-700">
              <Upload className="size-3.5" />
              Subir propuesta
            </Button>
          )}
          {canShare && activeProp && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openShareModal(activeProp)}
              className="gap-1.5 h-8 border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Share2 className="size-3.5" />
              Compartir
            </Button>
          )}
          {canVentasResp && activeProp && (
            <Button
              size="sm"
              onClick={() => openVentasResp(activeProp)}
              className="gap-1.5 h-8 bg-green-600 hover:bg-green-700"
            >
              <RotateCcw className="size-3.5" />
              Responder
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={() => setModal("approve")} className="gap-1.5 h-8 bg-green-700 hover:bg-green-800">
              <CheckCircle className="size-3.5" />
              Aprobar definitivo
            </Button>
          )}
          {canFinalFiles && (
            <Button size="sm" onClick={() => setModal("final-files")} className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700">
              <FolderCheck className="size-3.5" />
              Entregar archivos
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Schematic */}
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Esquemático
          </h3>
          <GDSchematicForm
            initialData={isEditing ? editData : gestion}
            gestId={gestion.id}
            onChange={setEditData}
            disabled={!isEditing}
          />
        </div>

        {/* Right: Timeline + Chat */}
        <div className="flex flex-col gap-3 overflow-hidden">
          {/* Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shrink-0">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Propuestas
            </h3>
            {propuestas.length > 0 ? (
              <GDProposalTimeline
                propuestas={propuestas}
                totalPropuestas={gestion.total_propuestas}
                onSelectPropuesta={setSelectedProp}
                selectedId={activeProp?.id}
              />
            ) : (
              <p className="text-xs text-slate-400">Sin propuestas aún.</p>
            )}
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Historial
              </h3>
            </div>
            <ScrollArea className="h-[calc(100%-44px)]">
              <div className="p-4">
                <GDChatHistory gestion={gestion} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "send" && (
        <GDSendModal gestion={gestion} open onClose={() => setModal(null)} />
      )}
      {modal === "review" && (
        <GDReviewModal gestion={gestion} open onClose={() => setModal(null)} />
      )}
      {modal === "upload" && (
        <GDUploadProposalModal gestion={gestion} open onClose={() => setModal(null)} />
      )}
      {modal === "share" && activeProp && (
        <GDShareClientModal
          gestion={gestion}
          propuesta={activeProp}
          open
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ventas-resp" && activeProp && (
        <GDVentasResponseModal
          gestion={gestion}
          propuesta={activeProp}
          open
          onClose={() => setModal(null)}
        />
      )}
      {modal === "approve" && (
        <GDApproveModal gestion={gestion} open onClose={() => setModal(null)} />
      )}
      {modal === "final-files" && activeProp && (
        <GDFinalFilesModal
          gestion={gestion}
          propuesta={activeProp}
          open
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
