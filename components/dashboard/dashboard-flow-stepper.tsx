"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { StatusArea, VistaControlProduccion } from "@/lib/types"

interface Step {
  key: "DIS" | "COR" | "IMP" | "SUB" | "COS" | "EMP"
  label: string
  status: StatusArea | null | undefined
  fecha: string | null | undefined
}

function formatDate(d?: string | null): string {
  if (!d) return "-"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

// Semantica de colores (alinada con el Coordinador de Produccion):
//  - Terminado: verde  -> el area ya cerro.
//  - Recibido:  azul   -> el area tiene la orden en mesa trabajandola.
//  - Pendiente: naranja -> cuello de botella: el area anterior ya entrego
//                          pero esta NO ha presionado "Recibir". Hay que
//                          destacarlo para que el coordinador actue.
//  - En espera: gris   -> la orden aun viene en camino; no es
//                          responsabilidad de esta area todavia.
function dotClasses(status?: StatusArea | null): {
  bg: string
  ring: string
  text: string
} {
  switch (status) {
    case "Terminado":
      return {
        bg: "bg-emerald-500",
        ring: "ring-emerald-200",
        text: "text-white",
      }
    case "Recibido":
      return {
        bg: "bg-blue-500",
        ring: "ring-blue-200",
        text: "text-white",
      }
    case "Pendiente":
      return {
        bg: "bg-orange-500",
        ring: "ring-orange-200",
        text: "text-white",
      }
    case "En espera":
    default:
      return {
        bg: "bg-slate-200",
        ring: "ring-slate-100",
        text: "text-slate-500",
      }
  }
}

interface FlowStepperProps {
  row: VistaControlProduccion
}

export function FlowStepper({ row }: FlowStepperProps) {
  const steps: Step[] = [
    {
      key: "DIS",
      label: "Diseno",
      status: row.status_diseno,
      fecha: row.fecha_fin_diseno,
    },
    {
      key: "COR",
      label: "Corte",
      status: row.status_corte,
      fecha: row.fecha_fin_corte,
    },
    {
      key: "IMP",
      label: "Impresion",
      status: row.status_impresion,
      fecha: row.fecha_fin_impresion,
    },
    {
      key: "SUB",
      label: "Sublimacion",
      status: row.status_sublimacion,
      fecha: row.fecha_fin_sublimacion,
    },
    {
      key: "COS",
      label: "Costura",
      status: row.status_costura,
      fecha: row.fecha_fin_costura,
    },
    {
      key: "EMP",
      label: "Empaque",
      status: row.status_empaque,
      fecha: row.fecha_fin_empaque,
    },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const c = dotClasses(step.status)
          return (
            <div key={step.key} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-0.5 cursor-help">
                    <div
                      className={[
                        "size-6 rounded-full flex items-center justify-center ring-2 transition-transform hover:scale-110",
                        c.bg,
                        c.ring,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "text-[9px] font-bold leading-none",
                          c.text,
                        ].join(" ")}
                      >
                        {step.key}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{step.label}</p>
                  <p className="text-muted-foreground">
                    {step.status || "En espera"}
                  </p>
                  {step.fecha && (
                    <p className="text-muted-foreground">
                      Fin: {formatDate(step.fecha)}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
              {idx < steps.length - 1 && (
                <div
                  className={[
                    "h-px w-2",
                    step.status === "Terminado"
                      ? "bg-emerald-400"
                      : "bg-slate-200",
                  ].join(" ")}
                />
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
