"use client"

/**
 * Componente reutilizable que muestra la tarjeta de Resumen del Dia
 * correspondiente al area productiva del modulo donde se usa.
 *
 * Envuelve su propio ResumenDiaProvider para ser completamente
 * autonomo: no requiere que el modulo padre tenga el contexto activo.
 */

import { useMemo } from "react"
import {
  CalendarDays,
  Flame,
  PackageCheck,
  Palette,
  Printer,
  RefreshCw,
  Scissors,
  Shirt,
  Truck,
  type LucideIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ResumenDiaProvider,
  useResumenDia,
  type ResumenAreaKey,
} from "@/lib/resumen-dia-context"
import { ResumenDiaCard } from "@/components/resumen-dia/resumen-dia-card"
import { formatDateLong } from "@/lib/date-utils"

// ---------------------------------------------------------------------------
// Config estatica por area
// ---------------------------------------------------------------------------

interface AreaConfig {
  title: string
  icon: LucideIcon
  iconColor: string
}

const AREA_CONFIG: Record<ResumenAreaKey, AreaConfig> = {
  ventas: { title: "Ventas (Ingreso)", icon: Palette, iconColor: "text-icon-magenta" },
  diseno: { title: "Diseno", icon: Palette, iconColor: "text-icon-yellow" },
  corte: { title: "Corte", icon: Scissors, iconColor: "text-icon-green" },
  impresion: { title: "Impresion", icon: Printer, iconColor: "text-icon-cyan" },
  sublimacion: { title: "Sublimacion", icon: Flame, iconColor: "text-icon-coral" },
  costura: { title: "Costura", icon: Shirt, iconColor: "text-icon-purple" },
  empaque: { title: "Empaque", icon: PackageCheck, iconColor: "text-icon-teal" },
  entregas: { title: "Entregas Finales", icon: Truck, iconColor: "text-icon-magenta" },
}

// ---------------------------------------------------------------------------
// Inner (necesita el contexto activo)
// ---------------------------------------------------------------------------

function ModuleResumenCardInner({ areaKey }: { areaKey: ResumenAreaKey }) {
  const { dateFrom, dateTo, setDateFrom, setDateTo, isRange, isLoading, refresh, areas } =
    useResumenDia()

  const cfg = AREA_CONFIG[areaKey]
  const area = areas[areaKey]

  const fechaDesde = useMemo(() => formatDateLong(dateFrom, "Sin fecha"), [dateFrom])
  const fechaHasta = useMemo(() => formatDateLong(dateTo, "Sin fecha"), [dateTo])

  return (
    <div className="space-y-4">
      {/* Header compacto con rango de fechas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted">
            <CalendarDays className="size-4 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Resumen del dia
            </p>
            <p className="text-xs text-muted-foreground">
              {isRange ? (
                <>
                  Del{" "}
                  <span className="font-semibold text-foreground">{fechaDesde}</span>
                  {" "}al{" "}
                  <span className="font-semibold text-foreground">{fechaHasta}</span>
                </>
              ) : (
                <>
                  Movimientos de{" "}
                  <span className="font-semibold text-foreground">{fechaDesde}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={`resumen-desde-${areaKey}`}
              className="text-[11px] font-medium text-muted-foreground"
            >
              Desde
            </Label>
            <Input
              id={`resumen-desde-${areaKey}`}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-auto text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor={`resumen-hasta-${areaKey}`}
              className="text-[11px] font-medium text-muted-foreground"
            >
              Hasta
            </Label>
            <Input
              id={`resumen-hasta-${areaKey}`}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-auto text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="h-8 gap-1.5"
            title="Refrescar datos"
          >
            <RefreshCw
              className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tarjeta del area */}
      {isLoading ? (
        <div className="rounded-lg border bg-card/95 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      ) : (
        <ResumenDiaCard
          title={cfg.title}
          icon={cfg.icon}
          iconColor={cfg.iconColor}
          recibidas={area.recibidas}
          entregadas={area.entregadas}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export publico — envuelve su propio provider
// ---------------------------------------------------------------------------

export interface ModuleResumenCardProps {
  areaKey: ResumenAreaKey
}

export function ModuleResumenCard({ areaKey }: ModuleResumenCardProps) {
  return (
    <ResumenDiaProvider>
      <ModuleResumenCardInner areaKey={areaKey} />
    </ResumenDiaProvider>
  )
}
