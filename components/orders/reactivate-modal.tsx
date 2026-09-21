"use client"

/**
 * Reversar la cancelación de una orden.
 *
 * Cancelar solo escribe "cancelado" en `estado_aprobado_rechazado`; no
 * borra fechas ni avance. Por eso revertir es devolver ese campo a su
 * valor anterior, y todo lo demás sigue donde estaba.
 *
 * El problema es a CUÁL valor volver, porque no se guarda el estado
 * previo. Se deduce de las fechas objetivo: si la orden las tiene, es
 * que alguien la aprobó antes de cancelarla —el cálculo de fechas solo
 * ocurre al aprobar—; si no las tiene, se canceló estando pendiente. De
 * las 88 canceladas de hoy, 44 están en cada caso, así que mandarlas a
 * todas al mismo estado se equivocaría en la mitad.
 *
 * Se muestra a qué estado va a volver antes de confirmar: es una acción
 * que reactiva la orden en todos los módulos de producción, y conviene
 * que quien la ejecuta sepa exactamente qué va a pasar.
 */

import { useEffect, useState } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Orden } from "@/lib/types"

/**
 * Estado al que vuelve la orden.
 *
 * Aprobado si conserva alguna fecha objetivo: esas solo se escriben al
 * aprobar, así que su presencia es la huella de que la orden ya había
 * pasado por ahí.
 */
export function estadoAlReactivar(orden: Orden): "Aprobado" | "Pendiente" {
  const teniaObjetivos = Boolean(
    orden.dfecha_objetivo_d ||
      orden.mdfecha_objetivo_md ||
      orden.cfecha_objetivo_c ||
      orden.ifecha_objetivo_i ||
      orden.sfecha_objetivo_s ||
      orden.cosfecha_objetivo_cs ||
      orden.efecha_objetivo_e
  )
  return teniaObjetivos ? "Aprobado" : "Pendiente"
}

interface Props {
  orden: Orden | null
  open: boolean
  onClose: () => void
  onConfirm: (orden: Orden, estado: "Aprobado" | "Pendiente") => Promise<void>
}

export function ReactivateModal({ orden, open, onClose, onConfirm }: Props) {
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) setGuardando(false)
  }, [open])

  if (!orden) return null

  const estado = estadoAlReactivar(orden)
  // Avisar cuando la orden ya tiene trabajo hecho: reactivarla la
  // devuelve a los módulos justo donde se quedó, no al principio.
  const conAvance = Boolean(
    orden.dentrega_diseno ||
      orden.mdentrega_marker ||
      orden.cfecha_de_corte ||
      orden.ientrega_impresion ||
      orden.seta_sublimacion ||
      orden.coseta_costura ||
      orden.efecha_de_empaque
  )

  const confirmar = async () => {
    if (guardando) return
    setGuardando(true)
    try {
      await onConfirm(orden, estado)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !guardando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-100 p-1.5">
              <RotateCcw className="size-5 text-emerald-600" />
            </div>
            Reversar cancelación
          </DialogTitle>
          <DialogDescription>
            La orden {orden.pedido} volverá a aparecer en los módulos de
            producción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">
                {orden.cliente || "Sin cliente"}
              </span>
              {orden.pcs ? ` · ${orden.pcs} pcs` : ""}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
              Vuelve al estado
              <Badge
                variant="outline"
                className={
                  estado === "Aprobado"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }
              >
                {estado}
              </Badge>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {estado === "Aprobado"
                ? "Conserva sus fechas objetivo, así que ya había sido aprobada."
                : "No tiene fechas objetivo: se canceló antes de aprobarse, y habrá que aprobarla de nuevo."}
            </p>
          </div>

          {conAvance && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              Esta orden ya tiene trabajo registrado en producción. Al
              reactivarla reaparecerá en el punto donde se quedó, no al
              principio del flujo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={guardando}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {guardando ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 size-3.5" />
            )}
            Reversar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
