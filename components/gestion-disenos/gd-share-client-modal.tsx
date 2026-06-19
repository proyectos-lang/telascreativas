"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Copy, Link, Check } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import type { GestionDiseno, GestionDisenoProposal } from "@/lib/gestion-disenos-types"

interface GDShareClientModalProps {
  gestion: GestionDiseno
  propuesta: GestionDisenoProposal
  open: boolean
  onClose: () => void
}

export function GDShareClientModal({
  gestion,
  propuesta,
  open,
  onClose,
}: GDShareClientModalProps) {
  const { generateClientToken, updateSolicitud } = useGD()
  const [token, setToken] = useState<string | null>(propuesta.cliente_token)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const clientUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/gd-cliente/${token}`
    : null

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await generateClientToken(propuesta.id)
      if (res.success && res.token) {
        setToken(res.token)
        await updateSolicitud(gestion.id, { estado_turno: "En Cliente" })
        toast.success("Link generado", {
          description: "Cópialo y compártelo con el cliente.",
        })
      } else {
        toast.error("Error al generar link", { description: res.error })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!clientUrl) return
    await navigator.clipboard.writeText(clientUrl)
    setCopied(true)
    toast.success("Link copiado al portapapeles")
    setTimeout(() => setCopied(false), 2500)
  }

  const totalProp = gestion.total_propuestas
  const isLastProp = totalProp >= 5

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir con Cliente</DialogTitle>
          <DialogDescription>
            Propuesta {propuesta.numero_propuesta} — {gestion.cliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLastProp && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠️ Esta es la propuesta <strong>5 de 5</strong>. El cliente verá una advertencia de que
              este es el último ajuste disponible.
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
            <p>El cliente recibirá un link único donde podrá:</p>
            <ul className="list-inside list-disc text-xs text-slate-600 space-y-0.5 pl-1">
              <li>Ver el mockup con marca de agua "Telas Creativas"</li>
              <li>Aprobar la propuesta</li>
              <li>Solicitar cambios con comentarios</li>
            </ul>
          </div>

          {clientUrl ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Link del cliente:</p>
              <div className="flex gap-2">
                <Input value={clientUrl} readOnly className="text-xs font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5 text-green-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">
                El link expira cuando la solicitud sea aprobada o rechazada.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Genera un link único para que el cliente pueda revisar y responder la propuesta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {!clientUrl && (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Link className="size-4" />
              {loading ? "Generando..." : "Generar link"}
            </Button>
          )}
          {clientUrl && (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              variant="outline"
              className="gap-2 text-purple-600"
            >
              <Link className="size-4" />
              {loading ? "Regenerando..." : "Nuevo link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
