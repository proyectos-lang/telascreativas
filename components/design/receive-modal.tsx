"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden, TIPO_PREDISENO_OPTIONS } from "@/lib/types"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, X, Inbox } from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface ReceiveModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReceive: (data: Partial<Orden>) => Promise<void>
}

export function ReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: ReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [disenadores, setDisenadores] = useState<string[]>([])
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [formData, setFormData] = useState({
    ddisenador: orden.ddisenador || "",
    tipo_prediseno: orden.tipo_prediseno || "",
    dmotivo_demora_recibido_d: orden.dmotivo_demora_recibido_d || "",
    dprueba_de_color_si_no: orden.dprueba_de_color_si_no || false,
    dlleva_cinta_si_no: orden.dlleva_cinta_si_no || false,
    dcheck_de_muestra_si_no: orden.dcheck_de_muestra_si_no || false,
    dcomentario_diseno: orden.dcomentario_diseno || "",
  })

  // Reset form data when the modal opens with a new orden
  useEffect(() => {
    if (open) {
      setFormData({
        ddisenador: orden.ddisenador || "",
        tipo_prediseno: orden.tipo_prediseno || "",
        dmotivo_demora_recibido_d: orden.dmotivo_demora_recibido_d || "",
        dprueba_de_color_si_no: orden.dprueba_de_color_si_no || false,
        dlleva_cinta_si_no: orden.dlleva_cinta_si_no || false,
        dcheck_de_muestra_si_no: orden.dcheck_de_muestra_si_no || false,
        dcomentario_diseno: orden.dcomentario_diseno || "",
      })
    }
  }, [open, orden])

  // Fetch disenadores y motivos_demora
  useEffect(() => {
    async function fetchOptions() {
      if (!supabase || !open) return

      setLoadingOptions(true)

      try {
        const [disRes, motRes] = await Promise.all([
          supabase.schema("telas").from("disenadores").select("*"),
          supabase.schema("telas").from("motivos_demora").select("*"),
        ])

        console.log("[v0] Disenadores response:", disRes)
        console.log("[v0] Motivos demora response:", motRes)

        if (disRes.data) {
          // Try common column names for the designer name
          const names = disRes.data
            .map(
              (row: Record<string, unknown>) =>
                (row.nombre as string) ||
                (row.disenador as string) ||
                (row.name as string) ||
                ""
            )
            .filter((n: string) => n.length > 0)
          setDisenadores(names)
        }

        if (motRes.data) {
          const motivos = motRes.data
            .map(
              (row: Record<string, unknown>) =>
                (row.motivo as string) ||
                (row.nombre as string) ||
                (row.descripcion as string) ||
                ""
            )
            .filter((m: string) => m.length > 0)
          setMotivosDemora(motivos)
        }
      } catch (err) {
        console.error("[v0] Error al cargar opciones:", err)
      } finally {
        setLoadingOptions(false)
      }
    }

    fetchOptions()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // CRITICAL: Register today's date as dfecha_de_ingreso_diseno
    const today = new Date().toISOString().split("T")[0]

    const dataToSubmit: Partial<Orden> = {
      ...formData,
      dfecha_de_ingreso_diseno: today,
    }

    await onReceive(dataToSubmit)
    setIsSubmitting(false)
  }

  const handleCheckboxChange = (field: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-icon-cyan" />
            Recibir Diseno - {orden.pedido}
          </DialogTitle>
          <DialogDescription>
            Complete los datos de recepcion del diseno. La fecha de ingreso se
            registrara automaticamente al guardar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ddisenador">Disenador</Label>
            <Select
              value={formData.ddisenador}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, ddisenador: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingOptions
                      ? "Cargando disenadores..."
                      : "Seleccione disenador"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {disenadores.length === 0 && !loadingOptions && (
                  <SelectItem value="__none__" disabled>
                    No hay disenadores disponibles
                  </SelectItem>
                )}
                {disenadores.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
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

          <div className="space-y-2">
            <Label htmlFor="dmotivo_demora">Motivo de Demora (Recibido)</Label>
            <Select
              value={formData.dmotivo_demora_recibido_d}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  dmotivo_demora_recibido_d: value,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingOptions
                      ? "Cargando motivos..."
                      : "Seleccione motivo de demora"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingOptions && (
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

          <div className="space-y-3 rounded-lg border p-4">
            <Label className="text-sm font-medium">Requisitos del Diseno</Label>

            <div className="flex items-center gap-2">
              <Checkbox
                id="prueba_color"
                checked={formData.dprueba_de_color_si_no}
                onCheckedChange={() =>
                  handleCheckboxChange("dprueba_de_color_si_no")
                }
              />
              <Label
                htmlFor="prueba_color"
                className="font-normal cursor-pointer"
              >
                Prueba color
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="lleva_cinta"
                checked={formData.dlleva_cinta_si_no}
                onCheckedChange={() =>
                  handleCheckboxChange("dlleva_cinta_si_no")
                }
              />
              <Label
                htmlFor="lleva_cinta"
                className="font-normal cursor-pointer"
              >
                Lleva Cinta
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="lleva_muestra"
                checked={formData.dcheck_de_muestra_si_no}
                onCheckedChange={() =>
                  handleCheckboxChange("dcheck_de_muestra_si_no")
                }
              />
              <Label
                htmlFor="lleva_muestra"
                className="font-normal cursor-pointer"
              >
                Lleva muestra
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dcomentario_diseno">
              Comentarios de Recepcion
            </Label>
            <Textarea
              id="dcomentario_diseno"
              placeholder="Ingrese comentarios sobre la recepcion del diseno..."
              value={formData.dcomentario_diseno}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dcomentario_diseno: e.target.value,
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
