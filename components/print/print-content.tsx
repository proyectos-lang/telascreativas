"use client"

import { useMemo, useState } from "react"
import { usePrint } from "@/lib/print-context"
import { Orden } from "@/lib/types"
import { PrintTable } from "./print-table"
import { PrintDetail } from "./print-detail"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Printer, RefreshCw } from "lucide-react"
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
import { getImpresionStatus } from "@/lib/production-status"
import { ModuleTabs } from "@/components/incidencias/module-tabs"
import { ModuleResumenCard } from "@/components/shared/module-resumen-card"

const IMPRESION_ESTADOS = ["Pendiente", "Recibido", "Terminado"] as const

export function PrintContent() {
  const { ordenes, isLoading, error, refreshOrdenes } = usePrint()
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

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((o) => {
      // Filtro global por fecha objetivo del area (ifecha_objetivo_i).
      if (!matchesTargetDate(o.ifecha_objetivo_i, targetDateFilter)) return false
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
        !filters.estado.includes(getImpresionStatus(o))
      )
        return false
      return true
    })
  }, [ordenes, filters, targetDateFilter])

  if (selectedOrder) {
    const currentOrder =
      ordenes.find((o) => o.pedido === selectedOrder.pedido) || selectedOrder

    return (
      <PrintDetail orden={currentOrder} onBack={() => setSelectedOrder(null)} />
    )
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Printer className="size-5 text-icon-cyan" />
            Area de Impresion
          </CardTitle>
          <div className="flex items-center gap-2">
            <TargetDateFilter
              value={targetDateFilter}
              onChange={setTargetDateFilter}
              accentClass="text-icon-cyan"
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
          area="Impresion"
          accentClass="text-icon-cyan"
          resumenContent={<ModuleResumenCard areaKey="impresion" />}
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
                  estadoLabel="Estado Impresion"
                  estadoOptions={IMPRESION_ESTADOS}
                  accentClass="text-icon-cyan"
                />
              )}

              {!error && !isLoading && ordenes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay ordenes disponibles para el area de Impresion.
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
                <PrintTable
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
