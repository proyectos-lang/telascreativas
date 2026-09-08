"use client"

/**
 * Módulo Marker Digital.
 *
 * Mismas vistas que el resto de las áreas de producción, más una pestaña
 * propia de "Agrupación de cores" donde el sistema sugiere qué órdenes se
 * pueden cortar juntas por compartir tela.
 */

import { useMemo, useState } from "react"
import { Orden } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Boxes, Layers, RefreshCw, Ruler } from "lucide-react"
import { useMarker } from "@/lib/marker-context"
import { getMarkerStatus } from "@/lib/production-status"
import { ModuleTabs } from "@/components/incidencias/module-tabs"
import { ModuleResumenCard } from "@/components/shared/module-resumen-card"
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
import { MarkerTable } from "./marker-table"
import { MarkerDetail } from "./marker-detail"
import { MarkerCoresSugeridos } from "./marker-cores-sugeridos"
import { MarkerPiezasExtraTab } from "./marker-piezas-extra-tab"

const MARKER_ESTADOS = ["Pendiente", "Recibido", "Terminado"] as const

export function MarkerContent() {
  const { ordenes, cores, isLoading, error, refreshOrdenes } = useMarker()
  const [selected, setSelected] = useState<Orden | null>(null)
  const [filters, setFilters] = useState<ProductionFilterState>(
    INITIAL_PRODUCTION_FILTERS
  )
  const [targetDate, setTargetDate] = useState<TargetDateFilterValue>(
    DEFAULT_TARGET_DATE_FILTER
  )

  const clientes = useMemo(
    () =>
      [...new Set(ordenes.map((o) => o.cliente).filter(Boolean))].sort() as string[],
    [ordenes]
  )

  const filtradas = useMemo(
    () =>
      ordenes.filter((o) => {
        if (!matchesTargetDate(o.mdfecha_objetivo_md, targetDate)) return false
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
          !filters.estado.includes(getMarkerStatus(o))
        )
          return false
        return true
      }),
    [ordenes, filters, targetDate]
  )

  if (selected) {
    const actual = ordenes.find((o) => o.pedido === selected.pedido) || selected
    return (
      <MarkerDetail
        orden={actual}
        cores={cores}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="size-5 text-icon-cyan" />
              Marker Digital
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Trazos de corte. Agrupa órdenes que comparten tela para cortarlas
              en volumen.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TargetDateFilter value={targetDate} onChange={setTargetDate} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshOrdenes()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModuleTabs
          area="Marker"
          accentClass="text-icon-cyan"
          resumenContent={<ModuleResumenCard areaKey="marker" />}
          extraTab={{
            value: "cores",
            label: "Agrupación de cores",
            icon: Layers,
            content: <MarkerCoresSugeridos />,
          }}
          extraTabs={[
            {
              value: "piezas-extra",
              label: "Piezas extra",
              icon: Boxes,
              content: <MarkerPiezasExtraTab />,
            },
          ]}
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
                  estadoLabel="Estado Marker"
                  estadoOptions={MARKER_ESTADOS}
                  accentClass="text-icon-cyan"
                />
              )}

              {!error && !isLoading && ordenes.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No hay ordenes marcadas como Marker Digital.
                </div>
              )}

              {!error &&
                !isLoading &&
                ordenes.length > 0 &&
                filtradas.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Ninguna orden coincide con los filtros aplicados.
                  </div>
                )}

              {(filtradas.length > 0 || isLoading) && (
                <MarkerTable
                  ordenes={filtradas}
                  cores={cores}
                  onSelectOrder={setSelected}
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
