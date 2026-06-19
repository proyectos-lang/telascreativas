"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Save,
  X,
  Inbox,
  Hash,
  Factory,
  AlertTriangle,
  MessageSquare,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface CosturaReceiveModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReceive: (data: Partial<Orden>) => Promise<void>
}

// Helper to map DB records to first non-empty display string across common keys
function mapToList(
  data: Record<string, unknown>[],
  keys: string[] = ["nombre", "motivo", "descripcion"]
): string[] {
  return data
    .map((row) => {
      for (const key of keys) {
        const v = row[key]
        if (typeof v === "string" && v.trim().length > 0) return v
      }
      return ""
    })
    .filter((v) => v.length > 0)
}

export function CosturaReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: CosturaReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contadores, setContadores] = useState<string[]>([])
  const [motivosDemoraRec, setMotivosDemoraRec] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  // Solo se capturan en RECIBIR los datos del conteo, la entrega al maquilador
  // y la novedad al recibir. El proceso, recepcion del maquilador y resultados
  // de costura se registran posteriormente en el modal de TERMINAR.
  const [formData, setFormData] = useState({
    coscantidad_contada:
      orden.coscantidad_contada !== undefined
        ? String(orden.coscantidad_contada)
        : "",
    cosnombre_de_persona_que_conto: orden.cosnombre_de_persona_que_conto || "",
    cosfecha_entrega_a_maquilador: orden.cosfecha_entrega_a_maquilador || "",
    cosnombre_maquilador: orden.cosnombre_maquilador || "",
    cos_motivo_demora_rec: orden.cos_motivo_demora_rec || "",
    cos_comentario_recibo: orden.cos_comentario_recibo || "",
  })

  // Reset form when modal reopens
  useEffect(() => {
    if (open) {
      setFormData({
        coscantidad_contada:
          orden.coscantidad_contada !== undefined
            ? String(orden.coscantidad_contada)
            : "",
        cosnombre_de_persona_que_conto:
          orden.cosnombre_de_persona_que_conto || "",
        cosfecha_entrega_a_maquilador:
          orden.cosfecha_entrega_a_maquilador || "",
        cosnombre_maquilador: orden.cosnombre_maquilador || "",
        cos_motivo_demora_rec: orden.cos_motivo_demora_rec || "",
        cos_comentario_recibo: orden.cos_comentario_recibo || "",
      })
    }
  }, [open, orden])

  // Fetch contadores y motivos de demora al recibir cuando abre el modal.
  // Se hace en paralelo para reducir el tiempo de carga inicial.
  useEffect(() => {
    async function fetchLists() {
      if (!supabase || !open) return
      setLoadingLists(true)

      const [contadoresRes, motivosRes] = await Promise.all([
        supabase.schema("telas").from("contadores").select("*"),
        supabase
          .schema("telas")
          .from("motivos_demora_costura_rec")
          .select("*"),
      ])

      if (!contadoresRes.error && contadoresRes.data) {
        setContadores(mapToList(contadoresRes.data))
      }

      if (!motivosRes.error && motivosRes.data) {
        setMotivosDemoraRec(mapToList(motivosRes.data))
      } else if (motivosRes.error) {
        console.log(
          "[v0] Costura Receive - error motivos_demora_costura_rec:",
          motivosRes.error
        )
      }

      setLoadingLists(false)
    }

    fetchLists()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const today = new Date().toISOString().split("T")[0]
    const cantidadContadaNum = parseFloat(formData.coscantidad_contada)

    const dataToSubmit: Partial<Orden> = {
      coscantidad_contada: !isNaN(cantidadContadaNum)
        ? cantidadContadaNum
        : undefined,
      cosnombre_de_persona_que_conto:
        formData.cosnombre_de_persona_que_conto || undefined,
      cosfecha_entrega_a_maquilador:
        formData.cosfecha_entrega_a_maquilador || undefined,
      cosnombre_maquilador: formData.cosnombre_maquilador || undefined,
      // Novedad / motivo de demora capturado al recibir la carga.
      // Si quedo vacio se envia undefined para no escribir cadena vacia.
      cos_motivo_demora_rec: formData.cos_motivo_demora_rec || undefined,
      cos_comentario_recibo: formData.cos_comentario_recibo || undefined,
      // Auto-register today's date as conteo date
      cosfecha_conteo: today,
    }

    await onReceive(dataToSubmit)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-icon-purple" />
            Recibir en Costura - {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Registre el conteo de piezas y la entrega al maquilador. La fecha
            de conteo se registra automaticamente. El proceso, la recepcion del
            maquilador y los resultados de costura se registraran al
            <strong> Terminar</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Conteo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Hash className="size-4 text-icon-cyan" />
              Conteo
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coscantidad_contada" className="text-sm">
                  Cantidad Contada
                </Label>
                <Input
                  id="coscantidad_contada"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={formData.coscantidad_contada}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      coscantidad_contada: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cosnombre_de_persona_que_conto"
                  className="text-sm"
                >
                  Persona que Conto
                </Label>
                <Select
                  value={formData.cosnombre_de_persona_que_conto}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosnombre_de_persona_que_conto: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="cosnombre_de_persona_que_conto"
                    className="w-full"
                  >
                    <SelectValue
                      placeholder={
                        loadingLists
                          ? "Cargando contadores..."
                          : "Seleccione contador"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contadores.length === 0 && !loadingLists && (
                      <SelectItem value="__none__" disabled>
                        No hay contadores disponibles
                      </SelectItem>
                    )}
                    {contadores.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Novedad al Recibir */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-icon-coral" />
              Novedad al Recibir
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="cos_motivo_demora_rec" className="text-sm">
                  Motivo de Demora / Novedad
                </Label>
                <Select
                  value={formData.cos_motivo_demora_rec}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      cos_motivo_demora_rec: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="cos_motivo_demora_rec"
                    className="w-full"
                  >
                    <SelectValue
                      placeholder={
                        loadingLists
                          ? "Cargando motivos..."
                          : "Seleccione motivo (opcional)"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosDemoraRec.length === 0 && !loadingLists && (
                      <SelectItem value="__none__" disabled>
                        No hay motivos disponibles
                      </SelectItem>
                    )}
                    {motivosDemoraRec.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Deja vacio si la carga llega completa y sin novedades.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="cos_comentario_recibo"
                  className="flex items-center gap-1.5 text-sm"
                >
                  <MessageSquare className="size-3.5 text-icon-purple" />
                  Comentarios de Entrega
                </Label>
                <Textarea
                  id="cos_comentario_recibo"
                  placeholder="Observaciones al recibir la carga (faltantes, condiciones, etc.)"
                  rows={3}
                  value={formData.cos_comentario_recibo}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cos_comentario_recibo: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 3: Entrega al Maquilador */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Factory className="size-4 text-icon-coral" />
              Entrega al Maquilador
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="cosfecha_entrega_a_maquilador"
                  className="text-sm"
                >
                  Fecha Entrega a Maquilador
                </Label>
                <Input
                  id="cosfecha_entrega_a_maquilador"
                  type="date"
                  value={formData.cosfecha_entrega_a_maquilador}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosfecha_entrega_a_maquilador: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cosnombre_maquilador" className="text-sm">
                  Nombre del Maquilador
                </Label>
                <Input
                  id="cosnombre_maquilador"
                  type="text"
                  placeholder="Ingrese el nombre..."
                  value={formData.cosnombre_maquilador}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosnombre_maquilador: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="mr-1 size-4 text-icon-coral" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Save className="mr-1 size-4" />
              )}
              Guardar Recepcion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
