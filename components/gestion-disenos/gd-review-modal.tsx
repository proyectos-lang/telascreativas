"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
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
import { CheckCircle, Expand, XCircle, Loader2 } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDImageLightbox } from "./gd-image-lightbox"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Disenador {
  nombre: string
  activos: number
}

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const [autoDisenador, setAutoDisenador] = useState<Disenador | null>(null)
  const [loadingDis, setLoadingDis] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingDis(true)
    Promise.all([
      supabase.schema("telas").from("disenadores").select("nombre").order("nombre"),
      supabase
        .schema("telas")
        .from("gestion_disenos")
        .select("disenador")
        .not("disenador", "is", null)
        .not("estado", "in", '("Finalizado","Rechazado","Devuelto")'),
    ]).then(([disRes, casosRes]) => {
      const nombres: string[] = (disRes.data ?? []).map((d: { nombre: string }) => d.nombre)
      const carga = new Map<string, number>(nombres.map((n) => [n, 0]))
      for (const c of casosRes.data ?? []) {
        const n = c.disenador as string
        carga.set(n, (carga.get(n) ?? 0) + 1)
      }
      const lista: Disenador[] = nombres
        .map((n) => ({ nombre: n, activos: carga.get(n) ?? 0 }))
        .sort((a, b) => a.activos - b.activos || a.nombre.localeCompare(b.nombre, "es"))
      setAutoDisenador(lista[0] ?? null)
      setLoadingDis(false)
    })
  }, [open])

  const handleSubmit = async () => {
    if (decision === "rechazar" && !motivo.trim()) {
      toast.error("Indica el motivo del rechazo")
      return
    }
    if (decision === "aceptar" && !autoDisenador) {
      toast.error("No hay diseñadores disponibles en el catálogo")
      return
    }
    setLoading(true)
    try {
      const updates: Partial<GestionDiseno> =
        decision === "aceptar"
          ? {
              estado: "En Progreso",
              estado_turno: "En Diseño",
              disenador: autoDisenador!.nombre,
              fecha_asignacion: new Date().toISOString(),
            }
          : {
              estado: "Devuelto",
              estado_turno: "En Ventas",
              motivo_rechazo_diseno: motivo.trim(),
            }

      const res = await updateSolicitud(gestion.id, updates)
      if (res.success) {
        toast.success(decision === "aceptar" ? "Esquemático aceptado" : "Esquemático devuelto a Ventas", {
          description:
            decision === "aceptar"
              ? `Asignado a ${autoDisenador!.nombre}. El diseño está En Progreso.`
              : "Se notificó a Ventas con los comentarios de corrección.",
        })
        onClose()
      } else {
        toast.error("Error", { description: res.error })
      }
    } finally {
      setLoading(false)
    }
  }

  const imageGroups = [
    { label: "Prototipo de prenda", urls: gestion.urls_prototipo_prenda },
    { label: "Prototipo segunda", urls: gestion.urls_prototipo_segunda },
    { label: "Diseño base", urls: gestion.urls_diseno_base },
    { label: "Imágenes / símbolos", urls: gestion.urls_imagenes_simbolos },
    { label: "Referencia a recrear", urls: gestion.urls_recreacion },
  ].filter((g) => g.urls && g.urls.length > 0)

  const allImages = imageGroups.flatMap((g) => g.urls as string[])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar Esquemático</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Galería de imágenes del esquemático */}
          {imageGroups.length > 0 && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Imágenes del esquemático ({allImages.length})
              </p>
              {imageGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {(group.urls as string[]).map((url, i) => (
                      <div
                        key={i}
                        className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white"
                        onClick={() => setLightboxSrc(url)}
                      >
                        <img
                          src={url}
                          alt={`${group.label} ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                          <Expand className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  ? "border-orange-500 bg-orange-50"
                  : "border-slate-200 hover:border-orange-300"
              }`}
            >
              <XCircle
                className={decision === "rechazar" ? "size-6 text-orange-600" : "size-6 text-slate-400"}
              />
              <span className="text-sm font-medium">Devolver a Ventas</span>
            </button>
          </div>

          {decision === "aceptar" && (
            <div className="space-y-1.5">
              {loadingDis ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="size-4 animate-spin" />
                  Calculando asignación...
                </div>
              ) : autoDisenador ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-indigo-600">Se asignará automáticamente a:</p>
                  <p className="mt-0.5 font-semibold text-indigo-900">{autoDisenador.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {autoDisenador.activos} diseño{autoDisenador.activos !== 1 ? "s" : ""} activo{autoDisenador.activos !== 1 ? "s" : ""} — menor carga de trabajo
                  </p>
                </div>
              ) : (
                <p className="text-xs text-red-500">No hay diseñadores disponibles en el catálogo.</p>
              )}
            </div>
          )}

          {decision === "rechazar" && (
            <div className="space-y-1.5">
              <Label className="text-sm">
                Comentario para Ventas <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Explica qué información falta o qué hay que corregir en el esquemático..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
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
              (decision === "aceptar" && (!autoDisenador || loadingDis)) ||
              (decision === "rechazar" && !motivo.trim())
            }
            className={
              decision === "aceptar"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-orange-600 hover:bg-orange-700"
            }
          >
            {loading ? "Procesando..." : decision === "aceptar" ? "Aceptar y asignar" : "Devolver a Ventas"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />
      )}
    </Dialog>
  )
}
