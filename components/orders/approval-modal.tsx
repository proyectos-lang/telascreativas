"use client"

import { useState } from "react"
import {
  Orden,
  EMBELLECIMIENTO_OPTIONS,
  TIPO_PREDISENO_OPTIONS,
  MAQUINA_COSTURA_OPTIONS,
  TIPO_FLUJO_ESPECIAL_OPTIONS,
  ACCESORIOS_INVENTARIO_OPTIONS,
  type TipoFlujoEspecial,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  Loader2,
  Save,
  X,
  Scissors,
  Flame,
  Workflow,
  Package,
  Warehouse,
  Sparkles,
  Ruler,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { addDaysSkippingSundays, formatDateLong } from "@/lib/date-utils"

interface ApprovalModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onApprove: (data: Partial<Orden>) => Promise<void>
}

export function ApprovalModal({
  orden,
  open,
  onClose,
  onApprove,
}: ApprovalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // tipo_flujo_especial vive en su propio estado porque es un radio
  // (mutuamente excluyente) y porque controla la visibilidad de los
  // checkboxes de accesorios. Si la orden no tiene un valor asignado,
  // se asume PRODUCCION_NORMAL como default seguro.
  const [tipoFlujo, setTipoFlujo] = useState<TipoFlujoEspecial>(
    orden.tipo_flujo_especial || "PRODUCCION_NORMAL"
  )
  // Lista de accesorios marcados cuando el flujo es VENTA_INVENTARIO.
  // Se hidrata parseando el CSV existente (si lo hay) en accesorios_inventario.
  const [accesoriosSeleccionados, setAccesoriosSeleccionados] = useState<
    string[]
  >(() => {
    if (!orden.accesorios_inventario) return []
    return orden.accesorios_inventario
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  })
  const [formData, setFormData] = useState({
    fecha_programacion: orden.fecha_programacion || "",
    embellecimiento: orden.embellecimiento || "",
    tipo_prediseno: orden.tipo_prediseno || "",
    es_marker_digital_si_no: orden.es_marker_digital_si_no || false,
    personalizado_si_no: orden.personalizado_si_no || false,
    es_urgente: orden.es_urgente || false,
    costura_si_no: orden.costura_si_no || false,
    maquina_costura: orden.maquina_costura || "",
    observaciones_planner: orden.observaciones_planner || "",
    // Flujo reducido: saltea Diseno, Impresion y Sublimacion
    solo_corte_costura: orden.solo_corte_costura || false,
    // Flujo alterno: omite Corte y Costura (la orden no aparece en
    // esos modulos pero si en Diseno, Impresion, Sublimacion y Empaque).
    omite_corte_costura: orden.omite_corte_costura || false,
  })

  /**
   * Toggle de un accesorio dentro del set seleccionado. Mantiene la lista
   * sin duplicados y permite des-marcar.
   */
  const toggleAccesorio = (accesorio: string) => {
    setAccesoriosSeleccionados((prev) =>
      prev.includes(accesorio)
        ? prev.filter((a) => a !== accesorio)
        : [...prev, accesorio]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Calculo de fechas objetivo:
    //
    // 1) Orden URGENTE (es_urgente === true) y con fecha_de_entrega definida:
    //    todas las fechas objetivo se igualan a la fecha pactada con el
    //    cliente (fecha_de_entrega). Esto fuerza a TODAS las areas a
    //    trabajar contra ese deadline en lugar del lead time estandar.
    //
    // 2) Orden NORMAL (es_urgente === false) o urgente sin fecha_de_entrega:
    //    se calcula con los lead times estandar en dias habiles (excluyendo
    //    domingos) sobre la fecha_programacion:
    //      Diseno: +3d | Corte: +3d | Impresion: +5d | Sublimacion: +4d | Costura: +6d
    //
    // En ambos casos, si solo_corte_costura esta activo, los objetivos de
    // Diseno, Impresion y Sublimacion se omiten (null) porque la orden no
    // pasara por esas areas.
    const fechaBase = formData.fecha_programacion
    const skipDesignPrint = formData.solo_corte_costura
    // Normalizamos fecha_de_entrega a YYYY-MM-DD para mantener consistencia
    // con el formato que devuelve addDaysSkippingSundays.
    const fechaEntregaYMD = orden.fecha_de_entrega
      ? String(orden.fecha_de_entrega).slice(0, 10)
      : undefined
    const useUrgentDates = formData.es_urgente && Boolean(fechaEntregaYMD)

    // Si la orden OMITE Corte y Costura, las fechas objetivo de esas
    // dos areas se envian como null para limpiar valores previos.
    const skipCorteCostura = formData.omite_corte_costura

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

    const targetDiseno = skipDesignPrint
      ? null
      : useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 3)

    const targetCorte = skipCorteCostura
      ? null
      : useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 3)

    const targetImpresion = skipDesignPrint
      ? null
      : useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 4)

    const targetSublimacion = skipDesignPrint
      ? null
      : useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 5)

    const targetCostura = skipCorteCostura
      ? null
      : useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 6)

    const targetEmpaque = useUrgentDates
      ? (fechaEntregaYMD as string)
      : addDaysSkippingSundays(fechaBase, 8)

    // Construye el CSV de accesorios. Solo se persiste cuando el flujo
    // es VENTA_INVENTARIO; en cualquier otro caso se manda undefined
    // para limpiar el valor previo (p. ej. si el planner cambio el flujo
    // despues de haber marcado accesorios).
    const accesoriosCsv =
      tipoFlujo === "VENTA_INVENTARIO" && accesoriosSeleccionados.length > 0
        ? accesoriosSeleccionados.join(", ")
        : undefined

    const dataToSubmit: Partial<Orden> = {
      ...formData,
      estado_aprobado_rechazado: "Aprobado",
      // Fechas objetivo calculadas automaticamente. Si el flujo omite
      // alguna area, su fecha objetivo se manda como undefined para
      // limpiar el valor previo en BD.
      dfecha_objetivo_d: targetDiseno ?? undefined,
      cfecha_objetivo_c: targetCorte ?? undefined,
      ifecha_objetivo_i: targetImpresion ?? undefined,
      sfecha_objetivo_s: targetSublimacion ?? undefined,
      cosfecha_objetivo_cs: targetCostura ?? undefined,
      efecha_objetivo_e: targetEmpaque,
      // Tipo de flujo especial seleccionado en el RadioGroup. Decide en
      // que modulos de produccion sera visible la orden.
      tipo_flujo_especial: tipoFlujo,
      // Accesorios solo aplican a VENTA_INVENTARIO; para los demas flujos
      // se persiste undefined para limpiar valores previos.
      accesorios_inventario: accesoriosCsv,
    }

    // Clear maquina_costura if costura is not selected
    if (!formData.costura_si_no) {
      dataToSubmit.maquina_costura = undefined
    }

    await onApprove(dataToSubmit)
    setIsSubmitting(false)
    onClose()
  }

  const handleCheckboxChange = (field: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
      // Clear maquina_costura when costura is unchecked
      ...(field === "costura_si_no" && prev.costura_si_no
        ? { maquina_costura: "" }
        : {}),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprobar Orden {orden.pedido}</DialogTitle>
          <DialogDescription>
            Complete los datos de programacion para aprobar esta orden.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Operacion: define el flujo que seguira la orden y
              que modulos de produccion la mostraran. Es lo primero que
              ve el planner porque condiciona el resto del formulario. */}
          <div className="space-y-3 rounded-lg border border-icon-cyan/30 bg-cyan-50/40 p-4">
            <div className="flex items-start gap-2">
              <Workflow className="mt-0.5 size-4 text-icon-cyan" />
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-semibold text-cyan-900">
                  Tipo de Operacion
                </Label>
                <p className="text-xs text-cyan-900/70">
                  Determina por que modulos pasara la orden.
                </p>
              </div>
            </div>
            <RadioGroup
              value={tipoFlujo}
              onValueChange={(value) => {
                const next = value as TipoFlujoEspecial
                setTipoFlujo(next)
                // Al cambiar a un flujo distinto a VENTA_INVENTARIO,
                // limpiamos los accesorios para evitar guardarlos por
                // error cuando el planner cambia de opinion.
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
                    htmlFor={`tipo_flujo_${opt.value}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 transition-colors ${
                      isSelected
                        ? "border-icon-cyan ring-1 ring-icon-cyan/40"
                        : "border-border hover:border-icon-cyan/40"
                    }`}
                  >
                    <RadioGroupItem
                      value={opt.value}
                      id={`tipo_flujo_${opt.value}`}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-icon-cyan" />
                        <span className="text-sm font-medium">
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>

            {/* Checkboxes condicionales: solo aparecen cuando el flujo
                seleccionado es VENTA_INVENTARIO. El planner marca uno o
                varios accesorios; se guardan como CSV en BD. */}
            {tipoFlujo === "VENTA_INVENTARIO" && (
              <div className="rounded-md border border-icon-coral/30 bg-rose-50/40 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 text-icon-coral" />
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm font-semibold text-rose-900">
                      Requiere aplicacion de accesorios?
                    </Label>
                    <p className="text-xs text-rose-900/70">
                      Si marcas alguno, la orden pasara por Sublimacion
                      antes de Empaque. Si dejas todos vacios, ira directo
                      a Empaque y Entregas.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ACCESORIOS_INVENTARIO_OPTIONS.map((accesorio) => {
                    const checked = accesoriosSeleccionados.includes(accesorio)
                    return (
                      <label
                        key={accesorio}
                        htmlFor={`accesorio_${accesorio}`}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors ${
                          checked
                            ? "border-icon-coral bg-rose-50"
                            : "border-border hover:border-icon-coral/40"
                        }`}
                      >
                        <Checkbox
                          id={`accesorio_${accesorio}`}
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

          <div className="space-y-2">
            <Label htmlFor="fecha_programacion">Fecha de Programacion</Label>
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
            />
          </div>

          {/* Flujo reducido: salta Diseno / Impresion / Sublimacion */}
          <label
            htmlFor="solo_corte_costura"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              formData.solo_corte_costura
                ? "border-amber-400 bg-amber-50"
                : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
            } ${formData.omite_corte_costura ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Checkbox
              id="solo_corte_costura"
              checked={formData.solo_corte_costura}
              onCheckedChange={() =>
                handleCheckboxChange("solo_corte_costura")
              }
              className="mt-0.5"
              disabled={formData.omite_corte_costura}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-amber-700" />
                <span className="text-sm font-semibold text-amber-900">
                  NO requiere Diseno / Impresion / Sublimacion
                </span>
              </div>
              <p className="text-xs text-amber-800/80">
                Marca esta opcion cuando la orden solo pasa por Corte, Costura
                y Empaque. Se omitiran las fechas objetivo de las areas
                saltadas.
              </p>
            </div>
          </label>

          {/* Flujo alterno: OMITE Corte y Costura. La orden seguira pasando
              por Diseno, Impresion, Sublimacion y Empaque pero NO aparecera
              en los listados de Corte ni Costura. Mutuamente excluyente con
              solo_corte_costura. */}
          <label
            htmlFor="omite_corte_costura"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              formData.omite_corte_costura
                ? "border-sky-400 bg-sky-50"
                : "border-sky-200 bg-sky-50/40 hover:bg-sky-50/70"
            } ${formData.solo_corte_costura ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Checkbox
              id="omite_corte_costura"
              checked={formData.omite_corte_costura}
              onCheckedChange={() =>
                handleCheckboxChange("omite_corte_costura")
              }
              className="mt-0.5"
              disabled={formData.solo_corte_costura}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-sky-700" />
                <span className="text-sm font-semibold text-sky-900">
                  OMITIR Corte y Costura
                </span>
              </div>
              <p className="text-xs text-sky-800/80">
                Marca esta opcion cuando la orden NO debe pasar por las areas
                de Corte ni Costura (por ejemplo: yardaje sin costura). La
                orden seguira visible en Diseno, Impresion, Sublimacion y
                Empaque.
              </p>
            </div>
          </label>

          <div className="space-y-2">
            <Label htmlFor="embellecimiento">Embellecimiento</Label>
            <Select
              value={formData.embellecimiento}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, embellecimiento: value }))
              }
            >
              <SelectTrigger className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="tipo_prediseno">Tipo de Prediseno</Label>
            <Select
              value={formData.tipo_prediseno}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, tipo_prediseno: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione tipo de prediseno" />
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

          <div className="space-y-3 rounded-lg border p-4">
            <Label className="text-sm font-medium">Opciones</Label>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="es_marker_digital"
                checked={formData.es_marker_digital_si_no}
                onCheckedChange={() => handleCheckboxChange("es_marker_digital_si_no")}
              />
              <Label htmlFor="es_marker_digital" className="font-normal cursor-pointer">
                Es Marker Digital
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="personalizado"
                checked={formData.personalizado_si_no}
                onCheckedChange={() => handleCheckboxChange("personalizado_si_no")}
              />
              <Label htmlFor="personalizado" className="font-normal cursor-pointer">
                Personalizado
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="es_urgente"
                checked={formData.es_urgente}
                onCheckedChange={() => handleCheckboxChange("es_urgente")}
              />
              <Label htmlFor="es_urgente" className="font-normal cursor-pointer">
                Es Urgente
              </Label>
            </div>

            {/* Aviso al planner: cuando la orden es urgente, todas las
                areas trabajaran contra la fecha pactada con el cliente. */}
            {formData.es_urgente && (
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="costura"
                checked={formData.costura_si_no}
                onCheckedChange={() => handleCheckboxChange("costura_si_no")}
              />
              <Label htmlFor="costura" className="font-normal cursor-pointer">
                Pasa por Costura
              </Label>
            </div>

            {formData.costura_si_no && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="maquina_costura">Maquina de Costura</Label>
                <Select
                  value={formData.maquina_costura}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, maquina_costura: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione maquina" />
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

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones del Planner</Label>
            <Textarea
              id="observaciones"
              placeholder="Ingrese observaciones..."
              value={formData.observaciones_planner}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  observaciones_planner: e.target.value,
                }))
              }
              rows={3}
            />
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
                <Save className="mr-1 size-4" />
              )}
              Guardar Aprobacion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
