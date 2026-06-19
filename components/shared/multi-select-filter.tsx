"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronDown } from "lucide-react"

/**
 * Filtro de seleccion multiple reutilizable (Popover + checkboxes).
 *
 * Se usa para los filtros de "Estado" de los modulos, permitiendo elegir
 * varios estados a la vez. Una seleccion vacia equivale a "Todos".
 *
 * El estado seleccionado se maneja afuera como `string[]`.
 */
interface MultiSelectFilterProps {
  /** id para asociar el label */
  id?: string
  /** Valores actualmente seleccionados */
  value: string[]
  /** Opciones disponibles (sin "Todos") */
  options: readonly string[]
  /** Callback con la nueva seleccion */
  onChange: (value: string[]) => void
  /** Texto cuando no hay seleccion (default "Todos") */
  allLabel?: string
  /** Clase extra para el trigger */
  className?: string
}

export function MultiSelectFilter({
  id,
  value,
  options,
  onChange,
  allLabel = "Todos",
  className = "",
}: MultiSelectFilterProps) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  const label =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? value[0]
        : `${value.length} seleccionados`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={`h-8 w-full justify-between px-3 text-xs font-normal ${className}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <button
          type="button"
          onClick={() => onChange([])}
          className="mb-1 w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          {allLabel}
        </button>
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-slate-100"
            >
              <Checkbox
                checked={value.includes(option)}
                onCheckedChange={() => toggle(option)}
              />
              <span className="text-slate-700">{option}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
