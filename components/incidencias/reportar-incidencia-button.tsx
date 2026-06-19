"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertOctagon } from "lucide-react"
import {
  ModalReporteIncidencia,
  type Area,
} from "./modal-reporte-incidencia"

interface ReportarIncidenciaButtonProps {
  pedido: string
  /**
   * Area del modulo actual. Se usa para prellenar `area_reporta` dentro del
   * modal. No es obligatorio: si se omite, el usuario elige manualmente.
   */
  areaActual?: Area
}

/**
 * Boton reutilizable que se coloca en la barra superior del Detalle de cada
 * modulo de produccion (Diseno, Corte, Impresion, Sublimacion, Costura,
 * Empaque). Encapsula el estado de apertura del modal para simplificar la
 * integracion: basta con pasarle el pedido y opcionalmente el area actual.
 */
export function ReportarIncidenciaButton({
  pedido,
  areaActual,
}: ReportarIncidenciaButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-sm"
      >
        <AlertOctagon className="mr-1 size-3.5" />
        Reportar Incidencia
      </Button>
      <ModalReporteIncidencia
        pedido={pedido}
        areaActual={areaActual}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
