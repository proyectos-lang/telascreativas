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
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Factory,
  Shirt,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface CosturaFinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
}

export function CosturaFinishModal({
  orden,
  open,
  onClose,
  onFinish,
}: CosturaFinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Al TERMINAR se capturan los datos pendientes del proceso del maquilador
  // (proceso, fecha de recepcion) y todos los resultados de costura
  // (novedad, cantidad costurada, motivo de demora recibido, comentario),
  // ademas del cierre formal con motivo de demora terminado y comentario
  // de entrega final.
  const [formData, setFormData] = useState({
    cosproceso_maquilado: "",
    cosfecha_recepcion_maquilador: "",
    cosnovedad_de_costura: "",
    coscantidad_costurada: "",
    cosmotivo_demora_recibido_cs: "",
    coscomentario_costura: "",
    cosmotivo_demora_terminado_cs: "",
    coscomentario_entrega_cs: "",
  })

  // Reset form each time the modal opens. Si los campos del maquilador o
  // de resultados ya tenian valor en la BD (p.ej. correccion posterior),
  // se precargan para no perder informacion.
  useEffect(() => {
    if (!open) return
    setFormData({
      cosproceso_maquilado: orden.cosproceso_maquilado || "",
      cosfecha_recepcion_maquilador: orden.cosfecha_recepcion_maquilador || "",
      cosnovedad_de_costura: orden.cosnovedad_de_costura || "",
      coscantidad_costurada:
        orden.coscantidad_costurada !== undefined &&
        orden.coscantidad_costurada !== null
          ? String(orden.coscantidad_costurada)
          : "",
      cosmotivo_demora_recibido_cs: orden.cosmotivo_demora_recibido_cs || "",
      coscomentario_costura: orden.coscomentario_costura || "",
      cosmotivo_demora_terminado_cs: orden.cosmotivo_demora_terminado_cs || "",
      coscomentario_entrega_cs: orden.coscomentario_entrega_cs || "",
    })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const cantidadCosturadaNum = parseFloat(formData.coscantidad_costurada)

    // Build UPDATE payload - coseta_costura is auto-set to today
    const updates: Partial<Orden> = {
      coseta_costura: todayISO,
      // Datos del maquilador (post-recepcion)
      cosproceso_maquilado: formData.cosproceso_maquilado || undefined,
      cosfecha_recepcion_maquilador:
        formData.cosfecha_recepcion_maquilador || undefined,
      // Resultados de costura
      cosnovedad_de_costura: formData.cosnovedad_de_costura || undefined,
      coscantidad_costurada: !isNaN(cantidadCosturadaNum)
        ? cantidadCosturadaNum
        : undefined,
      cosmotivo_demora_recibido_cs:
        formData.cosmotivo_demora_recibido_cs || undefined,
      coscomentario_costura: formData.coscomentario_costura || undefined,
      // Cierre formal del proceso
      cosmotivo_demora_terminado_cs:
        formData.cosmotivo_demora_terminado_cs || undefined,
      coscomentario_entrega_cs: formData.coscomentario_entrega_cs || undefined,
    }

    await onFinish(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Entregar Costura
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Registre
            el proceso del maquilador, los resultados de costura y el cierre
            del proceso. Al guardar se registrara la fecha de hoy en{" "}
            <strong>coseta_costura</strong>.
          </DialogDescription>
        </DialogHeader>

        {fetchError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Maquilador (proceso + recepcion) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Factory className="size-4 text-icon-coral" />
              Proceso del Maquilador
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cosproceso_maquilado" className="text-sm">
                  Proceso Maquilado
                </Label>
                <Input
                  id="cosproceso_maquilado"
                  type="text"
                  placeholder="Proceso realizado..."
                  value={formData.cosproceso_maquilado}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosproceso_maquilado: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cosfecha_recepcion_maquilador"
                  className="text-sm"
                >
                  Fecha Recepcion del Maquilador
                </Label>
                <Input
                  id="cosfecha_recepcion_maquilador"
                  type="date"
                  value={formData.cosfecha_recepcion_maquilador}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosfecha_recepcion_maquilador: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Resultados de Costura */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shirt className="size-4 text-icon-purple" />
              Resultados de Costura
            </div>
            <div className="space-y-2">
              <Label htmlFor="cosnovedad_de_costura" className="text-sm">
                Novedad de Costura
              </Label>
              <Textarea
                id="cosnovedad_de_costura"
                placeholder="Ingrese las novedades observadas..."
                rows={2}
                value={formData.cosnovedad_de_costura}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cosnovedad_de_costura: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coscantidad_costurada" className="text-sm">
                  Cantidad Costurada
                </Label>
                <Input
                  id="coscantidad_costurada"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={formData.coscantidad_costurada}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      coscantidad_costurada: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cosmotivo_demora_recibido_cs"
                  className="text-sm"
                >
                  Motivo de Demora (Recibido)
                </Label>
                <Select
                  value={formData.cosmotivo_demora_recibido_cs}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      cosmotivo_demora_recibido_cs: value,
                    }))
                  }
                  disabled={loadingMotivos}
                >
                  <SelectTrigger
                    id="cosmotivo_demora_recibido_cs"
                    className="w-full"
                  >
                    <SelectValue
                      placeholder={
                        loadingMotivos
                          ? "Cargando motivos..."
                          : "Seleccione motivo"
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="coscomentario_costura" className="text-sm">
                Comentario de Costura
              </Label>
              <Textarea
                id="coscomentario_costura"
                placeholder="Observaciones adicionales del proceso de costura..."
                rows={3}
                value={formData.coscomentario_costura}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    coscomentario_costura: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <Separator />

          {/* Section 3: Cierre del Proceso */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Cierre del Proceso
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="cosmotivo_demora_terminado_cs"
                className="text-sm"
              >
                Motivo de Demora (Terminado)
              </Label>
              <Select
                value={formData.cosmotivo_demora_terminado_cs}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    cosmotivo_demora_terminado_cs: value,
                  })
                }
                disabled={loadingMotivos}
              >
                <SelectTrigger id="cosmotivo_demora_terminado_cs">
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
            <div className="space-y-2">
              <Label htmlFor="coscomentario_entrega_cs" className="text-sm">
                Comentarios de Entrega
              </Label>
              <Textarea
                id="coscomentario_entrega_cs"
                placeholder="Observaciones finales sobre la entrega de la costura..."
                rows={3}
                value={formData.coscomentario_entrega_cs}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    coscomentario_entrega_cs: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Auto-calculated preview */}
          <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 mb-2">
              Valor calculado automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-emerald-700" />
              <span className="text-muted-foreground">
                Fecha fin de Costura (coseta_costura):
              </span>
              <span className="font-medium text-emerald-900">
                {formatDate(todayISO)}
              </span>
            </div>
            {orden.cosfecha_conteo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Recibido en Costura:</span>
                <span className="font-medium">
                  {formatDate(orden.cosfecha_conteo)}
                </span>
              </div>
            )}
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
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  Entregar Costura
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
