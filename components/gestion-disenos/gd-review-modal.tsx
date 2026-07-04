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
import { CheckCircle, XCircle, Loader2, User } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
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

  const [disenadores, setDisenadores] = useState<Disenador[]>([])
  const [loadingDis, setLoadingDis] = useState(false)
  const [selectedDis, setSelectedDis] = useState("")

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
        .sort((a, b) => a.activos - b.activos)
      setDisenadores(lista)
      if (lista.length > 0) setSelectedDis(lista[0].nombre)
      setLoadingDis(false)
    })
  }, [open])

  const handleSubmit = async () => {
    if (decision === "rechazar" && !motivo.trim()) {
      toast.error("Indica el motivo del rechazo")
      return
    }
    if (decision === "aceptar" && !selectedDis) {
      toast.error("Selecciona un diseñador")
      return
    }
    setLoading(true)
    try {
      const updates: Partial<GestionDiseno> =
        decision === "aceptar"
          ? {
              estado: "En Progreso",
              estado_turno: "En Diseño",
              disenador: selectedDis,
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
              ? `Asignado a ${selectedDis}. El diseño está En Progreso.`
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Revisar Esquemático</DialogTitle>
          <DialogDescription>
            {gestion.numero} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <Label className="text-sm flex items-center gap-1">
                <User className="size-3.5" />
                Asignar diseñador <span className="text-red-500">*</span>
              </Label>
              {loadingDis ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando diseñadores...
                </div>
              ) : disenadores.length === 0 ? (
                <p className="text-sm text-slate-400">No hay diseñadores disponibles.</p>
              ) : (
                <select
                  value={selectedDis}
                  onChange={(e) => setSelectedDis(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {disenadores.map((d, i) => (
                    <option key={d.nombre} value={d.nombre}>
                      {d.nombre} ({d.activos} activos){i === 0 ? " — Recomendado" : ""}
                    </option>
                  ))}
                </select>
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
              (decision === "aceptar" && (!selectedDis || loadingDis)) ||
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
    </Dialog>
  )
}
