"use client"

import { useMemo, useState } from "react"
import { useEntregas } from "@/lib/entregas-context"
import { Orden } from "@/lib/types"
import { EntregasTable } from "./entregas-table"
import { EntregasDetail } from "./entregas-detail"
import {
  EntregasFilters,
  INITIAL_ENTREGAS_FILTERS,
  type EntregasFilterState,
} from "./entregas-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, CalendarDays, ClipboardList, RefreshCw, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModuleResumenCard } from "@/components/shared/module-resumen-card"

export function EntregasContent() {
  const { ordenes, isLoading, error, refreshOrdenes } = useEntregas()
  const [selectedOrder, setSelectedOrder] = useState<Orden | null>(null)
  const [filters, setFilters] = useState<EntregasFilterState>(
    INITIAL_ENTREGAS_FILTERS
  )

  // Listas unicas para alimentar los selects de los filtros. Se calculan
  // sobre el dataset completo (no filtrado) para que siempre haya opciones
  // visibles aunque haya un filtro activo que vacie la tabla.
  const { clientes, vendedoras, ciudades } = useMemo(() => {
    const c = new Set<string>()
    const v = new Set<string>()
    const ci = new Set<string>()
    for (const o of ordenes) {
      if (o.cliente) c.add(o.cliente)
      if (o.vendedora) v.add(o.vendedora)
      if (o.ciudad) ci.add(o.ciudad)
    }
    const sortEs = (a: string, b: string) => a.localeCompare(b, "es")
    return {
      clientes: Array.from(c).sort(sortEs),
      vendedoras: Array.from(v).sort(sortEs),
      ciudades: Array.from(ci).sort(sortEs),
    }
  }, [ordenes])

  // Aplicacion de filtros client-side. La fecha de entrega se compara solo
  // por la porcion YYYY-MM-DD para evitar problemas de timezone.
  const filteredOrdenes = useMemo(() => {
    const pedidoQ = filters.pedido.trim().toLowerCase()
    return ordenes.filter((o) => {
      if (pedidoQ && !(o.pedido || "").toLowerCase().includes(pedidoQ)) {
        return false
      }
      if (filters.cliente && o.cliente !== filters.cliente) return false
      if (filters.vendedora && o.vendedora !== filters.vendedora) return false
      if (filters.ciudad && o.ciudad !== filters.ciudad) return false
      if (filters.fechaEntrega) {
        // Filtramos por la fecha comprometida con el cliente (`fecha_de_entrega`),
        // misma columna que muestra la tabla. Comparamos solo YYYY-MM-DD para
        // evitar desfases por timezone al parsear timestamps.
        const raw = o.fecha_de_entrega || ""
        const ymd = typeof raw === "string" ? raw.slice(0, 10) : ""
        if (ymd !== filters.fechaEntrega) return false
      }
      return true
    })
  }, [ordenes, filters])

  if (selectedOrder) {
    const currentOrder =
      ordenes.find((o) => o.pedido === selectedOrder.pedido) || selectedOrder

    return (
      <EntregasDetail
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
            <Truck className="size-5 text-icon-coral" />
            Area de Entregas (Vendedoras)
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="ordenes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="ordenes" className="gap-2">
              <ClipboardList className="size-4" />
              Ordenes Activas
            </TabsTrigger>
            <TabsTrigger value="resumen" className="gap-2">
              <CalendarDays className="size-4" />
              Resumen del Dia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ordenes" className="mt-4 space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Error al cargar las ordenes: {error}
                </AlertDescription>
              </Alert>
            )}

            {(ordenes.length > 0 || isLoading) && (
              <EntregasFilters
                filters={filters}
                onFiltersChange={setFilters}
                clientes={clientes}
                vendedoras={vendedoras}
                ciudades={ciudades}
              />
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
              <EntregasTable
                ordenes={filteredOrdenes}
                onSelectOrder={setSelectedOrder}
                isLoading={isLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="resumen" className="mt-4">
            <ModuleResumenCard areaKey="entregas" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
