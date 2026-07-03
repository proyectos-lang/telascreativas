"use client"

import { useState, useMemo } from "react"
import { Orden } from "@/lib/types"
import { useOrders } from "@/lib/orders-context"
import { OrdersTable } from "./orders-table"
import { OrderDetail } from "./order-detail"
import { OrdersFilters, INITIAL_FILTERS, type OrderFilters } from "./orders-filters"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, AlertCircle, RefreshCw, PenLine, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ManualOrderView } from "./manual-order-view"

export function OrdersContent() {
  const { ordenes, isLoading, error, updateOrden, refreshOrdenes } = useOrders()
  const [selectedOrder, setSelectedOrder] = useState<Orden | null>(null)
  const [filters, setFilters] = useState<OrderFilters>(INITIAL_FILTERS)
  const [showManualView, setShowManualView] = useState(false)

  // Extract unique clientes and vendedoras for filter dropdowns
  const { clientes, vendedoras } = useMemo(() => {
    const clientesSet = new Set<string>()
    const vendedorasSet = new Set<string>()
    ordenes.forEach((orden) => {
      if (orden.cliente) clientesSet.add(orden.cliente)
      if (orden.vendedora) vendedorasSet.add(orden.vendedora)
    })
    return {
      clientes: Array.from(clientesSet).sort(),
      vendedoras: Array.from(vendedorasSet).sort(),
    }
  }, [ordenes])

  // Historial de canceladas (tab separado)
  const canceladas = useMemo(
    () =>
      ordenes.filter(
        (o) =>
          (o.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase() ===
          "cancelado"
      ),
    [ordenes]
  )

  // Apply filters to ordenes (siempre se ocultan las canceladas, no
  // deben aparecer en ningun modulo, incluido este).
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((orden) => {
      // Excluir canceladas en TODOS los flujos
      const estado = (orden.estado_aprobado_rechazado ?? "")
        .toString()
        .trim()
        .toLowerCase()
      if (estado === "cancelado") return false

      // Filter by pedido (case insensitive substring)
      if (
        filters.pedido &&
        !orden.pedido?.toLowerCase().includes(filters.pedido.toLowerCase())
      ) {
        return false
      }

      // Filter by cliente (case-insensitive partial match)
      if (
        filters.cliente &&
        !(orden.cliente ?? "").toLowerCase().includes(filters.cliente.toLowerCase())
      ) {
        return false
      }

      // Filter by vendedora (exact match)
      if (filters.vendedora && orden.vendedora !== filters.vendedora) {
        return false
      }

      // Filter by fecha de ingreso (exact date match)
      if (filters.fechaIngreso && orden.fecha_de_ingreso) {
        const ordenDate = new Date(orden.fecha_de_ingreso).toISOString().split("T")[0]
        if (ordenDate !== filters.fechaIngreso) {
          return false
        }
      }

      // Filter by urgencia
      if (filters.urgencia === "urgente" && !orden.es_urgente) {
        return false
      }
      if (filters.urgencia === "normal" && orden.es_urgente) {
        return false
      }

      // Filter by estado (seleccion multiple)
      if (filters.estado.length > 0) {
        const estadoOrden = orden.estado_aprobado_rechazado || "Pendiente"
        if (!filters.estado.includes(estadoOrden)) {
          return false
        }
      }

      return true
    })
  }, [ordenes, filters])

  if (showManualView) {
    return (
      <ManualOrderView
        onBack={() => setShowManualView(false)}
        onSuccess={refreshOrdenes}
      />
    )
  }

  if (selectedOrder) {
    const currentOrder = ordenes.find((o) => o.pedido === selectedOrder.pedido) || selectedOrder
    return (
      <OrderDetail
        orden={currentOrder}
        onBack={() => setSelectedOrder(null)}
        onUpdateOrden={updateOrden}
        isLoading={isLoading}
      />
    )
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary p-2">
              <CalendarDays className="size-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle>Programacion de Ordenes</CardTitle>
              <CardDescription>
                Gestione y programe las ordenes de produccion textil
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualView(true)}
            >
              <PenLine className="size-4 mr-2" />
              Ingreso Manual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshOrdenes}
              disabled={isLoading}
            >
              <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="programacion">
          <TabsList>
            <TabsTrigger value="programacion">Programación</TabsTrigger>
            <TabsTrigger value="canceladas" className="gap-1.5">
              <Ban className="size-3.5" />
              Canceladas
              {canceladas.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {canceladas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Programación (vista principal) */}
          <TabsContent value="programacion" className="space-y-4 mt-4">
            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error de Supabase</AlertTitle>
                <AlertDescription className="mt-2">
                  <code className="text-sm bg-destructive/20 px-2 py-1 rounded">
                    {error}
                  </code>
                </AlertDescription>
              </Alert>
            )}

            {/* Filters */}
            {!error && ordenes.length > 0 && (
              <OrdersFilters
                filters={filters}
                onFiltersChange={setFilters}
                clientes={clientes}
                vendedoras={vendedoras}
              />
            )}

            {/* Results counter */}
            {!error && ordenes.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Mostrando {filteredOrdenes.length} de {ordenes.length - canceladas.length} ordenes
              </div>
            )}

            {/* Empty state - no data at all */}
            {!isLoading && !error && ordenes.length === 0 && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>Sin datos</AlertTitle>
                <AlertDescription>
                  No hay ordenes registradas o verifica las politicas RLS en Supabase.
                </AlertDescription>
              </Alert>
            )}

            {/* Empty state - filters applied but no results */}
            {!isLoading && !error && ordenes.length > 0 && filteredOrdenes.length === 0 && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>Sin resultados</AlertTitle>
                <AlertDescription>
                  No se encontraron ordenes que coincidan con los filtros aplicados.
                </AlertDescription>
              </Alert>
            )}

            {/* Table */}
            {filteredOrdenes.length > 0 && (
              <OrdersTable
                ordenes={filteredOrdenes}
                onSelectOrder={setSelectedOrder}
                isLoading={isLoading}
              />
            )}

            {/* Loading state */}
            {isLoading && ordenes.length === 0 && (
              <OrdersTable
                ordenes={[]}
                onSelectOrder={setSelectedOrder}
                isLoading={isLoading}
              />
            )}
          </TabsContent>

          {/* Tab: Historial de canceladas */}
          <TabsContent value="canceladas" className="mt-4">
            {canceladas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Ban className="size-8 opacity-30" />
                <p className="text-sm">No hay órdenes canceladas.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedora</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Fecha Ingreso</TableHead>
                      <TableHead>Fecha Programación</TableHead>
                      <TableHead>Tipo de Orden</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {canceladas.map((orden) => {
                      const flujo = (orden.tipo_flujo_especial ?? "PRODUCCION_NORMAL")
                        .toString()
                        .replace(/_/g, " ")
                      return (
                        <TableRow
                          key={orden.pedido}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setSelectedOrder(orden)}
                        >
                          <TableCell className="font-medium font-mono text-sm">
                            {orden.pedido}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {orden.cliente || "-"}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate">
                            {orden.vendedora || "-"}
                          </TableCell>
                          <TableCell>{orden.ciudad || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {orden.fecha_de_ingreso
                              ? new Date(orden.fecha_de_ingreso).toLocaleDateString("es-CO", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "UTC",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {orden.fecha_programacion
                              ? new Date(orden.fecha_programacion).toLocaleDateString("es-CO", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "UTC",
                                })
                              : "Sin programar"}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground capitalize">
                              {flujo.charAt(0).toUpperCase() + flujo.slice(1).toLowerCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-slate-500 text-white hover:bg-slate-600 text-xs">
                              <Ban className="mr-1 size-3" />
                              Cancelada
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {canceladas.length} orden{canceladas.length !== 1 ? "es" : ""} cancelada{canceladas.length !== 1 ? "s" : ""}
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
