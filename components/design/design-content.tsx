"use client"

import { useMemo, useState } from "react"
import { useDesign } from "@/lib/design-context"
import { Orden } from "@/lib/types"
import { DesignTable } from "./design-table"
import { DesignDetail } from "./design-detail"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Palette, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ProductionFilters,
  INITIAL_PRODUCTION_FILTERS,
  type ProductionFilterState,
} from "@/components/shared/production-filters"
import {
  TargetDateFilter,
  DEFAULT_TARGET_DATE_FILTER,
  matchesTargetDate,
  type TargetDateFilterValue,
} from "@/components/shared/target-date-filter"
import { getDisenoStatus } from "@/lib/production-status"
import { ModuleTabs } from "@/components/incidencias/module-tabs"
import { ModuleResumenCard } from "@/components/shared/module-resumen-card"

const DISENO_ESTADOS = ["Pendiente", "Recibido", "Terminado"] as const

export function DesignContent() {
  const { ordenes, isLoading, error, refreshOrdenes } = useDesign()
  const [selectedOrder, setSelectedOrder] = useState<Orden | null>(null)
  const [filters, setFilters] = useState<ProductionFilterState>(
    INITIAL_PRODUCTION_FILTERS
  )
  const [targetDateFilter, setTargetDateFilter] =
    useState<TargetDateFilterValue>(DEFAULT_TARGET_DATE_FILTER)

  const clientes = useMemo(() => {
    const set = new Set<string>()
    ordenes.forEach((o) => o.cliente && set.add(o.cliente))
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"))
  }, [ordenes])

  const disenadores = useMemo(() => {
    const set = new Set<string>()
    ordenes.forEach((o) => {
      const d = o.ddisenador?.trim()
      if (d) set.add(d)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"))
  }, [ordenes])

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((o) => {
      // Filtro global por fecha objetivo del area (dfecha_objetivo_d).
      if (!matchesTargetDate(o.dfecha_objetivo_d, targetDateFilter)) return false
      if (
        filters.pedido &&
        !o.pedido.toLowerCase().includes(filters.pedido.toLowerCase())
      )
        return false
      if (
        filters.cliente &&
        !(o.cliente ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
      )
        return false
      if (filters.fechaIngreso && o.fecha_de_ingreso !== filters.fechaIngreso)
        return false
      if (filters.urgencia === "urgente" && !o.es_urgente) return false
      if (filters.urgencia === "normal" && o.es_urgente) return false
      if (
        filters.estado.length > 0 &&
        !filters.estado.includes(getDisenoStatus(o))
      )
        return false
      if (filters.disenador && o.ddisenador !== filters.disenador) return false
      return true
    })
  }, [ordenes, filters, targetDateFilter])

  if (selectedOrder) {
    const currentOrder =
      ordenes.find((o) => o.pedido === selectedOrder.pedido) || selectedOrder

    return (
      <DesignDetail
        orden={currentOrder}
        onBack={() => setSelectedOrder(null)}
      />
    )
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-5 text-icon-magenta" />
            Area de Diseno
          </CardTitle>
          <div className="flex items-center gap-2">
            <TargetDateFilter
              value={targetDateFilter}
              onChange={setTargetDateFilter}
              accentClass="text-icon-magenta"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refreshOrdenes}
              disabled={isLoading}
            >
              <RefreshCw
                className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModuleTabs
          area="Diseno"
          accentClass="text-icon-magenta"
          resumenContent={<ModuleResumenCard areaKey="diseno" />}
          ordenesContent={
            <>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Error al cargar las ordenes: {error}
                  </AlertDescription>
                </Alert>
              )}

              {(ordenes.length > 0 || isLoading) && (
                <ProductionFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  clientes={clientes}
                  estadoLabel="Estado Diseno"
                  estadoOptions={DISENO_ESTADOS}
                  accentClass="text-icon-magenta"
                  disenadores={disenadores}
                />
              )}

              {!error && !isLoading && ordenes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay ordenes aprobadas pendientes de diseno.
                </div>
              )}

              {!error &&
                !isLoading &&
                ordenes.length > 0 &&
                filteredOrdenes.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Ninguna orden coincide con los filtros aplicados.
                  </div>
                )}

              {(filteredOrdenes.length > 0 || isLoading) && (
                <DesignTable
                  ordenes={filteredOrdenes}
                  onSelectOrder={setSelectedOrder}
                  isLoading={isLoading}
                />
              )}
            </>
          }
        />
      </CardContent>
    </Card>
  )
}
