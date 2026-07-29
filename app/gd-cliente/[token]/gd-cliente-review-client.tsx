"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { GDWatermarkImage } from "@/components/gestion-disenos/gd-watermark-image"
import { CheckCircle, RefreshCw, AlertCircle, ImagePlus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { GestionDisenoProposal } from "@/lib/gestion-disenos-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface GestionInfo {
  numero: string
  cliente: string
  vendedora: string
  total_propuestas: number
}

interface GDClienteReviewClientProps {
  propuesta: GestionDisenoProposal
  token: string
  gestion: GestionInfo
}

export function GDClienteReviewClient({
  propuesta,
  token,
  gestion,
}: GDClienteReviewClientProps) {
  const [decision, setDecision] = useState<"Aprobada" | "Con Cambios" | null>(null)
  const [comentario, setComentario] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [imagenesCliente, setImagenesCliente] = useState<string[]>([])
  const [uploadingImg, setUploadingImg] = useState(false)

  // Sube imágenes que adjunta el cliente al bucket público gd-archivos.
  // Nombre único (timestamp) → siempre INSERT (evita el error RLS de overwrite).
  const handleClientFiles = async (files: FileList) => {
    const toUpload = Array.from(files).slice(0, 5 - imagenesCliente.length)
    if (toUpload.length === 0) return
    setUploadingImg(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        if (file.size > 50 * 1024 * 1024) {
          setSubmitError("Cada imagen debe pesar máximo 50 MB.")
          continue
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `cliente_${propuesta.gestion_id}_${propuesta.id}_${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from("gd-archivos")
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) {
          setSubmitError("No se pudo subir la imagen. Intenta de nuevo.")
          continue
        }
        const { data } = supabase.storage.from("gd-archivos").getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      }
      if (urls.length) setImagenesCliente((prev) => [...prev, ...urls])
    } finally {
      setUploadingImg(false)
    }
  }

  // Already processed by ventas (vendor responded directly)
  if (propuesta.respuesta_ventas) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="size-12 text-amber-400" />
        <h2 className="text-lg font-semibold text-slate-700">Propuesta ya procesada</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Esta propuesta ya fue revisada y procesada por el equipo de Telas Creativas. Puedes contactarlos para más información.
        </p>
      </div>
    )
  }

  // Client already responded (and not freshly submitted this session)
  if (propuesta.respuesta_cliente && !done) {
    const approved = propuesta.respuesta_cliente === "Aprobada"
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle className={`size-12 ${approved ? "text-green-500" : "text-amber-400"}`} />
        <h2 className="text-lg font-semibold text-slate-700">Ya enviaste tu respuesta</h2>
        <p className="text-sm text-slate-500">
          Tu decisión: <strong>{propuesta.respuesta_cliente}</strong>
        </p>
        {propuesta.comentario_cliente &&
          propuesta.comentario_cliente !== "(Registrado directamente por Ventas)" && (
            <p className="text-sm text-slate-400 italic max-w-xs">
              "{propuesta.comentario_cliente}"
            </p>
          )}
      </div>
    )
  }

  // Freshly submitted this session
  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle className="size-12 text-green-500" />
        <h2 className="text-lg font-semibold text-slate-700">¡Gracias por tu respuesta!</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          {decision === "Aprobada"
            ? "Has aprobado el diseño. El equipo de Telas Creativas recibirá tu confirmación."
            : "Has solicitado cambios. El equipo de diseño recibirá tus comentarios."}
        </p>
      </div>
    )
  }

  const isLastProposal = gestion.total_propuestas >= 5

  const handleSubmit = async () => {
    if (!decision) return
    if (decision === "Con Cambios" && !comentario.trim()) return
    setLoading(true)
    setSubmitError(null)
    try {
      const now = new Date().toISOString()

      // 1. Update the proposal record
      const { error: propError } = await supabase
        .schema("telas")
        .from("gestion_disenos_propuestas")
        .update({
          respuesta_cliente: decision,
          comentario_cliente: comentario.trim() || null,
          imagenes_cliente_urls: imagenesCliente.length ? imagenesCliente : null,
          fecha_respuesta_cliente: now,
          estado: decision === "Aprobada" ? "Aprobada" : "Con Cambios",
        })
        .eq("cliente_token", token)

      if (propError) {
        setSubmitError("Error al enviar tu respuesta. Por favor intenta de nuevo.")
        return
      }

      // 2. Advance gestion_disenos state automatically:
      //    Aprobada → Aprobado / En Diseño (diseñador entrega archivos finales)
      //    Con Cambios → En Progreso / En Diseño (va directo al diseñador asignado,
      //      sin requerir aprobación de Ventas; el diseñador sube nueva propuesta).
      const gdUpdates =
        decision === "Aprobada"
          ? { estado: "Aprobado", estado_turno: "En Diseño" }
          : { estado: "En Progreso", estado_turno: "En Diseño" }

      const { error: gdError } = await supabase
        .schema("telas")
        .from("gestion_disenos")
        .update(gdUpdates)
        .eq("id", propuesta.gestion_id)

      if (gdError) {
        setSubmitError("Error al actualizar el estado del diseño. Por favor intenta de nuevo.")
        return
      }

      setDone(true)
    } catch {
      setSubmitError("Error de conexión. Por favor intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Mockup with watermark */}
      {propuesta.imagen_mockup_url && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
          <GDWatermarkImage
            src={propuesta.imagen_mockup_url}
            alt={`Propuesta ${propuesta.numero_propuesta}`}
            className="rounded-lg"
          />
        </div>
      )}

      {/* Designer comment */}
      {propuesta.comentario_diseno && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-blue-600">Notas del diseñador</p>
          <p className="text-sm text-blue-800">{propuesta.comentario_diseno}</p>
        </div>
      )}

      {/* Last proposal warning */}
      {isLastProposal && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ Esta es la última propuesta de ajuste disponible (5 de 5). Por favor revisa
          cuidadosamente antes de responder.
        </div>
      )}

      {/* Decision buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setDecision("Aprobada")}
          className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            decision === "Aprobada"
              ? "border-green-500 bg-green-50"
              : "border-slate-200 hover:border-green-300"
          }`}
        >
          <CheckCircle
            className={decision === "Aprobada" ? "size-8 text-green-600" : "size-8 text-slate-300"}
          />
          <span className="text-sm font-semibold">Aprobar diseño</span>
          <span className="text-center text-xs text-slate-500">El diseño está listo</span>
        </button>

        <button
          type="button"
          onClick={() => !isLastProposal && setDecision("Con Cambios")}
          disabled={isLastProposal}
          className={`flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            isLastProposal
              ? "cursor-not-allowed opacity-40 border-slate-200"
              : decision === "Con Cambios"
              ? "border-amber-500 bg-amber-50"
              : "border-slate-200 hover:border-amber-300"
          }`}
        >
          <RefreshCw
            className={
              decision === "Con Cambios" ? "size-8 text-amber-600" : "size-8 text-slate-300"
            }
          />
          <span className="text-sm font-semibold">Solicitar cambios</span>
          <span className="text-center text-xs text-slate-500">Necesito ajustes</span>
        </button>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Comentario{" "}
          {decision === "Con Cambios" ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-slate-400">(opcional)</span>
          )}
        </label>
        <Textarea
          placeholder={
            decision === "Con Cambios"
              ? "Describe qué cambios necesitas..."
              : "Algún comentario adicional..."
          }
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
        />
      </div>

      {/* Adjuntar imágenes (solo al solicitar cambios) */}
      {decision === "Con Cambios" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Adjuntar imágenes <span className="text-slate-400">(opcional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {imagenesCliente.map((url, i) => (
              <div
                key={i}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <img src={url} alt={`Adjunto ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImagenesCliente((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-red-500 p-0.5 text-white"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {imagenesCliente.length < 5 && (
              <label
                className={`flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-amber-400 hover:text-amber-500 ${
                  uploadingImg ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploadingImg ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="size-5" />
                    <span className="text-[10px]">Subir</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleClientFiles(e.target.files)}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Puedes adjuntar referencias (por ejemplo, un nuevo logo). Máx. 5 imágenes.
          </p>
        </div>
      )}

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={
          !decision ||
          loading ||
          (decision === "Con Cambios" && !comentario.trim())
        }
        className={`w-full ${
          decision === "Aprobada"
            ? "bg-green-600 hover:bg-green-700"
            : decision === "Con Cambios"
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-slate-300 text-slate-500"
        }`}
      >
        {loading
          ? "Enviando..."
          : decision === "Aprobada"
          ? "Confirmar aprobación"
          : decision === "Con Cambios"
          ? "Enviar solicitud de cambios"
          : "Selecciona una opción arriba"}
      </Button>
    </div>
  )
}
