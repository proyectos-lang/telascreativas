"use client"

/**
 * Modal de confirmacion para que un Planner marque una incidencia como
 * Procesada. La logica de UPDATE vive en el contexto; este componente
 * solo confirma con el usuario y deja un breve resumen del registro
 * antes de aplicar el cambio.
 */

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle2, Loader2 } from "lucide-react"
import {
  useIncidenciasReporte,
  type IncidenciaReporte,
} from "@/lib/incidencias-reporte-context"

interface IncidenciasProcesarModalProps {
  incidencia: IncidenciaReporte | null
  onClose: () => void
}

export function IncidenciasProcesarModal({
  incidencia,
  onClose,
}: IncidenciasProcesarModalProps) {
  const { procesarIncidencia } = useIncidenciasReporte()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!incidencia) return
    setIsSubmitting(true)
    const res = await procesarIncidencia(incidencia.id)
    setIsSubmitting(false)
    if (!res.ok) {
      toast.error("No se pudo procesar la reposicion", {
        description: res.error,
      })
      return
    }
    toast.success("Reposicion marcada como Procesada", {
      description: `Pedido ${incidencia.pedido} cerrado correctamente.`,
    })
    onClose()
  }

  return (
    <AlertDialog
      open={incidencia !== null}
      onOpenChange={(v) => {
        if (!v && !isSubmitting) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Procesar reposicion
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm">
            <span className="block">
              Estas a punto de marcar la incidencia del pedido{" "}
              <strong className="text-foreground">{incidencia?.pedido}</strong>{" "}
              como{" "}
              <strong className="text-emerald-700">Procesado</strong>. Se
              registrara automaticamente la fecha y hora actual en{" "}
              <code className="text-[11px]">fecha_procesado</code>.
            </span>
            {incidencia?.area_genera && (
              <span className="block rounded-md border bg-muted/30 px-3 py-2">
                <strong>Area responsable:</strong> {incidencia.area_genera} ·{" "}
                <strong>Area que reporta:</strong>{" "}
                {incidencia.area_reporta || "—"}
              </span>
            )}
            <span className="block text-xs text-muted-foreground">
              Esta accion solo esta disponible para usuarios con rol{" "}
              <strong>Planner</strong> y no puede deshacerse desde la app.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Mantener el spinner visible: cerramos manual al terminar.
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" />
                Confirmar procesado
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
