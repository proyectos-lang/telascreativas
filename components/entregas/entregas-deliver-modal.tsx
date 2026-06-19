"use client"

import { useEffect, useRef, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Truck,
  Calendar,
  CheckCircle2,
  User,
  MapPin,
  PenLine,
  FileText,
  Paperclip,
  X,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/shared/signature-pad"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Cliente independiente para acceder al Storage desde el modal.
// Mantiene la misma configuracion que el resto del modulo.
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

const SIGNATURE_BUCKET = "firmas-entregas"
const GUIA_BUCKET = "guias-envio"
// Tipos MIME aceptados para la guia de envio opcional (imagen o PDF)
const GUIA_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
const GUIA_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

interface EntregasDeliverModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  onDeliver: (data: Partial<Orden>) => Promise<void>
}

export function EntregasDeliverModal({
  orden,
  open,
  onClose,
  onDeliver,
}: EntregasDeliverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comentario, setComentario] = useState("")
  const [signatureEmpty, setSignatureEmpty] = useState(true)
  const [guiaFile, setGuiaFile] = useState<File | null>(null)
  const signatureRef = useRef<SignaturePadHandle>(null)
  const guiaInputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setComentario(orden.comentario_entrega_cliente || "")
    setGuiaFile(null)
    if (guiaInputRef.current) guiaInputRef.current.value = ""
    // Limpia el canvas al reabrir para no arrastrar trazos previos
    signatureRef.current?.clear()
    setSignatureEmpty(true)
  }, [open, orden])

  const handleGuiaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setGuiaFile(null)
      return
    }
    // Validacion basica de tipo y tamano
    const allowed = ["image/jpeg", "image/png", "application/pdf"]
    if (!allowed.includes(file.type)) {
      toast.error("Formato no permitido", {
        description: "La guia debe ser una imagen JPG/PNG o un archivo PDF.",
      })
      e.target.value = ""
      return
    }
    if (file.size > GUIA_MAX_BYTES) {
      toast.error("Archivo demasiado grande", {
        description: "El tamano maximo permitido es 10 MB.",
      })
      e.target.value = ""
      return
    }
    setGuiaFile(file)
  }

  const clearGuia = () => {
    setGuiaFile(null)
    if (guiaInputRef.current) guiaInputRef.current.value = ""
  }

  const todayISO = new Date().toISOString()

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  /**
   * Sube el Blob PNG de la firma al bucket `firmas-entregas` y devuelve
   * la URL publica. El nombre del archivo es `pedido_{pedido}.png` y se
   * sobrescribe si ya existia una firma previa para la misma orden
   * (upsert: true).
   */
  const uploadSignature = async (blob: Blob): Promise<string | null> => {
    if (!supabase) {
      toast.error("Supabase no configurado", {
        description: "No se puede subir la firma sin credenciales.",
      })
      return null
    }

    // Sanitiza el numero de pedido por si contiene caracteres no validos para filename
    const safePedido = String(orden.pedido).replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `pedido_${safePedido}.png`

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

    // Obtiene URL publica (el bucket debe estar configurado como publico
    // o con una policy que permita lectura anonima del objeto).
    const { data } = supabase.storage
      .from(SIGNATURE_BUCKET)
      .getPublicUrl(filename)

    return data?.publicUrl || null
  }

  /**
   * Sube la guia de envio (imagen o PDF) al bucket `guias-envio` y devuelve
   * la URL publica. El nombre es `guia_{pedido}_{timestamp}.{ext}` para
   * permitir multiples subidas historicas sin sobrescribir una guia previa.
   */
  const uploadGuia = async (file: File): Promise<string | null> => {
    if (!supabase) {
      toast.error("Supabase no configurado", {
        description: "No se puede subir la guia sin credenciales.",
      })
      return null
    }

    const safePedido = String(orden.pedido).replace(/[^a-zA-Z0-9_-]/g, "_")
    const timestamp = Date.now()
    // Derivar extension desde el tipo MIME (mas confiable que el name original)
    const ext =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
        ? "png"
        : "jpg"
    const filename = `guia_${safePedido}_${timestamp}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(GUIA_BUCKET)
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      toast.error("Error al subir guia de envio", {
        description: uploadError.message,
      })
      return null
    }

    const { data } = supabase.storage.from(GUIA_BUCKET).getPublicUrl(filename)
    return data?.publicUrl || null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validacion dura: la firma es obligatoria
    if (signatureRef.current?.isEmpty()) {
      toast.error("Firma requerida", {
        description: "El cliente debe firmar antes de confirmar la entrega.",
      })
      return
    }

    setIsSubmitting(true)

    // 1. Exportar firma a Blob PNG
    const blob = await signatureRef.current?.toBlob()
    if (!blob) {
      toast.error("No se pudo capturar la firma", {
        description: "Intenta firmar nuevamente.",
      })
      setIsSubmitting(false)
      return
    }

    // 2. Subir al bucket de Supabase Storage
    const firmaUrl = await uploadSignature(blob)
    if (!firmaUrl) {
      setIsSubmitting(false)
      return
    }

    // 3. (Opcional) Subir guia de envio si el usuario selecciono un archivo
    let guiaUrl: string | null = null
    if (guiaFile) {
      guiaUrl = await uploadGuia(guiaFile)
      if (!guiaUrl) {
        // El error ya se notifico dentro de uploadGuia; abortamos para que
        // el usuario pueda reintentar o desadjuntar la guia.
        setIsSubmitting(false)
        return
      }
    }

    // 4. UPDATE en telas.cabecera incluyendo firma_url y (si aplica) guia
    const updates: Partial<Orden> = {
      entregado_cliente_si_no: true,
      fecha_entrega_cliente: todayISO,
      comentario_entrega_cliente: comentario.trim() || undefined,
      firma_url: firmaUrl,
      // Si no se adjunto guia, enviamos undefined para no pisar un valor
      // previo. Si si se adjunto, enviamos la URL publica.
      ...(guiaUrl ? { guia_envio_url: guiaUrl } : {}),
    }

    await onDeliver(updates)
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Truck className="size-5 text-icon-magenta" />
            Registrar Entrega a Cliente
          </DialogTitle>
          <DialogDescription className="text-sm">
            Orden <strong>{orden.pedido}</strong> - {orden.cliente}. Al
            confirmar se marcara como entregada fisicamente al cliente final.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Confirmation question */}
          <div className="rounded-lg border-2 border-dashed bg-blue-50/50 border-blue-300 p-4 text-center">
            <p className="text-sm font-semibold text-blue-900">
              ¿Confirmas que la orden ha sido entregada fisicamente al cliente?
            </p>
          </div>

          {/* Order summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{orden.cliente}</span>
            </div>
            {orden.vendedora && (
              <div className="flex items-center gap-2">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Vendedora:</span>
                <span className="font-medium">{orden.vendedora}</span>
              </div>
            )}
            {orden.ciudad && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Ciudad:</span>
                <span className="font-medium">{orden.ciudad}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Empaque:</span>
              <span className="font-medium">
                {formatDate(orden.efecha_de_empaque)}
              </span>
            </div>
          </div>

          {/* Firma virtual */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <PenLine className="size-3.5 text-icon-magenta" />
              Firma del Cliente
              <span className="text-destructive">*</span>
            </Label>
            <SignaturePad
              ref={signatureRef}
              onChange={setSignatureEmpty}
              ariaLabel={`Firma del cliente para el pedido ${orden.pedido}`}
            />
            <p className="text-xs text-muted-foreground">
              El cliente debe firmar en el recuadro. La firma se guardara como
              evidencia de la entrega.
            </p>
          </div>

          {/* Guia de Envio (Opcional) */}
          <div className="space-y-2">
            <Label
              htmlFor="guia_envio_file"
              className="flex items-center gap-1.5 text-sm"
            >
              <Paperclip className="size-3.5 text-icon-magenta" />
              Guia de Envio (Opcional - Foto o PDF)
            </Label>
            <Input
              ref={guiaInputRef}
              id="guia_envio_file"
              type="file"
              accept={GUIA_ACCEPT}
              onChange={handleGuiaChange}
              disabled={isSubmitting}
              className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-slate-200"
            />
            {guiaFile ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate font-medium text-emerald-900">
                    {guiaFile.name}
                  </span>
                  <span className="text-emerald-700 shrink-0">
                    ({(guiaFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearGuia}
                  disabled={isSubmitting}
                  className="h-6 px-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Formatos aceptados: JPG, PNG o PDF (max 10 MB). Si no adjuntas
                nada se guardara solo la firma.
              </p>
            )}
          </div>

          {/* Comentario */}
          <div className="space-y-2">
            <Label htmlFor="comentario_entrega_cliente" className="text-sm">
              Observaciones Finales de la Entrega
            </Label>
            <Textarea
              id="comentario_entrega_cliente"
              placeholder="Ej. Recibido por ... / Observaciones del transportador / Notas de conformidad del cliente..."
              rows={4}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>

          <Separator />

          {/* Auto-calculated preview */}
          <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Valores que se registraran automaticamente
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                entregado_cliente_si_no:
              </span>
              <span className="font-mono text-emerald-900 font-semibold">
                true
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-3.5 text-emerald-700" />
              <span className="text-muted-foreground">
                fecha_entrega_cliente:
              </span>
              <span className="font-medium text-emerald-900">
                {formatDate(todayISO)}
              </span>
            </div>
            <p className="text-xs text-emerald-800 pt-1 border-t border-emerald-200 mt-2">
              Esta accion cierra el ciclo completo de la orden. El pedido
              quedara marcado como entregado al cliente final.
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
              disabled={isSubmitting || signatureEmpty}
              className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Registrando...
                </>
              ) : (
                <>
                  <Truck className="mr-2 size-4" />
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
