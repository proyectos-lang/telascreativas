"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Ban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditModeModal } from "@/components/orders/edit-mode-modal"
import { cancelarReposicionDePedido } from "@/lib/reposiciones-pendientes"

interface CancelarReposicionButtonProps {
  pedido: string
  /** Se llama tras cancelar con éxito (refrescar reposiciones/órdenes). */
  onDone?: () => void
  className?: string
}

/**
 * Botón protegido con clave para CANCELAR la reposición pendiente de un pedido.
 * Reutiliza el gate `EditModeModal` (misma clave de edición avanzada). Al
 * confirmar, marca la(s) incidencia(s) derivada(s) como 'Cancelado' y limpia la
 * marca manual, desbloqueando el cierre de la fase (p. ej. "Terminar" en
 * Sublimación) sin recargar.
 */
export function CancelarReposicionButton({
  pedido,
  onDone,
  className,
}: CancelarReposicionButtonProps) {
  const [askPassword, setAskPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const ejecutar = async () => {
    setLoading(true)
    const r = await cancelarReposicionDePedido(pedido)
    setLoading(false)
    if (r.success) {
      toast.success("Reposición cancelada", {
        description: `Se canceló la reposición del pedido ${pedido}.`,
      })
      onDone?.()
    } else {
      toast.error("No se pudo cancelar la reposición", { description: r.error })
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => setAskPassword(true)}
        title="Cancelar la reposición pendiente (requiere clave)"
        className={
          className ??
          "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
        }
      >
        {loading ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" />
        ) : (
          <Ban className="mr-1 size-3.5" />
        )}
        Cancelar reposición
      </Button>
      <EditModeModal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onUnlock={() => void ejecutar()}
      />
    </>
  )
}
