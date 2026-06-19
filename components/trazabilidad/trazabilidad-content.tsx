"use client"

import { useEffect, useState } from "react"
import { useTrazabilidad } from "@/lib/trazabilidad-context"
import { useAppNavigation } from "@/lib/app-navigation"
import { Orden } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrazabilidadFilters } from "./trazabilidad-filters"
import { TrazabilidadCard } from "./trazabilidad-card"
import { TrazabilidadList } from "./trazabilidad-list"
import { TrazabilidadDetail } from "./trazabilidad-detail"
import {
  LayoutGrid,
  List,
  Loader2,
  PackageSearch,
  RefreshCw,
  Route,
} from "lucide-react"

type ViewMode = "cards" | "list"

export function TrazabilidadContent() {
  const { ordenes, filtered, isLoading, error, refreshOrdenes } =
    useTrazabilidad()
  const { pendingPedidoFocus, clearPedidoFocus } = useAppNavigation()
  const [selected, setSelected] = useState<Orden | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("cards")

  // Si otro modulo nos envia aqui con un pedido pendiente (ej. el Radar de
  // Riesgo del Dashboard hace click en "Ver"), abrimos el detalle completo
  // de ese pedido en cuanto la lista base (`ordenes`, sin filtros) esta
  // cargada. Usamos `ordenes` y no `filtered` para poder enfocar el pedido
  // incluso si los filtros vigentes lo estarian ocultando.
  useEffect(() => {
    if (!pendingPedidoFocus) return
    if (isLoading) return
    if (ordenes.length === 0) return

    const match = ordenes.find((o) => o.pedido === pendingPedidoFocus)
    if (match) {
      setSelected(match)
    }
    // Limpiamos siempre: si no se encontro, no queremos re-intentar en loop.
    clearPedidoFocus()
  }, [pendingPedidoFocus, ordenes, isLoading, clearPedidoFocus])

  if (selected) {
    return (
      <TrazabilidadDetail
        orden={selected}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="size-4 text-icon-magenta" />
              Mis Pedidos (Trazabilidad Comercial)
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Toggle de vista: tarjetas vs lista */}
              <div
                className="inline-flex rounded-md border bg-muted/40 p-0.5"
                role="group"
                aria-label="Cambiar vista"
              >
                <Button
                  type="button"
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="h-8 px-2.5"
                  aria-pressed={viewMode === "cards"}
                >
                  <LayoutGrid className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Tarjetas</span>
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 px-2.5"
                  aria-pressed={viewMode === "list"}
                >
                  <List className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
              </div>
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
        <CardContent>
          <TrazabilidadFilters />
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-icon-magenta" />
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-rose-600">Error al cargar: {error}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <PackageSearch className="size-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm">
              No se encontraron pedidos con los filtros actuales.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length > 0 && viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o) => (
            <TrazabilidadCard key={o.id} orden={o} onSelect={setSelected} />
          ))}
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && viewMode === "list" && (
        <TrazabilidadList ordenes={filtered} onSelect={setSelected} />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando {filtered.length}{" "}
          {filtered.length === 1 ? "pedido" : "pedidos"}
        </p>
      )}
    </div>
  )
}
