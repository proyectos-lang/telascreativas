"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { GDWatermarkImage } from "@/components/gestion-disenos/gd-watermark-image"
import { CheckCircle, RefreshCw, AlertCircle } from "lucide-react"
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
      const { error: dbError } = await supabase
        .schema("telas")
        .from("gestion_disenos_propuestas")
        .update({
          respuesta_cliente: decision,
          comentario_cliente: comentario.trim() || null,
          fecha_respuesta_cliente: new Date().toISOString(),
        })
        .eq("cliente_token", token)

      if (dbError) {
        setSubmitError("Error al enviar tu respuesta. Por favor intenta de nuevo.")
      } else {
        setDone(true)
      }
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
