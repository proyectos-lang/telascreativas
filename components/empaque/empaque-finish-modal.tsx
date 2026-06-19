"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  PackageCheck,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  PenLine,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/shared/signature-pad"

// Bucket donde se almacenan las firmas de transferencia entre procesos
// productivos (Sublimacion -> Costura, Empaque -> Vendedora, etc.).
const SIGNATURE_BUCKET = "firmas-procesos"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface EmpaqueFinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
}

export function EmpaqueFinishModal({
  orden,
  open,
  onClose,
  onFinish,
}: EmpaqueFinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // Firma de la vendedora que recibe el pedido empacado. Es obligatoria:
  // bloquea el submit hasta que detecte un trazo en el canvas.
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const signatureRef = useRef<SignaturePadHandle>(null)

  const [formData, setFormData] = useState({
    emotivo_demora_terminado_e: "",
    ecomentario_entrega_e: "",
  })

  // Reset form each time the modal opens
  useEffect(() => {
    if (!open) return
    setFormData({
      emotivo_demora_terminado_e: orden.emotivo_demora_terminado_e || "",
      ecomentario_entrega_e: orden.ecomentario_entrega_e || "",
    })
    // Limpia el canvas al reabrir para no arrastrar trazos previos y
    // re-bloquea el submit hasta que se firme nuevamente.
    signatureRef.current?.clear()
    setSignatureEmpty(true)
  }, [open, orden])

  // Fetch motivos de demora from telas.motivos_demora
  useEffect(() => {
    if (!open) return

    async function fetchMotivos() {
      if (!supabase) {
        setFetchError("Cliente de Supabase no configurado")
        return
      }

      setLoadingMotivos(true)
      setFetchError(null)

      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")

      console.log("[v0] Empaque Finish - Motivos raw:", data)
      console.log("[v0] Empaque Finish - Error motivos:", error)

      if (error) {
        setFetchError(error.message)
      } else {
        // Support nombre / motivo / descripcion column names
        const motivos = (data || [])
          .map(
            (row: Record<string, unknown>) =>
              (row.nombre as string) ||
              (row.motivo as string) ||
              (row.descripcion as string) ||
              ""
          )
          .filter((m: string) => m.length > 0)

        console.log("[v0] Empaque Finish - Motivos mapped:", motivos)
        setMotivosDemora(motivos)
      }

      setLoadingMotivos(false)
    }

    fetchMotivos()
  }, [open])

  const todayISO = new Date().toISOString().split("T")[0]

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  /**
   * Sube el Blob PNG de la firma al bucket `firmas-procesos` y devuelve
   * la URL publica. Sigue el patron `empaque_recibe_vendedora_{pedido}.png`
   * con `upsert: true` para sobrescribir evidencia previa si se re-firma.
   */
  const uploadSignature = async (blob: Blob): Promise<string | null> => {
    if (!supabase) {
      toast.error("Supabase no configurado", {
        description: "No se puede subir la firma sin credenciales.",
      })
      return null
    }

    const safePedido = String(orden.pedido).replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `empaque_recibe_vendedora_${safePedido}.png`

    const { error: uploadError } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .upload(filename, blob, {
        contentType: "image/png",
        upsert: true,
      })

    if (uploadError) {
      toast.error("Error al subir firma", {
        description: uploadError.message,
      })
      return null
    }

    const { data } = supabase.storage
      .from(SIGNATURE_BUCKET)
      .getPublicUrl(filename)

    return data?.publicUrl || null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validacion: firma de la vendedora obligatoria.
    if (signatureRef.current?.isEmpty()) {
      toast.error("Firma requerida", {
        description:
          "La vendedora debe firmar la recepcion del pedido empacado.",
      })
      return
    }

    setIsSubmitting(true)

    // 1. Capturar y subir firma
    const blob = await signatureRef.current?.toBlob()
    if (!blob) {
      toast.error("No se pudo capturar la firma", {
        description: "Intenta firmar nuevamente.",
      })
      setIsSubmitting(false)
      return
    }

    const firmaUrl = await uploadSignature(blob)
    if (!firmaUrl) {
      // El error ya fue notificado dentro de uploadSignature.
      setIsSubmitting(false)
      return
    }

    // 2. Build UPDATE payload - efecha_de_empaque is auto-set to today
    //    e_firma_recibe_vendedora recibe la URL publica de la firma.
    const updates: Partial<Orden> = {
      efecha_de_empaque: todayISO,
      emotivo_demora_terminado_e:
        formData.emotivo_demora_terminado_e || undefined,
      ecomentario_entrega_e: formData.ecomentario_entrega_e || undefined,
      e_firma_recibe_vendedora: firmaUrl,
    }

    console.log("[v0] Empaque Finish - Updates payload:", updates)

    await onFinish(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageCheck className="size-5 text-emerald-600" />
            Entregar Empaque
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Al guardar
            se registrara la fecha de hoy en <strong>efecha_de_empaque</strong>{" "}
            y la orden se marcara como 100% completada.
          </DialogDescription>
        </DialogHeader>

        {fetchError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="emotivo_demora_terminado_e" className="text-sm">
              Motivo de Demora
            </Label>
            <Select
              value={formData.emotivo_demora_terminado_e}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  emotivo_demora_terminado_e: value,
                })
              }
              disabled={loadingMotivos}
            >
              <SelectTrigger id="emotivo_demora_terminado_e">
                <SelectValue
                  placeholder={
                    loadingMotivos
                      ? "Cargando motivos..."
                      : "Selecciona un motivo (si aplica)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingMotivos && (
                  <SelectItem value="__none__" disabled>
                    No hay motivos disponibles
                  </SelectItem>
                )}
                {motivosDemora.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comentario de entrega */}
          <div className="space-y-2">
            <Label htmlFor="ecomentario_entrega_e" className="text-sm">
              Comentarios de Entrega
            </Label>
            <Textarea
              id="ecomentario_entrega_e"
              placeholder="Observaciones finales sobre la entrega del empaque..."
              rows={5}
              value={formData.ecomentario_entrega_e}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ecomentario_entrega_e: e.target.value,
                }))
              }
            />
          </div>

          <Separator />

          {/* Firma de la vendedora - obligatoria para confirmar recepcion */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <PenLine className="size-3.5 text-icon-magenta" />
              Firma de Vendedora (Recibe pedido empacado)
              <span className="text-destructive">*</span>
            </Label>
            <SignaturePad
              ref={signatureRef}
              onChange={setSignatureEmpty}
              ariaLabel={`Firma de la vendedora que recibe el pedido empacado ${orden.pedido}`}
            />
            <p className="text-xs text-muted-foreground">
              La vendedora debe firmar para confirmar que recibe el pedido
              empacado. La firma se guarda como evidencia de la transferencia.
            </p>
          </div>

          <Separator />

          {/* Auto-calculated preview */}
          <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Valor calculado automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-emerald-700" />
              <span className="text-muted-foreground">
                Fecha de Empaque (efecha_de_empaque):
              </span>
              <span className="font-medium text-emerald-900">
                {formatDate(todayISO)}
              </span>
            </div>
            {orden.enombre_de_quien_empaca && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Empacado por:</span>
                <span className="font-medium">
                  {orden.enombre_de_quien_empaca}
                </span>
              </div>
            )}
            <p className="text-xs text-emerald-800 pt-1 border-t border-emerald-200 mt-2">
              Esta accion marcara la orden como 100% completada. El flujo
              Diseno - Corte - Impresion - Sublimacion - Costura - Empaque queda
              cerrado.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || signatureEmpty}
              title={
                signatureEmpty
                  ? "La vendedora debe firmar para confirmar"
                  : undefined
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Guardando...
                </>
              ) : (
                <>
                  <PackageCheck className="mr-2 size-4" />
                  Confirmar Entrega
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
