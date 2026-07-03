"use client"

import { useEffect, useState } from "react"
import {
  Orden,
  EMBELLECIMIENTO_OPTIONS,
  TIPO_PREDISENO_OPTIONS,
  MAQUINA_COSTURA_OPTIONS,
  TIPO_FLUJO_ESPECIAL_OPTIONS,
  ACCESORIOS_INVENTARIO_OPTIONS,
  type TipoFlujoEspecial,
} from "@/lib/types"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CalendarClock,
  Flame,
  Loader2,
  Package,
  Ruler,
  Save,
  Scissors,
  Sparkles,
  Warehouse,
  Workflow,
  X,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { addDaysSkippingSundays, formatDateLong } from "@/lib/date-utils"

/**
 * Payload que emite el modal al guardar una reprogramacion.
 * Incluye fecha, flags de flujo, fechas objetivo recalculadas y todos
 * los campos de configuracion de orden que el planner puede modificar.
 */
export interface ReprogramPayload {
  fecha_programacion: string
  observaciones_planner: string
  solo_corte_costura: boolean
  omite_corte_costura: boolean
  tipo_flujo_especial?: TipoFlujoEspecial
  accesorios_inventario?: string
  embellecimiento?: string
  tipo_prediseno?: string
  es_marker_digital_si_no?: boolean
  personalizado_si_no?: boolean
  es_urgente?: boolean
  costura_si_no?: boolean
  maquina_costura?: string
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
  const [tipoFlujo, setTipoFlujo] = useState<TipoFlujoEspecial>(
    orden.tipo_flujo_especial || "PRODUCCION_NORMAL"
  )
  const [accesoriosSeleccionados, setAccesoriosSeleccionados] = useState<string[]>(
    () => {
      if (!orden.accesorios_inventario) return []
      return orden.accesorios_inventario
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  )
  const [formData, setFormData] = useState({
    fecha_programacion: orden.fecha_programacion || "",
    observaciones_planner: orden.observaciones_planner || "",
    solo_corte_costura: orden.solo_corte_costura || false,
    omite_corte_costura: orden.omite_corte_costura || false,
    embellecimiento: orden.embellecimiento || "",
    tipo_prediseno: orden.tipo_prediseno || "",
    es_marker_digital_si_no: orden.es_marker_digital_si_no || false,
    personalizado_si_no: orden.personalizado_si_no || false,
    es_urgente: orden.es_urgente || false,
    costura_si_no: orden.costura_si_no || false,
    maquina_costura: orden.maquina_costura || "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTipoFlujo(orden.tipo_flujo_especial || "PRODUCCION_NORMAL")
      setAccesoriosSeleccionados(() => {
        if (!orden.accesorios_inventario) return []
        return orden.accesorios_inventario
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      })
      setFormData({
        fecha_programacion: orden.fecha_programacion || "",
        observaciones_planner: orden.observaciones_planner || "",
        solo_corte_costura: orden.solo_corte_costura || false,
        omite_corte_costura: orden.omite_corte_costura || false,
        embellecimiento: orden.embellecimiento || "",
        tipo_prediseno: orden.tipo_prediseno || "",
        es_marker_digital_si_no: orden.es_marker_digital_si_no || false,
        personalizado_si_no: orden.personalizado_si_no || false,
        es_urgente: orden.es_urgente || false,
        costura_si_no: orden.costura_si_no || false,
        maquina_costura: orden.maquina_costura || "",
      })
    }
  }, [open, orden])

  const toggleAccesorio = (accesorio: string) => {
    setAccesoriosSeleccionados((prev) =>
      prev.includes(accesorio)
        ? prev.filter((a) => a !== accesorio)
        : [...prev, accesorio]
    )
  }

  const handleCheckboxChange = (field: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
      ...(field === "costura_si_no" && prev.costura_si_no
        ? { maquina_costura: "" }
        : {}),
    }))
  }

  const canSubmit = formData.fecha_programacion.length > 0 && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const fechaBase = formData.fecha_programacion
      const fechaEntregaYMD = orden.fecha_de_entrega
        ? String(orden.fecha_de_entrega).slice(0, 10)
        : undefined
      const useUrgentDates = formData.es_urgente && Boolean(fechaEntregaYMD)

      const skipDesignPrint = formData.solo_corte_costura
      const skipCorteCostura = formData.omite_corte_costura

      const targetDiseno = skipDesignPrint
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 3)

      const targetCorte = skipCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 3)

      const targetImpresion = skipDesignPrint
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 4)

      const targetSublimacion = skipDesignPrint
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 5)

      const targetCostura = skipCorteCostura
        ? undefined
        : useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 6)

      const targetEmpaque = useUrgentDates
        ? (fechaEntregaYMD as string)
        : addDaysSkippingSundays(fechaBase, 8)

      const accesoriosCsv =
        tipoFlujo === "VENTA_INVENTARIO" && accesoriosSeleccionados.length > 0
          ? accesoriosSeleccionados.join(", ")
          : undefined

      await onReprogram({
        ...formData,
        tipo_flujo_especial: tipoFlujo,
        accesorios_inventario: accesoriosCsv,
        maquina_costura: formData.costura_si_no ? formData.maquina_costura : undefined,
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
              Modifica la fecha y configuración de{" "}
              <span className="font-semibold">{orden.pedido}</span>. Las fechas
              objetivo se recalcularán automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Fecha actual */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">
                Fecha de Programación Actual
              </Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {formatDateLong(orden.fecha_programacion)}
              </div>
            </div>

            {/* Nueva fecha */}
            <div className="grid gap-2">
              <Label htmlFor="fecha_programacion">
                Nueva Fecha de Programación{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha_programacion"
                type="date"
                value={formData.fecha_programacion}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fecha_programacion: e.target.value,
                  }))
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Tipo de Operación */}
            <div className="space-y-3 rounded-lg border border-icon-cyan/30 bg-cyan-50/40 p-4">
              <div className="flex items-start gap-2">
                <Workflow className="mt-0.5 size-4 text-icon-cyan" />
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-semibold text-cyan-900">
                    Tipo de Operación
                  </Label>
                  <p className="text-xs text-cyan-900/70">
                    Determina por qué módulos pasará la orden.
                  </p>
                </div>
              </div>
              <RadioGroup
                value={tipoFlujo}
                onValueChange={(value) => {
                  const next = value as TipoFlujoEspecial
                  setTipoFlujo(next)
                  if (next !== "VENTA_INVENTARIO") {
                    setAccesoriosSeleccionados([])
                  }
                }}
                className="space-y-2"
              >
                {TIPO_FLUJO_ESPECIAL_OPTIONS.map((opt) => {
                  const Icon =
                    opt.value === "PRODUCCION_NORMAL"
                      ? Workflow
                      : opt.value === "COMPRA_EXTERNA"
                      ? Package
                      : opt.value === "YARDAJE"
                      ? Ruler
                      : Warehouse
                  const isSelected = tipoFlujo === opt.value
                  return (
                    <label
                      key={opt.value}
                      htmlFor={`tipo_flujo_reprogram_${opt.value}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 transition-colors ${
                        isSelected
                          ? "border-icon-cyan ring-1 ring-icon-cyan/40"
                          : "border-border hover:border-icon-cyan/40"
                      }`}
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`tipo_flujo_reprogram_${opt.value}`}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-icon-cyan" />
                          <span className="text-sm font-medium">{opt.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </RadioGroup>

              {tipoFlujo === "VENTA_INVENTARIO" && (
                <div className="rounded-md border border-icon-coral/30 bg-rose-50/40 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-4 text-icon-coral" />
                    <div className="flex-1 space-y-1">
                      <Label className="text-sm font-semibold text-rose-900">
                        ¿Requiere aplicación de accesorios?
                      </Label>
                      <p className="text-xs text-rose-900/70">
                        Si marcas alguno, la orden pasará por Sublimación antes
                        de Empaque.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ACCESORIOS_INVENTARIO_OPTIONS.map((accesorio) => {
                      const checked = accesoriosSeleccionados.includes(accesorio)
                      return (
                        <label
                          key={accesorio}
                          htmlFor={`accesorio_reprogram_${accesorio}`}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors ${
                            checked
                              ? "border-icon-coral bg-rose-50"
                              : "border-border hover:border-icon-coral/40"
                          }`}
                        >
                          <Checkbox
                            id={`accesorio_reprogram_${accesorio}`}
                            checked={checked}
                            onCheckedChange={() => toggleAccesorio(accesorio)}
                          />
                          <span className="font-medium">{accesorio}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Flujo reducido */}
            <label
              htmlFor="solo_corte_costura_reprogram"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                formData.solo_corte_costura
                  ? "border-amber-400 bg-amber-50"
                  : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
              } ${formData.omite_corte_costura ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Checkbox
                id="solo_corte_costura_reprogram"
                checked={formData.solo_corte_costura}
                onCheckedChange={() => handleCheckboxChange("solo_corte_costura")}
                className="mt-0.5"
                disabled={isSubmitting || formData.omite_corte_costura}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-amber-700" />
                  <span className="text-sm font-semibold text-amber-900">
                    NO requiere Diseño / Impresión / Sublimación
                  </span>
                </div>
                <p className="text-xs text-amber-800/80">
                  La orden solo pasa por Corte, Costura y Empaque.
                </p>
              </div>
            </label>

            {/* Omite corte y costura */}
            <label
              htmlFor="omite_corte_costura_reprogram"
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                formData.omite_corte_costura
                  ? "border-sky-400 bg-sky-50"
                  : "border-sky-200 bg-sky-50/40 hover:bg-sky-50/70"
              } ${formData.solo_corte_costura ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Checkbox
                id="omite_corte_costura_reprogram"
                checked={formData.omite_corte_costura}
                onCheckedChange={() => handleCheckboxChange("omite_corte_costura")}
                className="mt-0.5"
                disabled={isSubmitting || formData.solo_corte_costura}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-sky-700" />
                  <span className="text-sm font-semibold text-sky-900">
                    OMITIR Corte y Costura
                  </span>
                </div>
                <p className="text-xs text-sky-800/80">
                  La orden no aparecerá en Corte ni Costura; sí en Diseño,
                  Impresión, Sublimación y Empaque.
                </p>
              </div>
            </label>

            {/* Embellecimiento */}
            <div className="space-y-2">
              <Label htmlFor="embellecimiento_reprogram">Embellecimiento</Label>
              <Select
                value={formData.embellecimiento}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, embellecimiento: value }))
                }
              >
                <SelectTrigger id="embellecimiento_reprogram" className="w-full">
                  <SelectValue placeholder="Seleccione embellecimiento" />
                </SelectTrigger>
                <SelectContent>
                  {EMBELLECIMIENTO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Prediseño */}
            <div className="space-y-2">
              <Label htmlFor="tipo_prediseno_reprogram">Tipo de Prediseño</Label>
              <Select
                value={formData.tipo_prediseno}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, tipo_prediseno: value }))
                }
              >
                <SelectTrigger id="tipo_prediseno_reprogram" className="w-full">
                  <SelectValue placeholder="Seleccione tipo de prediseño" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_PREDISENO_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opciones */}
            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-sm font-medium">Opciones</Label>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="es_marker_digital_reprogram"
                  checked={formData.es_marker_digital_si_no}
                  onCheckedChange={() =>
                    handleCheckboxChange("es_marker_digital_si_no")
                  }
                />
                <Label
                  htmlFor="es_marker_digital_reprogram"
                  className="font-normal cursor-pointer"
                >
                  Es Marker Digital
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="personalizado_reprogram"
                  checked={formData.personalizado_si_no}
                  onCheckedChange={() =>
                    handleCheckboxChange("personalizado_si_no")
                  }
                />
                <Label
                  htmlFor="personalizado_reprogram"
                  className="font-normal cursor-pointer"
                >
                  Personalizado
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="es_urgente_reprogram"
                  checked={formData.es_urgente}
                  onCheckedChange={() => handleCheckboxChange("es_urgente")}
                />
                <Label
                  htmlFor="es_urgente_reprogram"
                  className="font-normal cursor-pointer"
                >
                  Es Urgente
                </Label>
              </div>

              {formData.es_urgente && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <Flame className="size-4 text-amber-700" />
                  <AlertDescription className="text-amber-900">
                    <strong>Nota:</strong> Al ser urgente, todas las áreas
                    tendrán como fecha objetivo la fecha de entrega al cliente
                    {orden.fecha_de_entrega ? (
                      <>
                        {" "}(
                        <strong>{formatDateLong(orden.fecha_de_entrega)}</strong>
                        ).
                      </>
                    ) : (
                      <>
                        .{" "}
                        <span className="font-medium">
                          Esta orden no tiene fecha de entrega registrada, se
                          usarán los lead times estándar como respaldo.
                        </span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="costura_reprogram"
                  checked={formData.costura_si_no}
                  onCheckedChange={() => handleCheckboxChange("costura_si_no")}
                />
                <Label
                  htmlFor="costura_reprogram"
                  className="font-normal cursor-pointer"
                >
                  Pasa por Costura
                </Label>
              </div>

              {formData.costura_si_no && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="maquina_costura_reprogram">
                    Máquina de Costura
                  </Label>
                  <Select
                    value={formData.maquina_costura}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        maquina_costura: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="maquina_costura_reprogram"
                      className="w-full"
                    >
                      <SelectValue placeholder="Seleccione máquina" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAQUINA_COSTURA_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div className="grid gap-2">
              <Label htmlFor="observaciones_reprogram">
                Observaciones del Planner
              </Label>
              <Textarea
                id="observaciones_reprogram"
                value={formData.observaciones_planner}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    observaciones_planner: e.target.value,
                  }))
                }
                placeholder="Motivo de la reprogramación, cambios con el cliente, etc."
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
              Guardar Reprogramación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
