"use client"

import { useMemo, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, ChevronDown, X } from "lucide-react"
import { Orden } from "@/lib/types"
import { formatDateShort, getTodayISO } from "@/lib/date-utils"

/**
 * Filtro reutilizable por "Fecha Objetivo" que se muestra junto al boton
 * de Actualizar en cada modulo de produccion.
 *
 * Cada modulo debe pasar el campo de fecha que le corresponde:
 *   - Diseno      -> "dfecha_objetivo_d"
 *   - Corte       -> "cfecha_objetivo_c"
 *   - Impresion   -> "ifecha_objetivo_i"
 *   - Sublimacion -> "sfecha_objetivo_s"
 *   - Costura     -> "cosfecha_objetivo_cs"
 *   - Empaque     -> "efecha_objetivo_e"
 *
 * Modos disponibles:
 *   - "today_overdue": Hoy + Vencidas (default). Muy util como vista
 *     operativa del dia: lo que se debe entregar hoy o ya esta atrasado.
 *   - "today":         Solo hoy.
 *   - "specific":      Una fecha especifica.
 *   - "range":         Un rango Desde/Hasta (inclusivo).
 *   - "all":           Sin filtro (muestra todo, incluso ordenes sin
 *                      fecha objetivo).
 */

export type TargetDateMode =
  | "today_overdue"
  | "today"
  | "specific"
  | "range"
  | "all"

export interface TargetDateFilterValue {
  mode: TargetDateMode
  /** Solo aplica cuando mode === "specific" */
  date?: string
  /** Solo aplican cuando mode === "range" */
  from?: string
  to?: string
}

export const DEFAULT_TARGET_DATE_FILTER: TargetDateFilterValue = {
  mode: "all",
}

/**
 * Devuelve true si la fecha objetivo de la orden cumple con el filtro.
 *
 * Reglas:
 *   - mode "all": siempre true.
 *   - Sin fecha objetivo (null/undefined/""):
 *       - "all":           true
 *       - cualquier otro:  false (la orden no aplica al filtro temporal)
 *   - El resto compara strings "YYYY-MM-DD" sin pasar por Date para
 *     evitar corrimientos por zona horaria (consistente con date-utils).
 */
export function matchesTargetDate(
  rawDate: unknown,
  filter: TargetDateFilterValue,
  todayISO: string = getTodayISO()
): boolean {
  if (filter.mode === "all") return true

  const ymd =
    typeof rawDate === "string" && rawDate.length >= 10
      ? rawDate.slice(0, 10)
      : ""
  if (!ymd) return false

  switch (filter.mode) {
    case "today":
      return ymd === todayISO
    case "today_overdue":
      return ymd <= todayISO
    case "specific":
      return filter.date ? ymd === filter.date : true
    case "range": {
      const fromOk = filter.from ? ymd >= filter.from : true
      const toOk = filter.to ? ymd <= filter.to : true
      return fromOk && toOk
    }
    default:
      return true
  }
}

const MODE_LABEL: Record<TargetDateMode, string> = {
  today_overdue: "Hoy + Vencidas",
  today: "Solo Hoy",
  specific: "Fecha especifica",
  range: "Rango",
  all: "Todas",
}

/**
 * Helper para mostrar un resumen corto en el trigger del Popover, con
 * los valores actuales del filtro (ej: "Rango: 12 abr - 15 abr").
 */
function summarizeFilter(filter: TargetDateFilterValue): string {
  switch (filter.mode) {
    case "today_overdue":
      return "Hoy + Vencidas"
    case "today":
      return "Solo Hoy"
    case "specific":
      return filter.date ? formatDateShort(filter.date) : "Fecha especifica"
    case "range": {
      const a = filter.from ? formatDateShort(filter.from) : "..."
      const b = filter.to ? formatDateShort(filter.to) : "..."
      return `${a} - ${b}`
    }
    case "all":
      return "Todas"
    default:
      return "Filtro"
  }
}

interface TargetDateFilterProps {
  value: TargetDateFilterValue
  onChange: (next: TargetDateFilterValue) => void
  /** Color de acento del icono ("text-icon-magenta", etc.) */
  accentClass?: string
}

export function TargetDateFilter({
  value,
  onChange,
  accentClass = "text-icon-magenta",
}: TargetDateFilterProps) {
  const [open, setOpen] = useState(false)

  // Estado local en el popover para no propagar cambios hasta que el
  // usuario elija un modo o ajuste fechas (mejor UX al editar rangos).
  const [draft, setDraft] = useState<TargetDateFilterValue>(value)

  // Si se reabre el popover, sincronizamos el draft con el valor actual.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(value)
    }
    setOpen(nextOpen)
  }

  const isDefault = useMemo(
    () => value.mode === DEFAULT_TARGET_DATE_FILTER.mode,
    [value.mode]
  )

  const apply = (next: TargetDateFilterValue) => {
    setDraft(next)
    onChange(next)
  }

  const handleModeChange = (next: TargetDateMode) => {
    // Al cambiar de modo, conservamos los valores pertinentes y aplicamos.
    const merged: TargetDateFilterValue = { mode: next }
    if (next === "specific") {
      merged.date = draft.date || getTodayISO()
    } else if (next === "range") {
      merged.from = draft.from
      merged.to = draft.to
    }
    apply(merged)
  }

  const handleClear = () => {
    apply(DEFAULT_TARGET_DATE_FILTER)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label="Filtrar por fecha objetivo"
        >
          <Calendar className={`size-4 ${accentClass}`} />
          <span className="text-xs font-medium">
            <span className="hidden sm:inline text-muted-foreground">
              Fecha objetivo:{" "}
            </span>
            <span>{summarizeFilter(value)}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className={`size-4 ${accentClass}`} />
              <h4 className="text-sm font-semibold">Fecha Objetivo</h4>
            </div>
            {!isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs"
              >
                <X className="mr-1 size-3" />
                Restablecer
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-date-mode" className="text-xs">
              Mostrar
            </Label>
            <Select
              value={draft.mode}
              onValueChange={(v) => handleModeChange(v as TargetDateMode)}
            >
              <SelectTrigger id="target-date-mode" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABEL) as TargetDateMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode} className="text-xs">
                    {MODE_LABEL[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {draft.mode === "specific" && (
            <div className="space-y-2">
              <Label htmlFor="target-date-specific" className="text-xs">
                Fecha
              </Label>
              <Input
                id="target-date-specific"
                type="date"
                value={draft.date || ""}
                onChange={(e) =>
                  apply({ mode: "specific", date: e.target.value })
                }
                className="h-8 text-xs"
              />
            </div>
          )}

          {draft.mode === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="target-date-from" className="text-xs">
                  Desde
                </Label>
                <Input
                  id="target-date-from"
                  type="date"
                  value={draft.from || ""}
                  onChange={(e) =>
                    apply({
                      mode: "range",
                      from: e.target.value,
                      to: draft.to,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-date-to" className="text-xs">
                  Hasta
                </Label>
                <Input
                  id="target-date-to"
                  type="date"
                  value={draft.to || ""}
                  onChange={(e) =>
                    apply({
                      mode: "range",
                      from: draft.from,
                      to: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <p className="text-[11px] leading-snug text-muted-foreground">
            El filtro se aplica sobre la fecha objetivo del area actual.
            Las ordenes sin fecha objetivo solo aparecen con el modo
            &quot;Todas&quot;.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Helper de filtrado para usar en los `useMemo` de cada modulo.
 * Retorna las ordenes cuyo campo `targetDateField` cumple el filtro.
 */
export function filterByTargetDate(
  ordenes: Orden[],
  targetDateField: keyof Orden,
  filter: TargetDateFilterValue,
  todayISO: string = getTodayISO()
): Orden[] {
  if (filter.mode === "all") return ordenes
  return ordenes.filter((o) =>
    matchesTargetDate(o[targetDateField], filter, todayISO)
  )
}
