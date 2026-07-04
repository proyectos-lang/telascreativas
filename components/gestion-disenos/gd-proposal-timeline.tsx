"use client"

import { CheckCircle, Clock, XCircle, AlertCircle, Upload } from "lucide-react"
import type { GestionDisenoProposal } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

interface GDProposalTimelineProps {
  propuestas: GestionDisenoProposal[]
  totalPropuestas: number
  onSelectPropuesta?: (p: GestionDisenoProposal) => void
  selectedId?: number
}

function ProposalIcon({ estado }: { estado: string }) {
  switch (estado) {
    case "Aprobada":
      return <CheckCircle className="size-4 text-green-600" />
    case "No Aprobada":
      return <XCircle className="size-4 text-red-500" />
    case "Con Cambios":
      return <AlertCircle className="size-4 text-amber-500" />
    case "En Cliente":
      return <Clock className="size-4 text-purple-500" />
    default:
      return <Upload className="size-4 text-blue-500" />
  }
}

function ProposalCard({
  p,
  isSelected,
  isLast,
  onClick,
}: {
  p: GestionDisenoProposal
  isSelected: boolean
  isLast: boolean
  onClick?: () => void
}) {
  const stateColors: Record<string, string> = {
    Aprobada: "border-green-400 bg-green-50",
    "No Aprobada": "border-red-300 bg-red-50",
    "Con Cambios": "border-amber-300 bg-amber-50",
    "En Cliente": "border-purple-300 bg-purple-50",
    Pendiente: "border-blue-300 bg-blue-50",
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all min-w-[100px]",
        stateColors[p.estado] || "border-slate-200 bg-white",
        isSelected && "ring-2 ring-indigo-500 ring-offset-1",
        onClick && "cursor-pointer hover:shadow-sm",
        !onClick && "cursor-default"
      )}
    >
      {/* Connector line */}
      {!isLast && (
        <div className="absolute -right-4 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-slate-200" />
      )}

      <ProposalIcon estado={p.estado} />

      <div className="text-center">
        <p className="text-xs font-bold text-slate-700">V{p.numero_propuesta}</p>
        <p className="text-[10px] text-slate-500 leading-tight">{p.estado}</p>
      </div>

      {p.imagen_mockup_url && (
        <div className="relative">
          <img
            src={p.imagen_mockup_url}
            alt={`Propuesta ${p.numero_propuesta}`}
            className="h-10 w-10 rounded object-cover border border-white shadow-sm"
          />
          {(p.imagenes_propuesta_urls?.length ?? 0) > 1 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-sm">
              +{(p.imagenes_propuesta_urls?.length ?? 1) - 1}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

function EmptySlot({ num, isWarning }: { num: number; isWarning: boolean }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 min-w-[100px]",
        isWarning ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-slate-50/50"
      )}
    >
      <div
        className={cn(
          "flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
          isWarning ? "bg-red-100 text-red-400" : "bg-slate-100 text-slate-400"
        )}
      >
        {num}
      </div>
      <p className="text-[10px] text-slate-300">Pendiente</p>
    </div>
  )
}

export function GDProposalTimeline({
  propuestas,
  totalPropuestas,
  onSelectPropuesta,
  selectedId,
}: GDProposalTimelineProps) {
  const MAX = 5
  const slots = Array.from({ length: MAX }, (_, i) => i + 1)

  const isAtLimit = totalPropuestas >= 5
  const isNearLimit = totalPropuestas === 4

  return (
    <div className="space-y-2">
      {(isAtLimit || isNearLimit) && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
            isAtLimit
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {isAtLimit
              ? "Último ajuste alcanzado. Si el cliente solicita más cambios, se debe crear una nueva solicitud."
              : "Solo queda 1 ajuste disponible de los 5 permitidos."}
          </span>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-1">
        {slots.map((num, i) => {
          const prop = propuestas.find((p) => p.numero_propuesta === num)
          const isLast = i === MAX - 1
          if (prop) {
            return (
              <ProposalCard
                key={num}
                p={prop}
                isSelected={selectedId === prop.id}
                isLast={isLast}
                onClick={onSelectPropuesta ? () => onSelectPropuesta(prop) : undefined}
              />
            )
          }
          return (
            <EmptySlot key={num} num={num} isWarning={num === 5 && isAtLimit} />
          )
        })}
      </div>

      <p className="text-xs text-slate-400">
        {totalPropuestas} de {MAX} propuestas utilizadas
      </p>
    </div>
  )
}
