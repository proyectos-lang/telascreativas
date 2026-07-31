"use client"

import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ReposicionEstado } from "@/lib/reposiciones-pendientes"

/**
 * Indicador aditivo "Pendiente por Reposición". Se muestra JUNTO al estado de
 * etapa (no lo reemplaza). Rosa para señalar bloqueo. Muestra el/las área(s)
 * que se esperan (repo <área>).
 */
export function ReposicionBadge({
  info,
  className,
  compact = false,
}: {
  info: ReposicionEstado
  className?: string
  compact?: boolean
}) {
  if (!info.pendiente) return null

  const label =
    info.areas.length === 0
      ? "Pend. Reposición"
      : info.areas.length === 1
        ? `Repo ${info.areas[0]}`
        : `Repo · ${info.areas.length} áreas`

  return (
    <Badge
      className={cn(
        "border border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-100 gap-1 whitespace-nowrap",
        compact ? "h-4 px-1 text-[9px]" : "text-xs",
        className
      )}
      title={
        info.areas.length
          ? `Pendiente por reposición de: ${info.areas.join(", ")}`
          : "Pendiente por reposición"
      }
    >
      <AlertTriangle className={compact ? "size-2.5" : "size-3"} />
      {label}
    </Badge>
  )
}
