"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search, X, Filter } from "lucide-react"
import { ClienteCombobox } from "@/components/shared/cliente-combobox"
import { MultiSelectFilter } from "@/components/shared/multi-select-filter"

/**
 * Filtros reutilizables para los modulos de produccion
 * (Diseno, Corte, Impresion, Sublimacion, Costura, Empaque).
 *
 * Cada modulo pasa su propia lista de `estadoOptions`, ya que el estado
 * "Recibido" (Diseno..Costura) se llama "En Proceso" en Empaque.
 */

export interface ProductionFilterState {
  pedido: string
  cliente: string
  fechaIngreso: string
  urgencia: "todos" | "urgente" | "normal"
  /**
   * Estados seleccionados (seleccion multiple). Arreglo vacio = "Todos".
   * Cada valor corresponde a una de las `estadoOptions`.
   */
  estado: string[]
  /**
   * Filtro opcional por responsable del area. Hoy solo lo usa Diseno
   * (campo `ddisenador`), pero se deja en el estado compartido por
   * simplicidad: los modulos que no lo usan simplemente no lo setean.
   */
  disenador: string
}

export const INITIAL_PRODUCTION_FILTERS: ProductionFilterState = {
  pedido: "",
  cliente: "",
  fechaIngreso: "",
  urgencia: "todos",
  estado: [],
  disenador: "",
}

interface ProductionFiltersProps {
  filters: ProductionFilterState
  onFiltersChange: (filters: ProductionFilterState) => void
  /** Lista unica de clientes presentes en las ordenes filtrables */
  clientes: string[]
  /** Label del campo "Estado" (ej: "Estado Diseno", "Estado Empaque") */
  estadoLabel: string
  /** Valores posibles del Select de estado (sin "Todos") */
  estadoOptions: readonly string[]
  /** Color del icono del header ("text-icon-magenta", "text-icon-cyan", etc.) */
  accentClass?: string
  /**
   * Lista unica de disenadores. Si se provee, se renderiza un Select
   * adicional para filtrar por responsable. Solo lo usa el modulo de Diseno.
   */
  disenadores?: string[]
}

export function ProductionFilters({
  filters,
  onFiltersChange,
  clientes,
  estadoLabel,
  estadoOptions,
  accentClass = "text-icon-magenta",
  disenadores,
}: ProductionFiltersProps) {
  const updateFilter = <K extends keyof ProductionFilterState>(
    key: K,
    value: ProductionFilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(INITIAL_PRODUCTION_FILTERS)
  }

  const showDisenadorFilter = Array.isArray(disenadores)
  const hasActiveFilters =
    filters.pedido !== "" ||
    filters.cliente !== "" ||
    filters.fechaIngreso !== "" ||
    filters.urgencia !== "todos" ||
    filters.estado.length > 0 ||
    (showDisenadorFilter && filters.disenador !== "")

  return (
    <div className="rounded-lg border border-border/40 bg-white/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className={`size-4 ${accentClass}`} />
          <h3 className="text-sm font-semibold">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs"
          >
            <X className="mr-1 size-3" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div
        className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
          showDisenadorFilter ? "xl:grid-cols-6" : "xl:grid-cols-5"
        }`}
      >
        {/* Pedido */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-pedido" className="text-xs">
            Pedido
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="filter-pedido"
              placeholder="Buscar pedido..."
              value={filters.pedido}
              onChange={(e) => updateFilter("pedido", e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-cliente" className="text-xs">
            Cliente
          </Label>
          <ClienteCombobox
            id="filter-cliente"
            value={filters.cliente}
            clientes={clientes}
            onChange={(value) => updateFilter("cliente", value)}
          />
        </div>

        {/* Fecha de Ingreso */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-fecha" className="text-xs">
            Fecha de Ingreso
          </Label>
          <Input
            id="filter-fecha"
            type="date"
            value={filters.fechaIngreso}
            onChange={(e) => updateFilter("fechaIngreso", e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Urgencia */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-urgencia" className="text-xs">
            Urgencia
          </Label>
          <Select
            value={filters.urgencia}
            onValueChange={(value) =>
              updateFilter(
                "urgencia",
                value as ProductionFilterState["urgencia"]
              )
            }
          >
            <SelectTrigger id="filter-urgencia" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todas
              </SelectItem>
              <SelectItem value="urgente" className="text-xs">
                Urgente
              </SelectItem>
              <SelectItem value="normal" className="text-xs">
                Normal
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estado del proceso - seleccion multiple */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-estado" className="text-xs">
            {estadoLabel}
          </Label>
          <MultiSelectFilter
            id="filter-estado"
            value={filters.estado}
            options={estadoOptions}
            onChange={(value) => updateFilter("estado", value)}
          />
        </div>

        {/* Disenador - opcional, solo se renderiza si el modulo
            (actualmente Diseno) pasa la lista. */}
        {showDisenadorFilter && (
          <div className="space-y-1.5">
            <Label htmlFor="filter-disenador" className="text-xs">
              Disenador
            </Label>
            <Select
              value={filters.disenador || "todos"}
              onValueChange={(value) =>
                updateFilter("disenador", value === "todos" ? "" : value)
              }
            >
              <SelectTrigger id="filter-disenador" className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos
                </SelectItem>
                {disenadores!.map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
