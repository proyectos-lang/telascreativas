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

/**
 * Filtros del modulo de Entregas.
 *
 * Campos requeridos por el negocio: Cliente, Vendedora, Ciudad y Fecha
 * de Entrega al cliente. Se agrega ademas un buscador de "Pedido" como
 * atajo de uso frecuente.
 *
 * Todos los selects listan valores extraidos de las ordenes actualmente
 * visibles (`clientes`, `vendedoras`, `ciudades`) para evitar opciones
 * muertas.
 */

export interface EntregasFilterState {
  pedido: string
  cliente: string
  vendedora: string
  ciudad: string
  fechaEntrega: string
}

export const INITIAL_ENTREGAS_FILTERS: EntregasFilterState = {
  pedido: "",
  cliente: "",
  vendedora: "",
  ciudad: "",
  fechaEntrega: "",
}

interface EntregasFiltersProps {
  filters: EntregasFilterState
  onFiltersChange: (filters: EntregasFilterState) => void
  clientes: string[]
  vendedoras: string[]
  ciudades: string[]
}

export function EntregasFilters({
  filters,
  onFiltersChange,
  clientes,
  vendedoras,
  ciudades,
}: EntregasFiltersProps) {
  const updateFilter = <K extends keyof EntregasFilterState>(
    key: K,
    value: EntregasFilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange(INITIAL_ENTREGAS_FILTERS)
  }

  const hasActiveFilters =
    filters.pedido !== "" ||
    filters.cliente !== "" ||
    filters.vendedora !== "" ||
    filters.ciudad !== "" ||
    filters.fechaEntrega !== ""

  return (
    <div className="rounded-lg border border-border/40 bg-white/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-icon-coral" />
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Pedido */}
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filter-pedido" className="text-xs">
            Pedido
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="entregas-filter-pedido"
              placeholder="Buscar pedido..."
              value={filters.pedido}
              onChange={(e) => updateFilter("pedido", e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Cliente */}
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filter-cliente" className="text-xs">
            Cliente
          </Label>
          <Select
            value={filters.cliente || "todos"}
            onValueChange={(value) =>
              updateFilter("cliente", value === "todos" ? "" : value)
            }
          >
            <SelectTrigger id="entregas-filter-cliente" className="h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todos
              </SelectItem>
              {clientes.map((cliente) => (
                <SelectItem key={cliente} value={cliente} className="text-xs">
                  {cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vendedora */}
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filter-vendedora" className="text-xs">
            Vendedora
          </Label>
          <Select
            value={filters.vendedora || "todas"}
            onValueChange={(value) =>
              updateFilter("vendedora", value === "todas" ? "" : value)
            }
          >
            <SelectTrigger
              id="entregas-filter-vendedora"
              className="h-8 text-xs"
            >
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Todas
              </SelectItem>
              {vendedoras.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ciudad */}
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filter-ciudad" className="text-xs">
            Ciudad
          </Label>
          <Select
            value={filters.ciudad || "todas"}
            onValueChange={(value) =>
              updateFilter("ciudad", value === "todas" ? "" : value)
            }
          >
            <SelectTrigger id="entregas-filter-ciudad" className="h-8 text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas" className="text-xs">
                Todas
              </SelectItem>
              {ciudades.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha de Entrega */}
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filter-fecha" className="text-xs">
            Fecha de Entrega
          </Label>
          <Input
            id="entregas-filter-fecha"
            type="date"
            value={filters.fechaEntrega}
            onChange={(e) => updateFilter("fechaEntrega", e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  )
}
