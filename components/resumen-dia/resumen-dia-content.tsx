"use client"

/**
 * Modulo "Resumen Dia": dashboard de cierre diario de produccion.
 *
 * Pensado para que un gerente revise al final de la jornada cuantas
 * ordenes y piezas entraron/salieron de cada area en una fecha
 * especifica. Estructurado como header global (date picker + KPIs) +
 * grid de tarjetas, una por cada eslabon del flujo productivo.
 */

import { useMemo } from "react"
import {
  ArrowRightToLine,
  Ban,
  CalendarDays,
  CheckCircle2,
  Flame,
  PackageCheck,
  Palette,
  Printer,
  RefreshCw,
  Scissors,
  ShoppingCart,
  Shirt,
  Truck,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { formatDateLong } from "@/lib/date-utils"
import {
  ResumenDiaProvider,
  useResumenDia,
  type ResumenAreaKey,
} from "@/lib/resumen-dia-context"
import { ResumenDiaCard } from "./resumen-dia-card"

/**
 * Configuracion estatica del orden, titulo, icono y color de cada area.
 * Mantener este array como unica fuente para que el grid se renderice
 * en el orden correcto del flujo productivo.
 */
const AREA_CONFIG: {
  key: ResumenAreaKey
  title: string
  icon: typeof Palette
  iconColor: string
}[] = [
  { key: "ventas", title: "Ventas (Ingreso)", icon: ShoppingCart, iconColor: "text-icon-magenta" },
  { key: "diseno", title: "Diseno", icon: Palette, iconColor: "text-icon-yellow" },
  { key: "corte", title: "Corte", icon: Scissors, iconColor: "text-icon-green" },
  { key: "impresion", title: "Impresion", icon: Printer, iconColor: "text-icon-cyan" },
  { key: "sublimacion", title: "Sublimacion", icon: Flame, iconColor: "text-icon-coral" },
  { key: "costura", title: "Costura", icon: Shirt, iconColor: "text-icon-purple" },
  { key: "empaque", title: "Empaque", icon: PackageCheck, iconColor: "text-icon-teal" },
  { key: "entregas", title: "Entregas Finales", icon: Truck, iconColor: "text-icon-magenta" },
]

function HeaderHero() {
  const { dateFrom, dateTo, setDateFrom, setDateTo, isRange, totals, refresh, isLoading } =
    useResumenDia()

  const fechaDesde = useMemo(() => formatDateLong(dateFrom, "Sin fecha"), [dateFrom])
  const fechaHasta = useMemo(() => formatDateLong(dateTo, "Sin fecha"), [dateTo])

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          {/* Encabezado + DatePicker rango */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-white/10">
                <CalendarDays className="size-4 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                  Cierre de produccion
                </p>
                <h1 className="text-lg font-bold leading-tight text-white">
                  Resumen del dia
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="resumen-fecha-desde"
                  className="text-[11px] font-medium text-white/70"
                >
                  Desde
                </Label>
                <Input
                  id="resumen-fecha-desde"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-auto border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/30 [color-scheme:dark]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="resumen-fecha-hasta"
                  className="text-[11px] font-medium text-white/70"
                >
                  Hasta
                </Label>
                <Input
                  id="resumen-fecha-hasta"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-auto border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/30 [color-scheme:dark]"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refresh()}
                disabled={isLoading}
                className="h-9 gap-1.5 border border-white/15 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                title="Refrescar datos"
              >
                <RefreshCw
                  className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
            </div>
            <p className="text-xs text-white/60">
              {isRange ? (
                <>
                  Movimientos del{" "}
                  <span className="font-semibold text-white">{fechaDesde}</span>
                  {" "}al{" "}
                  <span className="font-semibold text-white">{fechaHasta}</span>
                </>
              ) : (
                <>
                  Movimientos de{" "}
                  <span className="font-semibold text-white">{fechaDesde}</span>
                </>
              )}
            </p>
          </div>

          {/* KPIs globales */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <div className="rounded-lg border border-blue-400/30 bg-blue-500/15 p-3 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-200">
                <ArrowRightToLine className="size-3.5" />
                Ingresaron
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none text-white">
                  {totals.ingresoOrdenes}
                </span>
                <span className="text-[11px] text-white/60">
                  {totals.ingresoOrdenes === 1 ? "orden" : "ordenes"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-blue-200">
                {totals.ingresoPiezas.toLocaleString("es-CO")} piezas
              </p>
            </div>
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 p-3 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                <CheckCircle2 className="size-3.5" />
                Entregadas
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none text-white">
                  {totals.entregaOrdenes}
                </span>
                <span className="text-[11px] text-white/60">
                  {totals.entregaOrdenes === 1 ? "orden" : "ordenes"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-200">
                {totals.entregaPiezas.toLocaleString("es-CO")} piezas
              </p>
            </div>
            <div className="rounded-lg border border-red-400/30 bg-red-500/15 p-3 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-200">
                <XCircle className="size-3.5" />
                Rechazadas
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none text-white">
                  {totals.rechazadasOrdenes}
                </span>
                <span className="text-[11px] text-white/60">
                  {totals.rechazadasOrdenes === 1 ? "orden" : "ordenes"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-red-200">
                por fecha de ingreso
              </p>
            </div>
            <div className="rounded-lg border border-orange-400/30 bg-orange-500/15 p-3 min-w-[130px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                <Ban className="size-3.5" />
                Canceladas
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none text-white">
                  {totals.canceladasOrdenes}
                </span>
                <span className="text-[11px] text-white/60">
                  {totals.canceladasOrdenes === 1 ? "orden" : "ordenes"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-orange-200">
                por fecha de ingreso
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CardsGrid() {
  const { areas, isLoading } = useResumenDia()

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AREA_CONFIG.map((cfg) => (
          <Card key={cfg.key} className="bg-card/95">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pb-3">
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
              <Skeleton className="h-6 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {AREA_CONFIG.map((cfg) => {
        const area = areas[cfg.key]
        return (
          <ResumenDiaCard
            key={cfg.key}
            title={cfg.title}
            icon={cfg.icon}
            iconColor={cfg.iconColor}
            recibidas={area.recibidas}
            entregadas={area.entregadas}
          />
        )
      })}
    </div>
  )
}

function ErrorBanner() {
  const { error } = useResumenDia()
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>No se pudieron cargar los datos</AlertTitle>
      <AlertDescription className="text-xs">
        {error} - Verifica que la tabla{" "}
        <code className="font-mono">telas.cabecera</code> es accesible.
      </AlertDescription>
    </Alert>
  )
}

function ResumenDiaInner() {
  return (
    <div className="space-y-4">
      <ErrorBanner />
      <HeaderHero />
      <CardsGrid />
    </div>
  )
}

export function ResumenDiaContent() {
  return (
    <ResumenDiaProvider>
      <ResumenDiaInner />
    </ResumenDiaProvider>
  )
}
