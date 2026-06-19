"use client"

/**
 * Barra de filtros del Reporte de Incidencias.
 *
 * Filtros expuestos:
 *  - Estado de reposicion (todos / pendiente / procesado / sin reposicion)
 *  - Area responsable (lista dinamica desde los datos)
 *  - Rango de fechas (Desde / Hasta) — los inputs nativos son rapidos
 *    para escribir y son accesibles, evitamos un date picker custom.
 *  - Busqueda libre (pedido, descripcion, motivo, etc.)
 *
 * Importante: estos filtros aplican a TODA la vista (KPIs, charts,
 * tabla) porque el contexto los aplica antes de derivar memos. Esto da
 * una experiencia "drilldown" coherente.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Filter, RotateCcw, Search } from "lucide-react"
import { useIncidenciasReporte } from "@/lib/incidencias-reporte-context"

export function IncidenciasFilters() {
  const { filtros, setFiltros, resetFiltros, areasGenera } =
    useIncidenciasReporte()

  return (
    <Card className="bg-white/90 backdrop-blur shadow-sm">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Filter className="size-4 text-slate-700" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {/* Estado */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={filtros.estado}
              onValueChange={(v) =>
                setFiltros({ estado: v as typeof filtros.estado })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="procesado">Procesadas</SelectItem>
                <SelectItem value="sin">Sin reposicion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Area */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Area responsable
            </Label>
            <Select
              value={filtros.area}
              onValueChange={(v) => setFiltros({ area: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {areasGenera.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desde */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="f_desde">
              Desde
            </Label>
            <Input
              id="f_desde"
              type="date"
              value={filtros.desde ?? ""}
              onChange={(e) => setFiltros({ desde: e.target.value || null })}
              className="h-9"
            />
          </div>

          {/* Hasta */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="f_hasta">
              Hasta
            </Label>
            <Input
              id="f_hasta"
              type="date"
              value={filtros.hasta ?? ""}
              onChange={(e) => setFiltros({ hasta: e.target.value || null })}
              className="h-9"
            />
          </div>

          {/* Busqueda libre */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="f_search">
              Buscar
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="f_search"
                type="text"
                placeholder="Pedido, descripcion, motivo..."
                value={filtros.search}
                onChange={(e) => setFiltros({ search: e.target.value })}
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFiltros}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1 size-3.5" />
            Limpiar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
