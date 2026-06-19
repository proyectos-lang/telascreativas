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
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Search,
  X,
} from "lucide-react"
import {
  useTrazabilidad,
  type TrazabilidadFilters as TrazabilidadFiltersType,
} from "@/lib/trazabilidad-context"

export function TrazabilidadFilters() {
  const {
    clientes,
    vendedoras,
    filters,
    setFilters,
    resetFilters,
    hideDelivered,
    setHideDelivered,
    deliveredCount,
  } = useTrazabilidad()

  const updateFilter = <K extends keyof TrazabilidadFiltersType>(
    key: K,
    value: TrazabilidadFiltersType[K]
  ) => {
    setFilters({ ...filters, [key]: value })
  }

  const hasActiveFilters =
    filters.pedido !== "" ||
    filters.cliente !== "" ||
    filters.vendedora !== "" ||
    filters.fechaIngreso !== "" ||
    filters.fechaEntrega !== "" ||
    filters.urgencia !== "todos"

  return (
    <div className="space-y-4">
      {/* Bloque principal de filtros - mismo set que el modulo Programacion */}
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
              onClick={resetFilters}
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
            <Label htmlFor="trz-filter-pedido" className="text-xs">
              Pedido
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                id="trz-filter-pedido"
                placeholder="Buscar pedido..."
                value={filters.pedido}
                onChange={(e) => updateFilter("pedido", e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="trz-filter-cliente" className="text-xs">
              Cliente
            </Label>
            <Select
              value={filters.cliente || "todos"}
              onValueChange={(value) =>
                updateFilter("cliente", value === "todos" ? "" : value)
              }
            >
              <SelectTrigger id="trz-filter-cliente" className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos
                </SelectItem>
                {clientes.map((cliente) => (
                  <SelectItem
                    key={cliente}
                    value={cliente}
                    className="text-xs"
                  >
                    {cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendedora */}
          <div className="space-y-1.5">
            <Label htmlFor="trz-filter-vendedora" className="text-xs">
              Vendedora
            </Label>
            <Select
              value={filters.vendedora || "todos"}
              onValueChange={(value) =>
                updateFilter("vendedora", value === "todos" ? "" : value)
              }
            >
              <SelectTrigger
                id="trz-filter-vendedora"
                className="h-8 text-xs"
              >
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
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

          {/* Fecha de Ingreso */}
          <div className="space-y-1.5">
            <Label htmlFor="trz-filter-fecha" className="text-xs">
              Fecha de Ingreso
            </Label>
            <Input
              id="trz-filter-fecha"
              type="date"
              value={filters.fechaIngreso}
              onChange={(e) => updateFilter("fechaIngreso", e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Fecha de Entrega comprometida (telas.cabecera.fecha_de_entrega) */}
          <div className="space-y-1.5">
            <Label htmlFor="trz-filter-fecha-entrega" className="text-xs">
              Fecha de Entrega
            </Label>
            <Input
              id="trz-filter-fecha-entrega"
              type="date"
              value={filters.fechaEntrega}
              onChange={(e) => updateFilter("fechaEntrega", e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Urgencia */}
          <div className="space-y-1.5">
            <Label htmlFor="trz-filter-urgencia" className="text-xs">
              Urgencia
            </Label>
            <Select
              value={filters.urgencia}
              onValueChange={(value) =>
                updateFilter(
                  "urgencia",
                  value as TrazabilidadFiltersType["urgencia"]
                )
              }
            >
              <SelectTrigger
                id="trz-filter-urgencia"
                className="h-8 text-xs"
              >
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
        </div>
      </div>

      {/* Toggle para ocultar/mostrar pedidos ya entregados al cliente. Se
          mantiene como bloque independiente porque es una funcion exclusiva
          de "Mis Pedidos" (no existe en Programacion). */}
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">
              {hideDelivered
                ? "Pedidos ya entregados ocultos"
                : "Mostrando todos los pedidos"}
            </span>
            {deliveredCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
              >
                {deliveredCount} entregado{deliveredCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHideDelivered(!hideDelivered)}
          className="shrink-0 bg-white"
        >
          {hideDelivered ? (
            <>
              <Eye className="mr-1.5 size-3.5" />
              Mostrar entregados
            </>
          ) : (
            <>
              <EyeOff className="mr-1.5 size-3.5" />
              Ocultar entregados
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
