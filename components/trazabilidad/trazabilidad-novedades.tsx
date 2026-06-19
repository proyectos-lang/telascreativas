"use client"

import { Orden } from "@/lib/types"
import {
  Flame,
  MessageSquareText,
  PackageCheck,
  Palette,
  Printer,
  Scissors,
  Shirt,
  Truck,
} from "lucide-react"

interface TrazabilidadNovedadesProps {
  orden: Orden
}

interface NovedadEntry {
  key: string
  area: string
  icon: React.ElementType
  iconColor: string
  bgColor: string
  borderColor: string
  // List of comments from this area. Each may be from a different sub-step
  // (recibir / terminar). We show them stacked with a sub-label.
  comments: { label: string; text?: string | null }[]
}

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== ""
}

export function TrazabilidadNovedades({ orden }: TrazabilidadNovedadesProps) {
  const entries: NovedadEntry[] = [
    {
      key: "diseno",
      area: "Diseno",
      icon: Palette,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      comments: [
        { label: "Comentario de Diseno", text: orden.dcomentario_diseno },
        { label: "Nota al Entregar", text: orden.dnota_terminado_d },
      ],
    },
    {
      key: "corte",
      area: "Corte",
      icon: Scissors,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      comments: [
        { label: "Comentario de Corte", text: orden.ccomentario_corte },
      ],
    },
    {
      key: "impresion",
      area: "Impresion",
      icon: Printer,
      iconColor: "text-cyan-600",
      bgColor: "bg-cyan-50",
      borderColor: "border-cyan-200",
      comments: [
        {
          label: "Comentario al Recibir",
          text: orden.icomentario_impresion,
        },
        {
          label: "Comentario al Entregar",
          text: orden.icomentario_entrega_i,
        },
      ],
    },
    {
      key: "sublimacion",
      area: "Sublimacion",
      icon: Flame,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      comments: [
        {
          label: "Comentario al Recibir",
          text: orden.scomentario_sublimacion,
        },
        { label: "Errores / Mermas", text: orden.serrores },
        {
          label: "Comentario al Entregar",
          text: orden.scomentario_entrega_s,
        },
      ],
    },
    {
      key: "costura",
      area: "Costura",
      icon: Shirt,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      comments: [
        {
          label: "Comentario al Recibir",
          text: orden.coscomentario_costura,
        },
        { label: "Novedad de Costura", text: orden.cosnovedad_de_costura },
        {
          label: "Comentario al Entregar",
          text: orden.coscomentario_entrega_cs,
        },
      ],
    },
    {
      key: "empaque",
      area: "Empaque",
      icon: PackageCheck,
      iconColor: "text-teal-600",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      comments: [
        {
          label: "Comentario al Entregar",
          text: orden.ecomentario_entrega_e,
        },
      ],
    },
    {
      key: "entrega",
      area: "Entrega al Cliente",
      icon: Truck,
      iconColor: "text-fuchsia-600",
      bgColor: "bg-fuchsia-50",
      borderColor: "border-fuchsia-200",
      comments: [
        {
          label: "Comentario de Entrega",
          text: orden.comentario_entrega_cliente,
        },
      ],
    },
  ]

  // Keep only areas that have at least one non-empty comment
  const withComments = entries
    .map((e) => ({
      ...e,
      comments: e.comments.filter((c) => hasText(c.text)),
    }))
    .filter((e) => e.comments.length > 0)

  if (withComments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquareText className="size-8 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm">
          Ninguna area ha registrado novedades en esta orden.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {withComments.map((entry) => {
        const Icon = entry.icon
        return (
          <li
            key={entry.key}
            className={`${entry.bgColor} ${entry.borderColor} border rounded-lg p-3 flex gap-3`}
          >
            <div className="shrink-0">
              <div className="size-9 rounded-full bg-white border flex items-center justify-center shadow-sm">
                <Icon className={`size-4 ${entry.iconColor}`} />
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold text-foreground">
                {entry.area}
              </p>
              {entry.comments.map((c, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
