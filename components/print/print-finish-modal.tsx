"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden, PAPEL_OPTIONS } from "@/lib/types"
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
  Calculator,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface PrintFinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
}

// Helper to map records to first non-empty display string.
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

/**
 * Modal de TERMINAR - Impresion.
 *
 * Aqui el impresor captura todos los parametros de produccion con los que
 * efectivamente despacho la orden (codigo de patron, impresora utilizada,
 * perfil de impresion, soporte, papel, cantidad, inches + yardas auto
 * calculadas). Tambien el motivo de demora del cierre y un comentario de
 * entrega. La fecha de entrega `ientrega_impresion` se setea en hoy.
 *
 * Antes estos campos vivian en el modal de RECIBIR, pero operativamente
 * solo se conocen al momento de cerrar la orden.
 */
export function PrintFinishModal({
  orden,
  open,
  onClose,
  onFinish,
}: PrintFinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dropdown data
  const [impresoras, setImpresoras] = useState<string[]>([])
  const [perfiles, setPerfiles] = useState<string[]>([])
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    icodigo_patron: orden.icodigo_patron || "",
    iimpresora: orden.iimpresora || "",
    inombre_del_soporte_impresoras: orden.inombre_del_soporte_impresoras || "",
    iperfil_de_impresion: orden.iperfil_de_impresion || "",
    ipapel: orden.ipapel || "",
    icantidad_de_la_orden:
      orden.icantidad_de_la_orden !== undefined &&
      orden.icantidad_de_la_orden !== null
        ? String(orden.icantidad_de_la_orden)
        : "",
    iinches:
      orden.iinches !== undefined && orden.iinches !== null
        ? String(orden.iinches)
        : "",
    imotivo_demora_terminado_i: orden.imotivo_demora_terminado_i || "",
    icomentario_entrega_i: orden.icomentario_entrega_i || "",
  })

  // Reset form each time the modal opens - rehydrate with latest orden
  useEffect(() => {
    if (!open) return
    setFormData({
      icodigo_patron: orden.icodigo_patron || "",
      iimpresora: orden.iimpresora || "",
      inombre_del_soporte_impresoras:
        orden.inombre_del_soporte_impresoras || "",
      iperfil_de_impresion: orden.iperfil_de_impresion || "",
      ipapel: orden.ipapel || "",
      icantidad_de_la_orden:
        orden.icantidad_de_la_orden !== undefined &&
        orden.icantidad_de_la_orden !== null
          ? String(orden.icantidad_de_la_orden)
          : "",
      iinches:
        orden.iinches !== undefined && orden.iinches !== null
          ? String(orden.iinches)
          : "",
      imotivo_demora_terminado_i: orden.imotivo_demora_terminado_i || "",
      icomentario_entrega_i: orden.icomentario_entrega_i || "",
    })
  }, [open, orden])

  // Fetch all three lists in parallel from Supabase
  useEffect(() => {
    if (!open) return

    async function fetchLists() {
      if (!supabase) {
        setFetchError("Cliente de Supabase no configurado")
        return
      }

      setLoadingLists(true)
      setFetchError(null)

      const [impresorasRes, perfilesRes, motivosRes] = await Promise.all([
        supabase.schema("telas").from("impresoras").select("*"),
        supabase.schema("telas").from("perfiles_impresion").select("*"),
        supabase.schema("telas").from("motivos_demora").select("*"),
      ])

      if (impresorasRes.error) {
        setFetchError(impresorasRes.error.message)
      } else if (impresorasRes.data) {
        setImpresoras(mapToList(impresorasRes.data))
      }
      if (!perfilesRes.error && perfilesRes.data) {
        setPerfiles(mapToList(perfilesRes.data))
      }
      if (!motivosRes.error && motivosRes.data) {
        setMotivosDemora(mapToList(motivosRes.data))
      }

      setLoadingLists(false)
    }

    fetchLists()
  }, [open])

  // Auto-calculate yardas from inches (1 yard = 36 inches)
  const iinchesNum = parseFloat(formData.iinches)
  const yardasCalculated =
    !isNaN(iinchesNum) && iinchesNum > 0 ? iinchesNum / 36 : null
  const yardasDisplay =
    yardasCalculated !== null ? yardasCalculated.toFixed(2) : ""

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

    const cantidadNum = parseFloat(formData.icantidad_de_la_orden)
    const inchesNum = parseFloat(formData.iinches)

    const updates: Partial<Orden> = {
      // Production parameters moved from RECEIVE to FINISH
      icodigo_patron: formData.icodigo_patron || undefined,
      iimpresora: formData.iimpresora || undefined,
      inombre_del_soporte_impresoras:
        formData.inombre_del_soporte_impresoras || undefined,
      iperfil_de_impresion: formData.iperfil_de_impresion || undefined,
      ipapel: formData.ipapel || undefined,
      icantidad_de_la_orden: !isNaN(cantidadNum) ? cantidadNum : undefined,
      iinches: !isNaN(inchesNum) ? inchesNum : undefined,
      iyardas_impresion:
        !isNaN(inchesNum) && inchesNum > 0
          ? Number((inchesNum / 36).toFixed(2))
          : undefined,
      // Delivery metadata
      ientrega_impresion: todayISO,
      imotivo_demora_terminado_i:
        formData.imotivo_demora_terminado_i || undefined,
      icomentario_entrega_i: formData.icomentario_entrega_i || undefined,
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
            Entregar Impresion
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Registre
            los parametros finales de produccion con los que se imprimio la
            orden. Al guardar se registrara la fecha de hoy como entrega final.
          </DialogDescription>
        </DialogHeader>

        {fetchError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ---------- Parametros de produccion ---------- */}

          {/* Codigo de Patron - full width */}
          <div className="space-y-2">
            <Label htmlFor="icodigo_patron" className="text-sm">
              Codigo de Patron
            </Label>
            <Input
              id="icodigo_patron"
              type="text"
              placeholder="Ingrese el codigo de patron..."
              value={formData.icodigo_patron}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  icodigo_patron: e.target.value,
                }))
              }
            />
          </div>

          {/* Impresora + Perfil */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iimpresora" className="text-sm">
                Impresora
              </Label>
              <Select
                value={formData.iimpresora}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, iimpresora: value }))
                }
              >
                <SelectTrigger id="iimpresora" className="w-full">
                  <SelectValue
                    placeholder={
                      loadingLists ? "Cargando..." : "Seleccione impresora"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {impresoras.length === 0 && !loadingLists && (
                    <SelectItem value="__none__" disabled>
                      No hay impresoras disponibles
                    </SelectItem>
                  )}
                  {impresoras.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iperfil_de_impresion" className="text-sm">
                Perfil de Impresion
              </Label>
              <Select
                value={formData.iperfil_de_impresion}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    iperfil_de_impresion: value,
                  }))
                }
              >
                <SelectTrigger id="iperfil_de_impresion" className="w-full">
                  <SelectValue
                    placeholder={
                      loadingLists ? "Cargando..." : "Seleccione perfil"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {perfiles.length === 0 && !loadingLists && (
                    <SelectItem value="__none__" disabled>
                      No hay perfiles disponibles
                    </SelectItem>
                  )}
                  {perfiles.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nombre del Soporte (impresoras) - full width */}
          <div className="space-y-2">
            <Label htmlFor="inombre_del_soporte_impresoras" className="text-sm">
              Nombre del Soporte (Impresoras)
            </Label>
            <Input
              id="inombre_del_soporte_impresoras"
              type="text"
              placeholder="Ingrese el nombre del soporte..."
              value={formData.inombre_del_soporte_impresoras}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  inombre_del_soporte_impresoras: e.target.value,
                }))
              }
            />
          </div>

          {/* Papel + Cantidad de la orden */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ipapel" className="text-sm">
                Papel
              </Label>
              <Select
                value={formData.ipapel}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, ipapel: value }))
                }
              >
                <SelectTrigger id="ipapel" className="w-full">
                  <SelectValue placeholder="Seleccione papel" />
                </SelectTrigger>
                <SelectContent>
                  {PAPEL_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icantidad_de_la_orden" className="text-sm">
                Cantidad de la Orden
              </Label>
              <Input
                id="icantidad_de_la_orden"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={formData.icantidad_de_la_orden}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    icantidad_de_la_orden: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Inches + Yardas (auto-calculated) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iinches" className="text-sm">
                Inches (Pulgadas)
              </Label>
              <Input
                id="iinches"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.iinches}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, iinches: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="iyardas_impresion"
                className="text-sm flex items-center gap-1.5"
              >
                <Calculator className="size-3.5 text-icon-green" />
                Yardas (auto-calculado)
              </Label>
              <Input
                id="iyardas_impresion"
                type="text"
                value={yardasDisplay}
                disabled
                className="bg-muted/50 font-medium"
                placeholder="0.00"
              />
              <p className="text-[10px] text-muted-foreground">
                1 yarda = 36 pulgadas
              </p>
            </div>
          </div>

          <Separator />

          {/* ---------- Cierre ---------- */}

          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="imotivo_demora_terminado_i" className="text-sm">
              Motivo de Demora
            </Label>
            <Select
              value={formData.imotivo_demora_terminado_i}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  imotivo_demora_terminado_i: value,
                }))
              }
              disabled={loadingLists}
            >
              <SelectTrigger id="imotivo_demora_terminado_i">
                <SelectValue
                  placeholder={
                    loadingLists
                      ? "Cargando motivos..."
                      : "Selecciona un motivo (si aplica)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingLists && (
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
            <Label htmlFor="icomentario_entrega_i" className="text-sm">
              Comentario de Entrega
            </Label>
            <Textarea
              id="icomentario_entrega_i"
              placeholder="Observaciones sobre la entrega de la impresion..."
              rows={3}
              value={formData.icomentario_entrega_i}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  icomentario_entrega_i: e.target.value,
                }))
              }
            />
          </div>

          {/* Auto-calculated preview */}
          <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 mb-2">
              Valores calculados automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-emerald-700" />
              <span className="text-muted-foreground">
                Fecha de entrega de Impresion:
              </span>
              <span className="font-medium text-emerald-900">
                {formatDate(todayISO)}
              </span>
            </div>
            {orden.ifecha_de_ingreso_imp && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Recibido en Impresion:</span>
                <span className="font-medium">
                  {formatDate(orden.ifecha_de_ingreso_imp)}
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
                  Entregar Impresion
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
