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
import { Inbox, AlertTriangle, Calendar, User } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface EmpaqueReceiveModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onReceive: (data: Partial<Orden>) => Promise<void>
}

export function EmpaqueReceiveModal({
  orden,
  open,
  onClose,
  onReceive,
}: EmpaqueReceiveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [empacadores, setEmpacadores] = useState<string[]>([])
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingLookups, setLoadingLookups] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    enombre_de_quien_empaca: "",
    emotivo_demora_recibido_e: "",
    ecomentario_recibo_emp: "",
  })

  // Reset on open
  useEffect(() => {
    if (!open) return
    setFormData({
      enombre_de_quien_empaca: orden.enombre_de_quien_empaca || "",
      emotivo_demora_recibido_e: orden.emotivo_demora_recibido_e || "",
      ecomentario_recibo_emp: orden.ecomentario_recibo_emp || "",
    })
  }, [open, orden])

  // Fetch empacadores + motivos in parallel
  useEffect(() => {
    if (!open) return

    async function fetchLookups() {
      if (!supabase) {
        setFetchError("Cliente de Supabase no configurado")
        return
      }

      setLoadingLookups(true)
      setFetchError(null)

      const [empacadoresRes, motivosRes] = await Promise.all([
        supabase.schema("telas").from("empacadores").select("*"),
        supabase.schema("telas").from("motivos_demora").select("*"),
      ])

      if (empacadoresRes.error) {
        setFetchError(empacadoresRes.error.message)
      } else {
        const nombres = (empacadoresRes.data || [])
          .map(
            (row: Record<string, unknown>) =>
              (row.nombre as string) ||
              (row.empacador as string) ||
              (row.descripcion as string) ||
              ""
          )
          .filter((n: string) => n.length > 0)
        setEmpacadores(nombres)
      }

      if (!motivosRes.error) {
        const motivos = (motivosRes.data || [])
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

      setLoadingLookups(false)
    }

    fetchLookups()
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

    if (!formData.enombre_de_quien_empaca) {
      setFetchError("Debes seleccionar un empacador para recibir la orden")
      return
    }

    setIsSubmitting(true)

    // Strict Supabase mapping:
    // - enombre_de_quien_empaca: Select (empacador asignado)
    // - emotivo_demora_recibido_e: Select (motivo opcional)
    // - edia_de_entrega: fecha automatica de inicio de empaque (hoy)
    const updates: Partial<Orden> = {
      enombre_de_quien_empaca: formData.enombre_de_quien_empaca,
      emotivo_demora_recibido_e:
        formData.emotivo_demora_recibido_e || undefined,
      ecomentario_recibo_emp: formData.ecomentario_recibo_emp || undefined,
      edia_de_entrega: todayISO,
    }

    await onReceive(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Inbox className="size-5 text-blue-600" />
            Recibir en Empaque
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Asigna un
            empacador para iniciar el proceso de empaque.
          </DialogDescription>
        </DialogHeader>

        {fetchError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Empacador */}
          <div className="space-y-2">
            <Label htmlFor="enombre_de_quien_empaca" className="text-sm">
              Empacador Asignado <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.enombre_de_quien_empaca}
              onValueChange={(value) =>
                setFormData({ ...formData, enombre_de_quien_empaca: value })
              }
              disabled={loadingLookups}
            >
              <SelectTrigger id="enombre_de_quien_empaca">
                <SelectValue
                  placeholder={
                    loadingLookups
                      ? "Cargando empacadores..."
                      : "Selecciona un empacador"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {empacadores.length === 0 && !loadingLookups && (
                  <SelectItem value="__none__" disabled>
                    No hay empacadores disponibles
                  </SelectItem>
                )}
                {empacadores.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo de demora */}
          <div className="space-y-2">
            <Label htmlFor="emotivo_demora_recibido_e" className="text-sm">
              Motivo de Demora
            </Label>
            <Select
              value={formData.emotivo_demora_recibido_e}
              onValueChange={(value) =>
                setFormData({ ...formData, emotivo_demora_recibido_e: value })
              }
              disabled={loadingLookups}
            >
              <SelectTrigger id="emotivo_demora_recibido_e">
                <SelectValue
                  placeholder={
                    loadingLookups
                      ? "Cargando motivos..."
                      : "Selecciona un motivo (si aplica)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {motivosDemora.length === 0 && !loadingLookups && (
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

          {/* Comentario de recepcion */}
          <div className="space-y-2">
            <Label htmlFor="ecomentario_recibo_emp" className="text-sm">
              Comentario de Recepcion
            </Label>
            <Textarea
              id="ecomentario_recibo_emp"
              value={formData.ecomentario_recibo_emp}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ecomentario_recibo_emp: e.target.value,
                })
              }
              placeholder="Observaciones al recibir la orden en Empaque (opcional)..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <Separator />

          {/* Info summary */}
          <div className="rounded-lg border bg-blue-50/50 border-blue-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
              <User className="size-3.5" />
              Valor calculado automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-blue-700" />
              <span className="text-muted-foreground">
                Fecha inicio empaque (edia_de_entrega):
              </span>
              <span className="font-medium text-blue-900">
                {formatDate(todayISO)}
              </span>
            </div>
            <p className="text-xs text-blue-800 pt-1 border-t border-blue-200 mt-2">
              Despues de recibir podras registrar las cantidades empacadas de
              cada producto antes de terminar el empaque.
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
              disabled={isSubmitting || !formData.enombre_de_quien_empaca}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Guardando...
                </>
              ) : (
                <>
                  <Inbox className="mr-2 size-4" />
                  Recibir Orden
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
