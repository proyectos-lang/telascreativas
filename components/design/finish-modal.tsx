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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Save,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Calendar,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface FinishModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onFinish: (data: Partial<Orden>) => Promise<void>
}

export function FinishModal({
  orden,
  open,
  onClose,
  onFinish,
}: FinishModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [motivosDemora, setMotivosDemora] = useState<string[]>([])
  const [loadingMotivos, setLoadingMotivos] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [motivoDemora, setMotivoDemora] = useState<string>("")
  const [notaTerminado, setNotaTerminado] = useState<string>("")

  // Fetch de motivos cuando se abre el modal
  useEffect(() => {
    async function fetchMotivos() {
      if (!supabase || !open) return

      setLoadingMotivos(true)
      setFetchError(null)

      // Ahora consumimos la tabla especifica del area de Diseno en vez de la
      // tabla general de motivos. Cada area tiene su propia tabla con motivos
      // contextualizados.
      const { data, error } = await supabase
        .schema("telas")
        .from("motivos_demora_diseno")
        .select("*")

      if (error) {
        setFetchError(error.message)
      } else {
        // Support multiple possible column names: nombre, motivo, descripcion
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

  // Precarga con valores actuales cuando se abre el modal
  useEffect(() => {
    if (open) {
      setMotivoDemora(orden.dmotivo_demora_terminado_d || "")
      setNotaTerminado(orden.dnota_terminado_d || "")
    }
  }, [open, orden])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // CRITICO: Registrar la fecha actual en dentrega_diseno
    const today = new Date().toISOString().split("T")[0]

    const updates: Partial<Orden> = {
      dmotivo_demora_terminado_d: motivoDemora || undefined,
      dnota_terminado_d: notaTerminado || undefined,
      dentrega_diseno: today,
    }

    try {
      await onFinish(updates)
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Entregar Diseno
          </DialogTitle>
          <DialogDescription>
            Marca el diseno de la orden{" "}
            <span className="font-medium text-foreground">{orden.pedido}</span>{" "}
            como terminado. Se registrara la fecha de entrega automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {fetchError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Error cargando motivos: {fetchError}
              </AlertDescription>
            </Alert>
          )}

          {/* Fecha de entrega automatica (solo lectura) */}
          <div className="rounded-lg border bg-emerald-50/50 p-3">
            <div className="flex items-center gap-2 text-xs text-emerald-800">
              <Calendar className="size-3.5" />
              <span className="font-medium">Fecha de entrega:</span>
              <span>{today}</span>
            </div>
            <p className="mt-1 text-xs text-emerald-700/80">
              Esta fecha se registrara automaticamente al guardar.
            </p>
          </div>

          {/* Motivo de demora */}
          <div className="space-y-1.5">
            <Label htmlFor="dmotivo_demora_terminado_d" className="text-sm">
              Motivo de Demora
            </Label>
            <Select
              value={motivoDemora}
              onValueChange={setMotivoDemora}
              disabled={isSubmitting || loadingMotivos}
            >
              <SelectTrigger id="dmotivo_demora_terminado_d">
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

          {/* Nota / Comentario de entrega */}
          <div className="space-y-1.5">
            <Label htmlFor="dnota_terminado_d" className="text-sm">
              Comentario de entrega
            </Label>
            <Textarea
              id="dnota_terminado_d"
              value={notaTerminado}
              onChange={(e) => setNotaTerminado(e.target.value)}
              disabled={isSubmitting}
              placeholder="Observaciones sobre la entrega del diseno..."
              rows={4}
              className="text-sm"
            />
          </div>

          <Separator />

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
              Terminar Diseno
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
