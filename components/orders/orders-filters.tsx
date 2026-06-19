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

const ESTADO_OPCIONES = ["Pendiente", "Aprobado", "Rechazado"] as const

export interface OrderFilters {
  pedido: string
  cliente: string
  vendedora: string
  fechaIngreso: string
  urgencia: "todos" | "urgente" | "normal"
  /** Estados seleccionados (multiple). Vacio = todos. */
  estado: string[]
}

export const INITIAL_FILTERS: OrderFilters = {
  pedido: "",
  cliente: "",
  vendedora: "",
  fechaIngreso: "",
  urgencia: "todos",
  estado: [],
}

interface OrdersFiltersProps {
  filters: OrderFilters
  onFiltersChange: (filters: OrderFilters) => void
  clientes: string[]
  vendedoras: string[]
}

export function OrdersFilters({
  filters,
  onFiltersChange,
  clientes,
  vendedoras,
}: OrdersFiltersProps) {
  const updateFilter = <K extends keyof OrderFilters>(
    key: K,
    value: OrderFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(INITIAL_FILTERS)
  }

  const hasActiveFilters =
    filters.pedido !== "" ||
    filters.cliente !== "" ||
    filters.vendedora !== "" ||
    filters.fechaIngreso !== "" ||
    filters.urgencia !== "todos" ||
    filters.estado.length > 0

  return (
    <div className="rounded-lg border border-border/40 bg-white/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-icon-magenta" />
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

        {/* Vendedora */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-vendedora" className="text-xs">
            Vendedora
          </Label>
          <Select
            value={filters.vendedora || "todos"}
            onValueChange={(value) =>
              updateFilter("vendedora", value === "todos" ? "" : value)
            }
          >
            <SelectTrigger id="filter-vendedora" className="h-8 text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todas
              </SelectItem>
              {vendedoras.map((vendedora) => (
                <SelectItem key={vendedora} value={vendedora} className="text-xs">
                  {vendedora}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              updateFilter("urgencia", value as OrderFilters["urgencia"])
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

        {/* Estado - seleccion multiple */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-estado" className="text-xs">
            Estado
          </Label>
          <MultiSelectFilter
            id="filter-estado"
            value={filters.estado}
            options={ESTADO_OPCIONES}
            onChange={(value) => updateFilter("estado", value)}
          />
        </div>
      </div>
    </div>
  )
}
