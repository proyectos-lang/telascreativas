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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Thermometer,
  Gauge,
  Timer,
  Layers,
  XCircle,
  PenLine,
  PackagePlus,
  ShirtIcon,
  UserCircle,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { getDaysBetweenSkippingSundays } from "@/lib/date-utils"
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/shared/signature-pad"

// Bucket de Supabase Storage donde se guardan las firmas de transferencia
// entre procesos productivos (Sublimacion -> Costura, etc.).
const SIGNATURE_BUCKET = "firmas-procesos"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

/**
 * Fila simplificada de entrega parcial para el resumen de cierre. Es un
 * subset compatible con `EntregaParcialRow` de sublimation-detail.tsx
 * (no la importamos directo para evitar acoplar el modal al detail).
 */
interface EntregaParcialResumen {
  id?: number
  cantidad: number
  fecha?: string
  producto_detalle?: string | null
  usuario?: string | null
}

interface SublimationFinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
  /**
   * Lista de entregas parciales ya registradas para esta orden. Se
   * muestran como desglose al principio del modal para que la persona
   * de Costura sepa exactamente que esta firmando que recibio.
   */
  entregasParciales?: EntregaParcialResumen[]
}

export function SublimationFinishModal({
  orden,
  open,
  onClose,
  onFinish,
  entregasParciales = [],
}: SublimationFinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // Firma de la persona de Costura que recibe los bultos. Se exige antes
  // de confirmar la entrega (boton bloqueado mientras este vacia).
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const signatureRef = useRef<SignaturePadHandle>(null)

  // Nota: stiempo_sublimacion ya NO es editable, se calcula automaticamente
  // sobre la marcha (dias habiles entre sfecha_de_ingreso_sub y hoy,
  // saltandose los domingos). Por eso lo sacamos del formData.
  const [formData, setFormData] = useState({
    stemperatura: "",
    svelocidad: "",
    scantidad_sublimada: "",
    serrores: "",
    saprobacion_cliente_si_no: false,
    smotivo_demora_terminado_s: "",
    scomentario_entrega_s: "",
  })

  // Reset form each time the modal opens
  useEffect(() => {
    if (!open) return
    setFormData({
      stemperatura:
        orden.stemperatura !== undefined && orden.stemperatura !== null
          ? String(orden.stemperatura)
          : "",
      svelocidad:
        orden.svelocidad !== undefined && orden.svelocidad !== null
          ? String(orden.svelocidad)
          : "",
      scantidad_sublimada:
        orden.scantidad_sublimada !== undefined &&
        orden.scantidad_sublimada !== null
          ? String(orden.scantidad_sublimada)
          : "",
      serrores: orden.serrores || "",
      saprobacion_cliente_si_no: orden.saprobacion_cliente_si_no ?? false,
      smotivo_demora_terminado_s: orden.smotivo_demora_terminado_s || "",
      scomentario_entrega_s: orden.scomentario_entrega_s || "",
    })
    // Limpia el canvas al reabrir el modal para que no arrastre trazos
    // de una sesion anterior y bloquea el submit hasta una nueva firma.
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

      console.log("[v0] Sublimation Finish - Motivos raw:", data)
      console.log("[v0] Sublimation Finish - Error motivos:", error)

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

        console.log("[v0] Sublimation Finish - Motivos mapped:", motivos)
        setMotivosDemora(motivos)
      }

      setLoadingMotivos(false)
    }

    fetchMotivos()
  }, [open])

  const todayISO = new Date().toISOString().split("T")[0]

  // Tiempo de Sublimacion calculado automaticamente: dias habiles
  // (excluye domingos) entre la fecha en que la orden ingreso a Sublimacion
  // (`sfecha_de_ingreso_sub`) y el dia de hoy (cuando se entrega).
  // Devuelve null si no hay fecha de inicio para mostrar un mensaje claro.
  const tiempoSublimacionDias = orden.sfecha_de_ingreso_sub
    ? getDaysBetweenSkippingSundays(orden.sfecha_de_ingreso_sub, todayISO)
    : null
  const tiempoSublimacionLabel =
    tiempoSublimacionDias === null
      ? "Sin fecha de inicio"
      : tiempoSublimacionDias === 1
      ? "1 día"
      : `${tiempoSublimacionDias} días`
  // Lo que se persiste en BD (`telas.cabecera.stiempo_sublimacion` es text):
  // guardamos solo el numero de dias para facilitar reportes; si no hay
  // fecha de inicio dejamos undefined para no contaminar el campo.
  const tiempoSublimacionToSave =
    tiempoSublimacionDias === null
      ? undefined
      : String(tiempoSublimacionDias)

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  // Formato corto fecha+hora para el listado de parcialidades (mismo
  // formato que usa el detail para que la persona de Costura reconozca
  // los movimientos del dia al firmar).
  const formatDateTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Formato amigable de piezas: hasta 2 decimales sin forzar ".00".
  const formatPcs = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 })

  // Total acumulado de las parcialidades listadas (sirve de check visual
  // contra el total del pedido). Si el sublimador no uso parcialidades
  // (entrega unica), el array viene vacio y el bloque se oculta.
  const totalParcial = entregasParciales.reduce(
    (sum, ep) => sum + (Number(ep.cantidad) || 0),
    0
  )

  /**
   * Sube el Blob PNG de la firma al bucket `firmas-procesos` y devuelve
   * la URL publica. Sigue el patron `sublimacion_recibe_costura_{pedido}.png`
   * sobrescribiendo si ya existia (`upsert: true`) para que un re-firmado
   * sustituya correctamente la evidencia previa.
   */
  const uploadSignature = async (blob: Blob): Promise<string | null> => {
    if (!supabase) {
      toast.error("Supabase no configurado", {
        description: "No se puede subir la firma sin credenciales.",
      })
      return null
    }

    // Sanitiza el numero de pedido por si contiene caracteres no validos
    const safePedido = String(orden.pedido).replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `sublimacion_recibe_costura_${safePedido}.png`

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

    // Validacion dura: la firma es obligatoria. La persona de Costura
    // debe firmar fisicamente la recepcion en la pantalla del operario.
    if (signatureRef.current?.isEmpty()) {
      toast.error("Firma requerida", {
        description:
          "La persona de Costura debe firmar la recepcion antes de confirmar.",
      })
      return
    }

    setIsSubmitting(true)

    // 1. Exportar firma a PNG y subirla al bucket
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

    // 2. Parse numeric fields
    const temperaturaNum = parseFloat(formData.stemperatura)
    const velocidadNum = parseFloat(formData.svelocidad)
    const cantidadSublimadaNum = parseInt(formData.scantidad_sublimada, 10)

    // 3. Build UPDATE payload - seta_sublimacion is auto-set to today.
    //    stiempo_sublimacion se calcula automaticamente (dias habiles desde
    //    sfecha_de_ingreso_sub hasta hoy, saltando domingos).
    //    s_firma_recibe_costura recibe la URL publica de la firma.
    const updates: Partial<Orden> = {
      seta_sublimacion: todayISO,
      stiempo_sublimacion: tiempoSublimacionToSave,
      stemperatura: !isNaN(temperaturaNum) ? temperaturaNum : undefined,
      svelocidad: !isNaN(velocidadNum) ? velocidadNum : undefined,
      scantidad_sublimada: !isNaN(cantidadSublimadaNum)
        ? cantidadSublimadaNum
        : undefined,
      serrores: formData.serrores || undefined,
      saprobacion_cliente_si_no: formData.saprobacion_cliente_si_no,
      smotivo_demora_terminado_s:
        formData.smotivo_demora_terminado_s || undefined,
      scomentario_entrega_s: formData.scomentario_entrega_s || undefined,
      s_firma_recibe_costura: firmaUrl,
      // Al terminar con firma se marca el estado de entrega como Completado.
      // Esto habilita el boton "Recibir Completo" en el modulo de Costura.
      s_estado_entrega: "Completado",
    }

    console.log("[v0] Sublimation Finish - Updates payload:", updates)

    await onFinish(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Entregar Sublimacion
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Al guardar
            se registrara la fecha de hoy en{" "}
            <strong>seta_sublimacion</strong> como fecha de fin del proceso.
          </DialogDescription>
        </DialogHeader>

        {fetchError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Resumen de entregas parciales. Va al inicio para que la
              persona de Costura tenga claro QUE recibe en cada
              parcialidad antes de firmar. Solo se renderiza si hay al
              menos una parcialidad registrada (caso normal cuando el
              sublimador uso el flujo de "Registrar Entrega Parcial"). */}
          {entregasParciales.length > 0 && (
            <div className="rounded-lg border border-icon-coral/30 bg-rose-50/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PackagePlus className="size-4 text-icon-coral" />
                  <p className="text-sm font-semibold text-rose-900">
                    Desglose de Entregas Parciales
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-semibold text-emerald-700 border-emerald-300 bg-emerald-50"
                >
                  Total: {formatPcs(totalParcial)} pcs
                </Badge>
              </div>
              <p className="text-xs text-rose-900/70">
                Verifica el detalle de lo que recibes antes de firmar. Cada
                fila representa una parcialidad enviada por el sublimador.
              </p>
              <ScrollArea className="max-h-[220px] rounded-md border bg-background">
                <Table className="text-sm">
                  <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                    <TableRow>
                      <TableHead className="h-9 text-xs whitespace-nowrap">
                        Fecha
                      </TableHead>
                      <TableHead className="h-9 text-xs whitespace-nowrap">
                        Cantidad
                      </TableHead>
                      <TableHead className="h-9 text-xs">
                        <div className="flex items-center gap-1">
                          <ShirtIcon className="size-3 text-icon-magenta" />
                          Producto / Detalle
                        </div>
                      </TableHead>
                      <TableHead className="h-9 text-xs whitespace-nowrap">
                        Usuario
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregasParciales.map((ep, idx) => (
                      <TableRow key={ep.id ?? `ep-finish-${idx}`}>
                        <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(ep.fecha)}
                        </TableCell>
                        <TableCell className="py-2 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="font-semibold text-emerald-700 border-emerald-300 bg-emerald-50"
                          >
                            +{formatPcs(Number(ep.cantidad) || 0)} pcs
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-sm">
                          {ep.producto_detalle ? (
                            <span className="font-medium break-words">
                              {ep.producto_detalle}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Sin detalle
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 whitespace-nowrap">
                          {ep.usuario ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <UserCircle className="size-3 text-muted-foreground" />
                              {ep.usuario}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              -
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Parametros de sublimacion: Tiempo + Temperatura */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="stiempo_sublimacion"
                className="text-sm flex items-center gap-1.5"
              >
                <Timer className="size-3.5 text-icon-coral" />
                Tiempo de Sublimacion
              </Label>
              {/* Campo calculado automaticamente: dias entre la fecha de
                  ingreso a Sublimacion y hoy, saltando los domingos.
                  Se muestra como solo lectura para evitar errores. */}
              <Input
                id="stiempo_sublimacion"
                type="text"
                value={tiempoSublimacionLabel}
                readOnly
                aria-readonly
                tabIndex={-1}
                className="bg-muted/50 cursor-not-allowed font-medium"
                title="Calculado automaticamente desde la fecha de ingreso a Sublimacion"
              />
              <p className="text-[11px] text-muted-foreground">
                Calculo automatico: dias habiles desde el ingreso a
                Sublimacion hasta hoy (excluye domingos).
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="stemperatura"
                className="text-sm flex items-center gap-1.5"
              >
                <Thermometer className="size-3.5 text-icon-coral" />
                Temperatura (°C)
              </Label>
              <Input
                id="stemperatura"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="Ej. 200"
                value={formData.stemperatura}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    stemperatura: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Velocidad + Cantidad sublimada */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="svelocidad"
                className="text-sm flex items-center gap-1.5"
              >
                <Gauge className="size-3.5 text-icon-cyan" />
                Velocidad
              </Label>
              <Input
                id="svelocidad"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="Ej. 3.5"
                value={formData.svelocidad}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    svelocidad: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="scantidad_sublimada"
                className="text-sm flex items-center gap-1.5"
              >
                <Layers className="size-3.5 text-icon-green" />
                Cantidad Sublimada
              </Label>
              <Input
                id="scantidad_sublimada"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Piezas"
                value={formData.scantidad_sublimada}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    scantidad_sublimada: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Errores / mermas */}
          <div className="space-y-2">
            <Label
              htmlFor="serrores"
              className="text-sm flex items-center gap-1.5"
            >
              <XCircle className="size-3.5 text-red-500" />
              Errores / Mermas
            </Label>
            <Textarea
              id="serrores"
              placeholder="Documenta mermas, fallos o errores detectados durante la sublimacion..."
              rows={3}
              value={formData.serrores}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  serrores: e.target.value,
                }))
              }
            />
          </div>

          {/* Aprobacion cliente */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <Checkbox
              id="saprobacion_cliente_si_no"
              checked={formData.saprobacion_cliente_si_no}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  saprobacion_cliente_si_no: checked === true,
                })
              }
            />
            <Label
              htmlFor="saprobacion_cliente_si_no"
              className="text-sm cursor-pointer select-none"
            >
              Aprobacion del cliente
            </Label>
          </div>

          <Separator />

          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="smotivo_demora_terminado_s" className="text-sm">
              Motivo de Demora
            </Label>
            <Select
              value={formData.smotivo_demora_terminado_s}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  smotivo_demora_terminado_s: value,
                })
              }
              disabled={loadingMotivos}
            >
              <SelectTrigger id="smotivo_demora_terminado_s">
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
            <Label htmlFor="scomentario_entrega_s" className="text-sm">
              Comentario de Entrega
            </Label>
            <Textarea
              id="scomentario_entrega_s"
              placeholder="Observaciones finales sobre la entrega de la sublimacion..."
              rows={4}
              value={formData.scomentario_entrega_s}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scomentario_entrega_s: e.target.value,
                }))
              }
            />
          </div>

          <Separator />

          {/* Firma de quien recibe en Costura - obligatoria */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <PenLine className="size-3.5 text-icon-magenta" />
              Firma de quien recibe en Costura
              <span className="text-destructive">*</span>
            </Label>
            <SignaturePad
              ref={signatureRef}
              onChange={setSignatureEmpty}
              ariaLabel={`Firma de la persona de Costura que recibe la sublimacion del pedido ${orden.pedido}`}
            />
            <p className="text-xs text-muted-foreground">
              La persona de Costura debe firmar para confirmar que recibe los
              bultos sublimados. La firma se guarda como evidencia.
            </p>
          </div>

          <Separator />

          {/* Auto-calculated preview */}
          <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 mb-2">
              Valores calculados automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-emerald-700" />
              <span className="text-muted-foreground">
                Fecha fin de Sublimacion (seta_sublimacion):
              </span>
              <span className="font-medium text-emerald-900">
                {formatDate(todayISO)}
              </span>
            </div>
            {orden.sfecha_de_ingreso_sub && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Recibido en Sublimacion:</span>
                <span className="font-medium">
                  {formatDate(orden.sfecha_de_ingreso_sub)}
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
              disabled={isSubmitting || signatureEmpty}
              title={
                signatureEmpty
                  ? "La persona de Costura debe firmar para confirmar"
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
                  <CheckCircle2 className="mr-2 size-4" />
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
