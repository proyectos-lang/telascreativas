"use client"

import { Orden } from "@/lib/types"
import {
  Flame,
  PackageCheck,
  Palette,
  Printer,
  Scissors,
  Shirt,
  Truck,
} from "lucide-react"

interface TrazabilidadTimelineProps {
  orden: Orden
}

interface Stage {
  key: string
  label: string
  icon: React.ElementType
  dateField: keyof Orden
  // Tailwind classes used when the stage is completed (filled icon)
  doneBg: string
  doneBorder: string
  doneText: string
  // Classes used for the label when completed
  doneLabelText: string
  // Classes used for the connector line to the next stage
  doneConnector: string
}

const STAGES: Stage[] = [
  {
    key: "diseno",
    label: "Diseno",
    icon: Palette,
    dateField: "dentrega_diseno",
    doneBg: "bg-amber-400",
    doneBorder: "border-amber-400",
    doneText: "text-white",
    doneLabelText: "text-amber-700",
    doneConnector: "bg-amber-400",
  },
  {
    key: "corte",
    label: "Corte",
    icon: Scissors,
    dateField: "cfecha_de_corte",
    doneBg: "bg-emerald-500",
    doneBorder: "border-emerald-500",
    doneText: "text-white",
    doneLabelText: "text-emerald-700",
    doneConnector: "bg-emerald-500",
  },
  {
    key: "impresion",
    label: "Impresion",
    icon: Printer,
    dateField: "ientrega_impresion",
    doneBg: "bg-cyan-500",
    doneBorder: "border-cyan-500",
    doneText: "text-white",
    doneLabelText: "text-cyan-700",
    doneConnector: "bg-cyan-500",
  },
  {
    key: "sublimacion",
    label: "Sublimacion",
    icon: Flame,
    dateField: "seta_sublimacion",
    doneBg: "bg-rose-500",
    doneBorder: "border-rose-500",
    doneText: "text-white",
    doneLabelText: "text-rose-700",
    doneConnector: "bg-rose-500",
  },
  {
    key: "costura",
    label: "Costura",
    icon: Shirt,
    dateField: "coseta_costura",
    doneBg: "bg-purple-500",
    doneBorder: "border-purple-500",
    doneText: "text-white",
    doneLabelText: "text-purple-700",
    doneConnector: "bg-purple-500",
  },
  {
    key: "empaque",
    label: "Empaque",
    icon: PackageCheck,
    dateField: "efecha_de_empaque",
    doneBg: "bg-teal-500",
    doneBorder: "border-teal-500",
    doneText: "text-white",
    doneLabelText: "text-teal-700",
    doneConnector: "bg-teal-500",
  },
  {
    key: "entrega",
    label: "Entrega al Cliente",
    icon: Truck,
    dateField: "fecha_entrega_cliente",
    doneBg: "bg-fuchsia-500",
    doneBorder: "border-fuchsia-500",
    doneText: "text-white",
    doneLabelText: "text-fuchsia-700",
    doneConnector: "bg-fuchsia-500",
  },
]

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function TrazabilidadTimeline({ orden }: TrazabilidadTimelineProps) {
  const deliveredToClient = orden.entregado_cliente_si_no === true

  const stagesWithState = STAGES.map((s) => {
    const raw = orden[s.dateField] as unknown
    // For the "entrega" stage, treat entregado_cliente_si_no true as completed
    const done =
      s.key === "entrega"
        ? deliveredToClient || (!!raw && String(raw).trim() !== "")
        : !!raw && String(raw).trim() !== ""
    return { ...s, done, dateValue: raw as string | undefined }
  })

  return (
    <div>
      {/* Desktop horizontal stepper */}
      <div className="hidden md:block">
        <ol className="relative flex items-start justify-between">
          {/* Background connector line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />

          {stagesWithState.map((stage, idx) => {
            // Colored connector line up to the last done stage
            const nextIsDone = stagesWithState[idx + 1]?.done
            const showConnectorColor = stage.done && nextIsDone

            const Icon = stage.icon
            return (
              <li
                key={stage.key}
                className="relative z-10 flex-1 flex flex-col items-center gap-2 px-1"
              >
                {/* Colored connector overlay (half right side of current node) */}
                {idx < stagesWithState.length - 1 && showConnectorColor && (
                  <span
                    className={`absolute top-5 left-1/2 right-0 h-0.5 ${stage.doneConnector}`}
                  />
                )}
                {/* Colored connector overlay (half left side of current node) */}
                {idx > 0 && stage.done && stagesWithState[idx - 1]?.done && (
                  <span
                    className={`absolute top-5 left-0 right-1/2 h-0.5 ${stage.doneConnector}`}
                  />
                )}

                <div
                  className={[
                    "size-10 rounded-full border-2 flex items-center justify-center transition-all shadow-sm",
                    stage.done
                      ? `${stage.doneBg} ${stage.doneBorder} ${stage.doneText}`
                      : "bg-background border-border text-muted-foreground",
                  ].join(" ")}
                >
                  <Icon className="size-5" />
                </div>
                <p
                  className={[
                    "text-xs font-semibold text-center",
                    stage.done ? stage.doneLabelText : "text-muted-foreground",
                  ].join(" ")}
                >
                  {stage.label}
                </p>
                {stage.done ? (
                  <p
                    className={[
                      "text-[11px] font-medium text-center leading-tight",
                      stage.doneLabelText,
                    ].join(" ")}
                  >
                    {formatDate(stage.dateValue) || "Entregado"}
                  </p>
                ) : (
                  <p className="text-[10px] text-center text-muted-foreground italic leading-tight">
                    Pendiente
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {/* Mobile vertical stepper */}
      <ol className="md:hidden space-y-0">
        {stagesWithState.map((stage, idx) => {
          const Icon = stage.icon
          return (
            <li key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "size-10 rounded-full border-2 flex items-center justify-center shrink-0 shadow-sm",
                    stage.done
                      ? `${stage.doneBg} ${stage.doneBorder} ${stage.doneText}`
                      : "bg-background border-border text-muted-foreground",
                  ].join(" ")}
                >
                  <Icon className="size-5" />
                </div>
                {idx < stagesWithState.length - 1 && (
                  <div
                    className={[
                      "w-0.5 flex-1 min-h-[16px]",
                      stage.done && stagesWithState[idx + 1]?.done
                        ? stage.doneConnector
                        : "bg-border",
                    ].join(" ")}
                  />
                )}
              </div>
              <div className="flex-1 pb-5 pt-2">
                <p
                  className={[
                    "text-sm font-semibold",
                    stage.done ? stage.doneLabelText : "text-foreground",
                  ].join(" ")}
                >
                  {stage.label}
                </p>
                {stage.done ? (
                  <p
                    className={[
                      "text-xs font-medium",
                      stage.doneLabelText,
                    ].join(" ")}
                  >
                    Entregado el {formatDate(stage.dateValue) || "-"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Pendiente
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
