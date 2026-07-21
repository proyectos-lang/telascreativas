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
  Download,
  FileCheck2,
  AlertTriangle,
  UserCog,
  Expand,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { GDReassignModal } from "./gd-reassign-modal"
import { GDImageLightbox } from "./gd-image-lightbox"
import { GDWatermarkImage } from "./gd-watermark-image"
import { useGD } from "@/lib/gestion-disenos-context"
import { toast } from "sonner"

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
  | "reassign"
  | null

export function GDDetail({ gestion, usuarioRol, onBack }: GDDetailProps) {
  const { updateSolicitud, solicitudes } = useGD()
  const sourceDesign = gestion.diseno_base_gd_id
    ? solicitudes.find((s) => s.id === gestion.diseno_base_gd_id) ?? null
    : null

  const [modal, setModal] = useState<Modal>(null)
  const [selectedProp, setSelectedProp] = useState<GestionDisenoProposal | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<GestionDiseno>>(gestion)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const propuestas = gestion.propuestas ?? []
  const activeProp = selectedProp ?? propuestas[propuestas.length - 1] ?? null

  // Collect final files from all proposals (only the approved one should have them)
  const archivosFinalUrls = propuestas.flatMap((p) => p.archivos_finales_urls ?? []).filter(Boolean)

  const { esVentas, esDiseno, esAdmin } = usuarioRol

  const handleSaveEdit = async () => {
    // Excluir propuestas: viene del join y no es columna real en gestion_disenos.
    // Enviarlo causaba un error silencioso en Supabase que impedía el guardado.
    const { propuestas: _p, ...dataToSave } = editData as GestionDiseno
    const res = await updateSolicitud(gestion.id, dataToSave)
    if (!res.success) {
      toast.error("Error al guardar el esquemático", { description: res.error })
      return
    }
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
    (gestion.estado === "Borrador" || gestion.estado === "Rechazado" || gestion.estado === "Devuelto")
  const canSend = canEdit
  const canReview = (esDiseno || esAdmin) && gestion.estado === "Pendiente Revision"
  const canReassign =
    (esDiseno || esAdmin) &&
    !!gestion.disenador &&
    !["Finalizado", "Rechazado", "Borrador", "Pendiente Revision"].includes(gestion.estado)
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
      {/* Devuelto banner */}
      {gestion.estado === "Devuelto" && gestion.motivo_rechazo_diseno && (esVentas || esAdmin) && (
        <div className="flex gap-2 items-start rounded-lg border border-orange-300 bg-orange-50 px-4 py-3">
          <AlertTriangle className="text-orange-600 size-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              Diseño devolvió esta solicitud para corrección
            </p>
            <p className="text-sm text-orange-700 mt-0.5">{gestion.motivo_rechazo_diseno}</p>
            <p className="text-xs text-orange-600 mt-1">
              Corrige el esquemático y vuelve a enviar a Diseño.
            </p>
          </div>
        </div>
      )}

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
              {gestion.pedido_vinculado && (
                <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
                  <Package className="size-3 text-slate-500" />
                  {gestion.pedido_vinculado}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {gestion.vendedora}
              {gestion.disenador ? ` · ${gestion.disenador}` : ""}
              {" · "}
              {format(new Date(gestion.fecha_creacion), "dd MMM yyyy", { locale: es })}
            </p>
            {/* Edición de pedido vinculado (solo ventas/admin en modo edición) */}
            {isEditing && (esVentas || esAdmin) && (
              <div className="mt-1.5 flex items-center gap-2">
                <Label className="text-xs text-slate-500 shrink-0">Pedido:</Label>
                <Input
                  value={editData.pedido_vinculado?.replace(/^0+/, "") ?? ""}
                  onChange={(e) =>
                    setEditData((d) => ({
                      ...d,
                      pedido_vinculado: e.target.value.replace(/\D/g, "")
                        ? e.target.value.replace(/\D/g, "").padStart(8, "0")
                        : null,
                    }))
                  }
                  placeholder="Sin pedido"
                  className="h-7 max-w-[140px] font-mono text-xs"
                  maxLength={8}
                />
                {editData.pedido_vinculado && (
                  <span className="text-xs font-mono text-slate-400">{editData.pedido_vinculado}</span>
                )}
              </div>
            )}
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
          {canReassign && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModal("reassign")}
              className="gap-1.5 h-8 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              <UserCog className="size-3.5" />
              Reasignar diseñador
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
          {gestion.tipo_diseno === "Existente" && !sourceDesign && !!gestion.urls_diseno_base?.length && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs">
              <span className="shrink-0 font-medium text-violet-700">Diseño base:</span>
              <div className="flex flex-wrap gap-1.5">
                {gestion.urls_diseno_base.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                  >
                    Archivo {gestion.urls_diseno_base!.length > 1 ? i + 1 : "subido"}
                  </a>
                ))}
              </div>
              <span className="ml-auto shrink-0 text-violet-400">subido manualmente</span>
            </div>
          )}
          {gestion.tipo_diseno === "Existente" && sourceDesign && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs">
              <span className="shrink-0 font-medium text-indigo-700">Basado en:</span>
              <span className="font-mono font-semibold text-indigo-900">{sourceDesign.numero}</span>
              <span className="truncate text-indigo-600">— {sourceDesign.cliente}</span>
              <div className="ml-auto flex shrink-0 gap-1">
                {sourceDesign.color_fondo && (
                  <div className="size-4 rounded-full border border-slate-200" style={{ backgroundColor: sourceDesign.color_fondo }} />
                )}
                {sourceDesign.color_secundario && (
                  <div className="size-4 rounded-full border border-slate-200" style={{ backgroundColor: sourceDesign.color_secundario }} />
                )}
              </div>
            </div>
          )}
          {gestion.tipo_diseno === "Existente" && gestion.cambios_solicitados && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Cambios solicitados</p>
                <p className="mt-0.5 text-sm text-amber-800">{gestion.cambios_solicitados}</p>
              </div>
            </div>
          )}
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

          {/* Active proposal image preview */}
          {(() => {
            const allImages = activeProp?.imagenes_propuesta_urls?.length
              ? activeProp.imagenes_propuesta_urls
              : activeProp?.imagen_mockup_url
              ? [activeProp.imagen_mockup_url]
              : []
            if (!allImages.length) return null
            const mainImage = allImages[0]
            return (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vista previa — V{activeProp!.numero_propuesta}
                    {allImages.length > 1 && (
                      <span className="ml-1.5 font-normal text-slate-400">({allImages.length} imágenes)</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {(esVentas || esAdmin) && (
                      <a
                        href={mainImage}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Download className="size-3" />
                        Descargar
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(mainImage)}
                      className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Expand className="size-3" />
                      Ampliar
                    </button>
                  </div>
                </div>

                {/* Main image with hover overlay */}
                <div
                  className="relative group overflow-hidden rounded-lg cursor-pointer"
                  onClick={() => setLightboxSrc(mainImage)}
                >
                  <GDWatermarkImage
                    src={mainImage}
                    alt={`Propuesta ${activeProp!.numero_propuesta}`}
                    className="rounded-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                    <div className="rounded-full bg-black/50 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Expand className="size-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Thumbnail strip for multiple images */}
                {allImages.length > 1 && (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                    {allImages.map((url, i) => (
                      <div
                        key={i}
                        className="relative group shrink-0 h-14 w-14 overflow-hidden rounded-md border-2 cursor-pointer transition-colors"
                        style={{ borderColor: url === mainImage ? "#6366f1" : "#e2e8f0" }}
                        onClick={() => setLightboxSrc(url)}
                      >
                        <img src={url} alt={`imagen ${i + 1}`} className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                          <Expand className="size-3 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Final files download — visible when Finalizado and files exist */}
          {gestion.estado === "Finalizado" && archivosFinalUrls.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shrink-0">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <FileCheck2 className="size-3.5" />
                Archivos Finales
              </h3>
              <ul className="space-y-1.5">
                {archivosFinalUrls.map((url, i) => {
                  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? `archivo-${i + 1}`)
                  return (
                    <li key={i}>
                      <a
                        href={url}
                        download={filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <Download className="size-3.5 shrink-0 text-emerald-600" />
                        <span className="truncate">{filename}</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[10px] text-emerald-600">
                {archivosFinalUrls.length} archivo{archivosFinalUrls.length !== 1 ? "s" : ""} entregado{archivosFinalUrls.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

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
      {modal === "reassign" && (
        <GDReassignModal gestion={gestion} open onClose={() => setModal(null)} />
      )}
      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
