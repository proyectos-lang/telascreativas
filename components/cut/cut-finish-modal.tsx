"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  Loader2,
  X,
  Scissors,
  Calendar,
  CalendarClock,
  AlertTriangle,
} from "lucide-react"

interface CutFinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
}

// Calculate ISO week number of the year (1-53)
function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

// Calculate difference in days between two dates (end - start)
function daysBetween(start: Date, end: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  )
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endDay.getTime() - startDay.getTime()) / MS_PER_DAY)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function CutFinishModal({
  orden,
  open,
  onClose,
  onFinish,
}: CutFinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    cpiezas_cortadas: "",
    cpiezas_malas_o_errores: "",
    cyardas: "",
    cmotivo_demora_terminado_c: orden.cmotivo_demora_terminado_c || "",
    ccomentario_corte: orden.ccomentario_corte || "",
  })

  useEffect(() => {
    if (!open) return
    setFormData({
      cpiezas_cortadas: "",
      cpiezas_malas_o_errores: "",
      cyardas: "",
      cmotivo_demora_terminado_c: orden.cmotivo_demora_terminado_c || "",
      ccomentario_corte: orden.ccomentario_corte || "",
    })
  }, [open, orden])

  // Load motivos_demora from telas.motivos_demora (field `nombre`)
  useEffect(() => {
    if (!open) return

    const fetchMotivos = async () => {
      setLoadingMotivos(true)
      setFetchError(null)

      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")

      console.log("[v0] CutFinish - Motivos de demora raw:", data)
      console.log("[v0] CutFinish - Error motivos:", error)

      if (error) {
        setFetchError(error.message)
      } else {
        const motivos = (data || [])
          .map(
            (row: Record<string, unknown>) =>
              (row.nombre as string) ||
              (row.motivo as string) ||
              (row.descripcion as string) ||
              ""
          )
          .filter((m: string) => m.length > 0)

        console.log("[v0] CutFinish - Motivos mapeados:", motivos)
        setMotivosDemora(motivos)
      }

      setLoadingMotivos(false)
    }

    fetchMotivos()
  }, [open])

  // Preview calculations
  const today = new Date()
  const semana = getWeekNumber(today)
  const recepcionDate = orden.cfecha_de_recepcion
    ? new Date(orden.cfecha_de_recepcion)
    : null
  const diasEnCorte = recepcionDate ? daysBetween(recepcionDate, today) : null
  const tiempoEnCortePreview =
    diasEnCorte !== null
      ? `${diasEnCorte} ${diasEnCorte === 1 ? "dia" : "dias"}`
      : "-"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const todayDate = new Date()
    const fechaCorte = todayDate.toISOString().split("T")[0]
    const semanaCorte = getWeekNumber(todayDate)
    const tiempoEnCorte =
      diasEnCorte !== null
        ? `${diasEnCorte} ${diasEnCorte === 1 ? "dia" : "dias"}`
        : null

    const updates: Partial<Orden> = {
      cfecha_de_corte: fechaCorte,
      csemana_de_corte: semanaCorte,
      cmotivo_demora_terminado_c:
        formData.cmotivo_demora_terminado_c || undefined,
      ccomentario_corte: formData.ccomentario_corte || undefined,
    }

    if (tiempoEnCorte) {
      updates.ctiempo_en_corte = tiempoEnCorte
    }

    if (formData.cpiezas_cortadas !== "") {
      updates.cpiezas_cortadas = Number(formData.cpiezas_cortadas)
    }
    if (formData.cpiezas_malas_o_errores !== "") {
      updates.cpiezas_malas_o_errores = Number(formData.cpiezas_malas_o_errores)
    }
    if (formData.cyardas !== "") {
      updates.cyardas = Number(formData.cyardas)
    }

    console.log("[v0] CutFinish - Updates a enviar:", updates)

    await onFinish(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="size-5 text-emerald-600" />
              Terminar Corte - {orden.pedido}
            </DialogTitle>
            <DialogDescription>
              Registra los datos finales del corte. La fecha, semana y tiempo en
              corte se calcularan automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {fetchError && (
              <Alert
                variant="destructive"
                className="border-destructive/30 bg-destructive/5"
              >
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Error al cargar motivos de demora: {fetchError}
                </AlertDescription>
              </Alert>
            )}

            {/* Production numbers */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cpiezas_cortadas" className="text-sm">
                  Piezas Cortadas
                </Label>
                <Input
                  id="cpiezas_cortadas"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formData.cpiezas_cortadas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cpiezas_cortadas: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpiezas_malas_o_errores" className="text-sm">
                  Piezas Malas / Errores
                </Label>
                <Input
                  id="cpiezas_malas_o_errores"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formData.cpiezas_malas_o_errores}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cpiezas_malas_o_errores: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cyardas" className="text-sm">
                  Yardas Usadas
                </Label>
                <Input
                  id="cyardas"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.cyardas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cyardas: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Motivo de Demora (guardado en cmotivo_demora_terminado_c) */}
            <div className="space-y-2">
              <Label
                htmlFor="cmotivo_demora_terminado_c"
                className="text-sm"
              >
                Motivo de Demora
              </Label>
              <Select
                value={formData.cmotivo_demora_terminado_c}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    cmotivo_demora_terminado_c: value,
                  })
                }
                disabled={loadingMotivos}
              >
                <SelectTrigger id="cmotivo_demora_terminado_c">
                  <SelectValue
                    placeholder={
                      loadingMotivos
                        ? "Cargando motivos..."
                        : "Selecciona un motivo (opcional)"
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

            {/* Comentario de Corte (guardado en ccomentario_corte) */}
            <div className="space-y-2">
              <Label htmlFor="ccomentario_corte" className="text-sm">
                Comentario de Corte
              </Label>
              <Textarea
                id="ccomentario_corte"
                placeholder="Observaciones sobre el cierre del corte..."
                rows={4}
                value={formData.ccomentario_corte}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ccomentario_corte: e.target.value,
                  })
                }
              />
            </div>

            <Separator />

            {/* Auto-calculated preview */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calculos automaticos al guardar
              </p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="size-4 text-icon-green mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Fecha de Corte
                    </p>
                    <p className="font-medium">
                      {today.toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="size-4 text-icon-cyan mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tiempo en Corte
                    </p>
                    <p className="font-medium">{tiempoEnCortePreview}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="size-4 text-icon-purple mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Semana del Ano
                    </p>
                    <p className="font-medium">Semana {semana}</p>
                  </div>
                </div>
              </div>
              {!recepcionDate && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Sin fecha de recepcion: no se calculara el tiempo en corte.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 size-4" />
              )}
              Terminar Corte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
