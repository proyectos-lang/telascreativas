import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** Color de acento (clases tailwind para el contenedor del icono). */
  accentClass?: string
  /** Resalta la tarjeta (ej. logro de bono). */
  highlight?: boolean
}

/**
 * Tarjeta de KPI ejecutiva: etiqueta, valor grande, hint opcional e icono.
 * Estilo sobrio/corporativo coherente con el resto de la app.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  accentClass = "bg-slate-100 text-slate-600",
  highlight = false,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "flex items-start justify-between gap-3 p-4 transition-colors",
        highlight
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold leading-tight text-slate-800">
          {value}
        </p>
        {hint && (
          <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            accentClass
          )}
        >
          {icon}
        </div>
      )}
    </Card>
  )
}
