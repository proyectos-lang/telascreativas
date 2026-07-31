"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AREAS } from "./modal-reporte-incidencia"
import type { Orden } from "@/lib/types"

interface Props {
  orden: Orden
  /** El updateOrden del módulo: (updates) => Promise<{success,error}>. */
  onUpdate: (updates: Partial<Orden>) => Promise<{ success: boolean; error?: string }>
}

/**
 * Botón reutilizable para marcar/quitar el estado "Pendiente por Reposición"
 * (marca MANUAL en la orden). Se coloca junto a "Reportar Incidencia" en el
 * detalle de cada módulo. El estado derivado (reposición abierta en
 * incidencias) se maneja aparte y se muestra vía ReposicionBadge.
 */
export function PendienteReposicionButton({ orden, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [area, setArea] = useState<string>(orden.area_reposicion ?? "")
  const [loading, setLoading] = useState(false)

  const marcada = orden.pendiente_reposicion === true

  const guardar = async () => {
    if (!area) {
      toast.error("Selecciona el área que se espera")
      return
    }
    setLoading(true)
    const res = await onUpdate({
      pendiente_reposicion: true,
      area_reposicion: area,
      fecha_pendiente_reposicion: new Date().toISOString(),
    })
    setLoading(false)
    if (res.success) {
      toast.success(`Orden marcada: pendiente por reposición de ${area}`)
      setOpen(false)
    } else {
      toast.error("Error al marcar", { description: res.error })
    }
  }

  const quitar = async () => {
    setLoading(true)
    const res = await onUpdate({
      pendiente_reposicion: false,
      area_reposicion: null as unknown as undefined,
      fecha_pendiente_reposicion: null as unknown as undefined,
    })
    setLoading(false)
    if (res.success) {
      toast.success("Se quitó el estado de pendiente por reposición")
    } else {
      toast.error("Error al quitar", { description: res.error })
    }
  }

  if (marcada) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={quitar}
        disabled={loading}
        className="border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800 text-sm"
        title={`Pendiente por reposición${orden.area_reposicion ? ` de ${orden.area_reposicion}` : ""} — clic para quitar`}
      >
        {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <X className="mr-1 size-3.5" />}
        Quitar reposición
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 text-sm"
      >
        <AlertTriangle className="mr-1 size-3.5" />
        Pendiente x Reposición
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Pendiente por Reposición
            </DialogTitle>
            <DialogDescription>
              {orden.pedido} — la orden no podrá terminarse mientras espere la reposición.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-slate-700">
              Área que se espera (repo) <span className="text-red-500">*</span>
            </label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el área..." />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={loading || !area}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading ? "Guardando..." : "Marcar pendiente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
