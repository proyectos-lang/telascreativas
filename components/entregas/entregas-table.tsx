"use client"

import { useState, useMemo } from "react"
import { Orden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Eye,
  Loader2,
  CheckCircle2,
  PackageCheck,
  Sparkles,
  Truck,
  Scissors,
  Package,
  Warehouse,
} from "lucide-react"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"

interface EntregasTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function EntregasTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: EntregasTableProps) {
  // Paginacion: 100 por pagina con scroll vertical
  const [page, setPage] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const pagedOrdenes = useMemo(
    () => ordenes.slice(page * pageSize, (page + 1) * pageSize),
    [ordenes, page, pageSize]
  )

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  // Estado Final: Entregado a Cliente (verde) / Listo para Entrega (azul-ambar)
  const getEstadoFinalBadge = (orden: Orden) => {
    if (orden.entregado_cliente_si_no === true) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Entregado a Cliente
        </Badge>
      )
    }
    return (
      <Badge className="bg-blue-500 text-white hover:bg-blue-600">
        <Truck className="mr-1 size-3" />
        Listo para Entrega
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-icon-coral" />
      </div>
    )
  }

  if (ordenes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <PackageCheck className="size-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm">
          No hay ordenes empacadas disponibles para entrega.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
        <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Vendedora</TableHead>
          <TableHead>Ciudad</TableHead>
          <TableHead className="text-right">Total PCS</TableHead>
          <TableHead>Fecha Empaque</TableHead>
          <TableHead>Fecha Entrega</TableHead>
          <TableHead>Estado Final</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden) => {
          const pending = orden.entregado_cliente_si_no !== true
          // Flujo reducido: se marca visualmente para que las vendedoras
          // entiendan el origen de la orden aunque el gating en Entregas
          // solo depende de que el Empaque este cerrado.
          const isSoloCorteCostura = orden.solo_corte_costura === true
          // Flujos especiales: en Entregas se muestran TODAS las ordenes
          // aprobadas independientemente del flujo, asi que aqui se
          // resalta visualmente cuando el producto NO viene del proceso
          // normal de confeccion para que la vendedora lo identifique
          // de un vistazo.
          const isCompraExterna =
            orden.tipo_flujo_especial === "COMPRA_EXTERNA"
          const isVentaInventario =
            orden.tipo_flujo_especial === "VENTA_INVENTARIO"
          // YARDAJE sin costura: salta Costura y Empaque, llega directo desde
          // Sublimacion. No tiene fecha de empaque.
          const isYardajeSinCostura =
            (orden.tipo_flujo_especial ?? "")
              .toString()
              .trim()
              .toUpperCase() === "YARDAJE" &&
            String(orden.costura_si_no ?? "true").trim().toLowerCase() ===
              "false"
          return (
            <TableRow
              key={orden.pedido ?? orden.id}
              className={
                pending
                  ? "bg-blue-50/40 hover:bg-blue-50/60"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }
              title={
                pending
                  ? "Orden lista, pendiente de entregar al cliente"
                  : "Orden ya entregada al cliente"
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {pending && (
                    <Sparkles className="size-3.5 text-blue-600 shrink-0" />
                  )}
                  <span>{orden.pedido}</span>
                  {isSoloCorteCostura && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-icon-green/40 text-icon-green bg-emerald-50"
                      title="Flujo reducido: Solo Corte y Costura"
                    >
                      <Scissors className="mr-0.5 size-2.5" />
                      Solo Corte/Costura
                    </Badge>
                  )}
                  {/* Compra Externa: producto que se compro terminado a un
                      proveedor. Naranja fuerte para que la vendedora lo vea
                      antes que cualquier otra etiqueta. */}
                  {isCompraExterna && (
                    <Badge
                      className="text-[10px] bg-orange-500 text-white hover:bg-orange-600 border-transparent"
                      title="Producto comprado a proveedor externo"
                    >
                      <Package className="mr-0.5 size-2.5" />
                      COMPRA EXTERNA
                    </Badge>
                  )}
                  {/* Venta de Inventario: producto que sale de bodega de
                      terminados. Indigo profundo para diferenciarlo de la
                      compra externa pero sin chocar con los estados. */}
                  {isVentaInventario && (
                    <Badge
                      className="text-[10px] bg-indigo-600 text-white hover:bg-indigo-700 border-transparent"
                      title="Producto desde inventario de terminados"
                    >
                      <Warehouse className="mr-0.5 size-2.5" />
                      INVENTARIO
                    </Badge>
                  )}
                  {/* Yardaje sin costura: salta Costura y Empaque, entra a
                      Entregas directo desde Sublimacion. */}
                  {isYardajeSinCostura && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-teal-300 text-teal-700 bg-teal-50"
                      title="Yardaje sin costura: pasa directo de Sublimacion a Entregas"
                    >
                      <Sparkles className="mr-0.5 size-2.5" />
                      Yardaje s/costura
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{orden.cliente || "-"}</TableCell>
              <TableCell>{orden.vendedora || "-"}</TableCell>
              <TableCell>{orden.ciudad || "-"}</TableCell>
              <TableCell className="text-right font-medium">
                {orden.pcs?.toLocaleString() || "-"}
              </TableCell>
              <TableCell>
                {isYardajeSinCostura
                  ? formatDate(orden.seta_sublimacion)
                  : formatDate(orden.efecha_de_empaque)}
              </TableCell>
              <TableCell>
                {orden.fecha_de_entrega ? (
                  <span className="font-medium text-slate-700">
                    {formatDate(orden.fecha_de_entrega)}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic text-xs">
                    Sin fecha
                  </span>
                )}
              </TableCell>
              <TableCell>{getEstadoFinalBadge(orden)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectOrder(orden)}
                >
                  <Eye className="mr-1 size-4 text-icon-magenta" />
                  Detalles
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
      </div>
      <TablePagination
        currentPage={page}
        totalItems={ordenes.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  )
}
