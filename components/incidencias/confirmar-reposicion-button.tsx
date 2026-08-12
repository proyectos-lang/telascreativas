"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PackageCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { confirmarReposicionDePedido } from "@/lib/reposiciones-pendientes"

interface ConfirmarReposicionButtonProps {
  pedido: string
  /** Áreas de la reposición (para el texto de confirmación). */
  areas?: string[]
  /** Se llama tras confirmar con éxito (refrescar reposiciones/órdenes). */
  onDone?: () => void
}

/**
 * Acción operativa (sin clave) para CONFIRMAR la recepción de la reposición de
 * un pedido: las piezas repuestas ya llegaron. Marca la reposición como
 * 'Procesado', liberando el pedido para poder cerrar la orden (p. ej. habilita
 * "Terminar"). Pide una confirmación simple para evitar clics accidentales.
 */
export function ConfirmarReposicionButton({
  pedido,
  areas,
  onDone,
}: ConfirmarReposicionButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const ejecutar = async () => {
    setLoading(true)
    const r = await confirmarReposicionDePedido(pedido)
    setLoading(false)
    if (r.success) {
      toast.success("Recepción de reposición confirmada", {
        description: `El pedido ${pedido} quedó liberado para cerrar la orden.`,
      })
      setOpen(false)
      onDone?.()
    } else {
      toast.error("No se pudo confirmar la recepción", { description: r.error })
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Confirmar que se recibió la reposición y liberar el pedido"
        className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
      >
        <PackageCheck className="mr-1 size-3.5" />
        Confirmar recepción de repo
      </Button>
      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar recepción de reposición</DialogTitle>
            <DialogDescription>
              Pedido {pedido}
              {areas && areas.length ? ` — reposición de ${areas.join(", ")}` : ""}. Al
              confirmar, el pedido queda liberado y se podrá cerrar la orden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={() => void ejecutar()}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-1.5 size-4" />
              )}
              Confirmar recepción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
