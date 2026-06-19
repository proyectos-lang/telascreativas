"use client"

import { useEffect, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarClock, Flame, Loader2, Save, Scissors, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { addDaysSkippingSundays } from "@/lib/date-utils"
import { formatDateLong } from "@/lib/date-utils"

/**
 * Payload que emite el modal al aprobar una reprogramacion.
 * Contiene la nueva fecha_programacion, las observaciones del planner,
 * los flags de flujo (solo_corte_costura, omite_corte_costura) y TODAS
 * las fechas objetivo recalculadas.
 */
export interface ReprogramPayload {
  fecha_programacion: string
  observaciones_planner: string
  solo_corte_costura: boolean
  omite_corte_costura: boolean
  dfecha_objetivo_d?: string
  cfecha_objetivo_c?: string
  ifecha_objetivo_i?: string
  sfecha_objetivo_s?: string
  cosfecha_objetivo_cs?: string
  efecha_objetivo_e?: string
}

interface ReprogramModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReprogram: (data: ReprogramPayload) => Promise<void>
}

export function ReprogramModal({
  orden,
  open,
  onClose,
  onReprogram,
}: ReprogramModalProps) {
  const [fechaProgramacion, setFechaProgramacion] = useState(
    orden.fecha_programacion || ""
  )
  const [observaciones, setObservaciones] = useState(
    orden.observaciones_planner || ""
  )
  const [soloCorteCostura, setSoloCorteCostura] = useState(
    orden.solo_corte_costura || false
  )
  const [omiteCorteCostura, setOmiteCorteCostura] = useState(
    orden.omite_corte_costura || false
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Al reabrir el modal, resetea los valores a los actuales de la orden.
  useEffect(() => {
    if (open) {
      setFechaProgramacion(orden.fecha_programacion || "")
      setObservaciones(orden.observaciones_planner || "")
      setSoloCorteCostura(orden.solo_corte_costura || false)
      setOmiteCorteCostura(orden.omite_corte_costura || false)
    }
  }, [open, orden])

  const canSubmit = fechaProgramacion.length > 0 && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      // Recalcula TODAS las fechas objetivo respetando la regla de urgencia:
      //   - Si la orden es URGENTE y tiene fecha_de_entrega, todas las
      //     areas adoptan ese deadline como objetivo.
      //   - En caso contrario, se aplican los lead times estandar
      //     (excluyendo domingos) sobre la nueva fecha_programacion.
      // Si solo_corte_costura esta activo, las areas saltadas se envian
      // como undefined para limpiar valores previos.
      const fechaBase = fechaProgramacion
      const fechaEntregaYMD = orden.fecha_de_entrega
        ? String(orden.fecha_de_entrega).slice(0, 10)
        : undefined
      const useUrgentDates =
        Boolean(orden.es_urgente) && Boolean(fechaEntregaYMD)

      // Calculo PLANO de fechas objetivo: cada area suma sus dias habiles
      // directamente sobre fechaBase (fecha_programacion), de forma
      // independiente. Para ordenes urgentes con fecha_de_entrega todas
      // las areas adoptan ese deadline directamente.
      //   Diseno:     fechaBase + 3d
      //   Corte:      fechaBase + 3d
      //   Impresion:  fechaBase + 4d
      //   Sublimacion:fechaBase + 5d
      //   Costura:    fechaBase + 6d
      //   Empaque:    fechaBase + 8d

      const targetDiseno = soloCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 3)

      const targetCorte = omiteCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 3)

      const targetImpresion = soloCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 4)

      const targetSublimacion = soloCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 5)

      const targetCostura = omiteCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 6)

      const targetEmpaque = useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 8)

      await onReprogram({
        fecha_programacion: fechaBase,
        observaciones_planner: observaciones,
        solo_corte_costura: soloCorteCostura,
        omite_corte_costura: omiteCorteCostura,
        dfecha_objetivo_d: targetDiseno,
        cfecha_objetivo_c: targetCorte,
        ifecha_objetivo_i: targetImpresion,
        sfecha_objetivo_s: targetSublimacion,
        cosfecha_objetivo_cs: targetCostura,
        efecha_objetivo_e: targetEmpaque,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-icon-cyan" />
              Reprogramar Orden
            </DialogTitle>
            <DialogDescription>
              Cambia la fecha de programacion de{" "}
              <span className="font-semibold">{orden.pedido}</span>. Todas las
              fechas objetivo de produccion se recalcularan automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">
                Fecha de Programacion Actual
              </Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {formatDateLong(orden.fecha_programacion)}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fecha_programacion">
                Nueva Fecha de Programacion{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha_programacion"
                type="date"
                value={fechaProgramacion}
                onChange={(e) => setFechaProgramacion(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Aviso al planner: cuando la orden es urgente, todas las
                areas trabajaran contra la fecha pactada con el cliente,
                ignorando la nueva fecha de programacion para el calculo
                de objetivos. */}
            {orden.es_urgente && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <Flame className="size-4 text-amber-700" />
                <AlertDescription className="text-amber-900">
                  <strong>Nota:</strong> Al ser una orden urgente, todas las
                  areas tendran como fecha objetivo la fecha de entrega al
                  cliente
                  {orden.fecha_de_entrega ? (
                    <>
                      {" "}
                      (
                      <strong>{formatDateLong(orden.fecha_de_entrega)}</strong>
                      ).
                    </>
                  ) : (
                    <>
                      .{" "}
                      <span className="font-medium">
                        Esta orden no tiene fecha de entrega registrada, se
                        usaran los lead times estandar como respaldo.
                      </span>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Flujo reducido: salta Diseno / Impresion / Sublimacion */}
            <label
              htmlFor="solo_corte_costura_reprogram"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                soloCorteCostura
                  ? "border-amber-400 bg-amber-50"
                  : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
              } ${omiteCorteCostura ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Checkbox
                id="solo_corte_costura_reprogram"
                checked={soloCorteCostura}
                onCheckedChange={() => setSoloCorteCostura((v) => !v)}
                className="mt-0.5"
                disabled={isSubmitting || omiteCorteCostura}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-amber-700" />
                  <span className="text-sm font-semibold text-amber-900">
                    NO requiere Diseno / Impresion / Sublimacion
                  </span>
                </div>
                <p className="text-xs text-amber-800/80">
                  Marca esta opcion cuando la orden solo pasa por Corte,
                  Costura y Empaque. Se omitiran las fechas objetivo de las
                  areas saltadas.
                </p>
              </div>
            </label>

            {/* Flujo alterno: OMITE Corte y Costura. La orden no aparecera
                en los listados de Corte ni Costura. Mutuamente excluyente
                con solo_corte_costura. */}
            <label
              htmlFor="omite_corte_costura_reprogram"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                omiteCorteCostura
                  ? "border-sky-400 bg-sky-50"
                  : "border-sky-200 bg-sky-50/40 hover:bg-sky-50/70"
              } ${soloCorteCostura ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Checkbox
                id="omite_corte_costura_reprogram"
                checked={omiteCorteCostura}
                onCheckedChange={() => setOmiteCorteCostura((v) => !v)}
                className="mt-0.5"
                disabled={isSubmitting || soloCorteCostura}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-sky-700" />
                  <span className="text-sm font-semibold text-sky-900">
                    OMITIR Corte y Costura
                  </span>
                </div>
                <p className="text-xs text-sky-800/80">
                  Marca esta opcion cuando la orden NO debe pasar por Corte
                  ni Costura. Se omitiran las fechas objetivo de esas areas y
                  no apareceran en sus listados.
                </p>
              </div>
            </label>

            <div className="grid gap-2">
              <Label htmlFor="observaciones_planner">
                Observaciones del Planner
              </Label>
              <Textarea
                id="observaciones_planner"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Motivo de la reprogramacion, cambios con el cliente, etc."
                rows={3}
                disabled={isSubmitting}
                className="resize-none"
              />
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
              disabled={!canSubmit}
              className="bg-icon-cyan hover:opacity-90 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Save className="mr-1 size-4" />
              )}
              Guardar Reprogramacion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
