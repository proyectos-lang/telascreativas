"use client"

import { useMemo, useState } from "react"
import { useCut } from "@/lib/cut-context"
import { Orden } from "@/lib/types"
import { CutTable } from "./cut-table"
import { CutDetail } from "./cut-detail"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, RefreshCw, Scissors } from "lucide-react"
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
import { getCorteStatus } from "@/lib/production-status"
import { ModuleTabs } from "@/components/incidencias/module-tabs"
import { ModuleResumenCard } from "@/components/shared/module-resumen-card"
import { createClient } from "@supabase/supabase-js"
import { useEffect } from "react"
import { CutCoresTable, type CoreEnCorte } from "./cut-cores-table"
import type { MarkerCore } from "@/lib/marker-context"
import { toast } from "sonner"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CORTE_ESTADOS = ["Pendiente", "Recibido", "Terminado"] as const

export function CutContent() {
  const { ordenes, isLoading, error, refreshOrdenes } = useCut()
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

  // Cores entregados por Marker Digital que Corte todavia debe procesar.
  const [cores, setCores] = useState<MarkerCore[]>([])
  const cargarCores = async () => {
    const { data } = await supabase
      .schema("telas")
      .from("marker_cores")
      .select("*")
      .in("estado", ["Entregado", "Recibido en Corte", "Cortado"])
      .order("fecha_entrega_marker", { ascending: true })
    setCores((data as MarkerCore[]) ?? [])
  }
  useEffect(() => {
    void cargarCores()
  }, [ordenes])

  /**
   * Corte ve dos cosas: los markers (cores) y las ordenes sueltas. Una orden
   * agrupada NO aparece suelta: sus fechas las escribe el core completo.
   */
  const coresEnCorte = useMemo<CoreEnCorte[]>(() => {
    const porCore = new Map<number, Orden[]>()
    for (const o of ordenes) {
      if (o.mdcore_id == null) continue
      const l = porCore.get(o.mdcore_id) ?? []
      l.push(o)
      porCore.set(o.mdcore_id, l)
    }
    return cores
      .map((core) => {
        const os = porCore.get(core.id) ?? []
        return {
          core,
          ordenes: os,
          totalPcs: os.reduce((s, o) => s + (Number(o.pcs) || 0), 0),
          recibido: os.length > 0 && os.every((o) => !!o.cfecha_de_recepcion),
          cortado: os.length > 0 && os.every((o) => !!o.cfecha_de_corte),
        }
      })
      .filter((c) => c.ordenes.length > 0)
  }, [cores, ordenes])

  /** Recibe el marker completo: misma fecha para todas sus ordenes. */
  const recibirCore = async (c: CoreEnCorte) => {
    const hoy = new Date().toISOString().split("T")[0]
    const { error: e } = await supabase
      .schema("telas")
      .from("cabecera")
      .update({ cfecha_de_recepcion: hoy })
      .in(
        "pedido",
        c.ordenes.map((o) => o.pedido)
      )
    if (e) {
      toast.error("No se pudo recibir el marker", { description: e.message })
      return
    }
    await supabase
      .schema("telas")
      .from("marker_cores")
      .update({ estado: "Recibido en Corte", fecha_recepcion_corte: hoy })
      .eq("id", c.core.id)
    await refreshOrdenes()
    toast.success(`Marker ${c.core.nombre} recibido`, {
      description: `${c.ordenes.length} órdenes.`,
    })
  }

  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((o) => {
      // Las ordenes agrupadas en un marker se gestionan desde su core.
      if (o.mdcore_id != null) return false
      // Filtro global por fecha objetivo del area (cfecha_objetivo_c).
      if (!matchesTargetDate(o.cfecha_objetivo_c, targetDateFilter)) return false
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
        !filters.estado.includes(getCorteStatus(o))
      )
        return false
      return true
    })
  }, [ordenes, filters, targetDateFilter])

  if (selectedOrder) {
    const currentOrder =
      ordenes.find((o) => o.pedido === selectedOrder.pedido) || selectedOrder

    return (
      <CutDetail orden={currentOrder} onBack={() => setSelectedOrder(null)} />
    )
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Scissors className="size-5 text-icon-magenta" />
            Area de Corte
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
          area="Corte"
          accentClass="text-icon-magenta"
          resumenContent={<ModuleResumenCard areaKey="corte" />}
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
                  estadoLabel="Estado Corte"
                  estadoOptions={CORTE_ESTADOS}
                  accentClass="text-icon-magenta"
                />
              )}

              {coresEnCorte.length > 0 && (
                <CutCoresTable
                  cores={coresEnCorte}
                  onRecibir={recibirCore}
                  onSelectOrder={setSelectedOrder}
                />
              )}

              {!error && !isLoading && ordenes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay ordenes disponibles para el area de Corte.
                </div>
              )}

              {!error &&
                !isLoading &&
                ordenes.length > 0 &&
                filteredOrdenes.length === 0 &&
                coresEnCorte.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Ninguna orden coincide con los filtros aplicados.
                  </div>
                )}

              {(filteredOrdenes.length > 0 || isLoading) && (
                <CutTable
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
