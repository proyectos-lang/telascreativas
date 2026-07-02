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
import { Eye, AlertTriangle, Loader2 } from "lucide-react"
import { useOrders } from "@/lib/orders-context"
import { toast } from "sonner"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"

interface OrdersTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function OrdersTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: OrdersTableProps) {
  // Track which pedido is currently being toggled so we can show a spinner.
  const [togglingPedido, setTogglingPedido] = useState<string | null>(null)
  const { updateOrden } = useOrders()

  // Paginacion: 100 ordenes por pagina, scroll vertical en el contenedor.
  const [page, setPage] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const pagedOrdenes = useMemo(
    () => ordenes.slice(page * pageSize, (page + 1) * pageSize),
    [ordenes, page, pageSize]
  )

  const handleToggleUrgency = async (
    e: React.MouseEvent,
    orden: Orden
  ) => {
    // Prevent the row click / any parent handler from firing.
    e.stopPropagation()
    if (togglingPedido) return

    setTogglingPedido(orden.pedido)
    const newValue = !orden.es_urgente
    const result = await updateOrden(orden.pedido, { es_urgente: newValue })

    if (result.success) {
      toast.success(
        newValue
          ? `Orden ${orden.pedido} marcada como Urgente`
          : `Orden ${orden.pedido} restablecida a Normal`
      )
    } else {
      toast.error("No se pudo actualizar la urgencia", {
        description: result.error,
      })
    }
    setTogglingPedido(null)
  }
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  const getEstadoBadge = (estado: Orden["estado_aprobado_rechazado"]) => {
    switch (estado) {
      case "Aprobado":
        return (
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
            Aprobado
          </Badge>
        )
      case "Rechazado":
        return <Badge variant="destructive">Rechazado</Badge>
      default:
        return <Badge variant="secondary">Pendiente</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-icon-cyan" />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Vendedora</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Entrega</TableHead>
          <TableHead className="text-right">Total PCS</TableHead>
          <TableHead>Ciudad</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden) => (
          <TableRow key={orden.id}>
            <TableCell className="font-medium">{orden.pedido}</TableCell>
            <TableCell>{orden.cliente}</TableCell>
            <TableCell>{orden.origen}</TableCell>
            <TableCell>{orden.vendedora}</TableCell>
            <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
            <TableCell>{formatDate(orden.fecha_de_entrega)}</TableCell>
            <TableCell className="text-right">
              {orden.pcs.toLocaleString()}
            </TableCell>
            <TableCell>{orden.ciudad}</TableCell>
            <TableCell>
              <button
                type="button"
                onClick={(e) => handleToggleUrgency(e, orden)}
                disabled={togglingPedido === orden.pedido}
                title={
                  orden.es_urgente
                    ? "Click para marcar como Normal"
                    : "Click para marcar como Urgente"
                }
                className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
              >
                {togglingPedido === orden.pedido ? (
                  <Badge
                    variant="outline"
                    className="gap-1 opacity-60"
                  >
                    <Loader2 className="size-3 animate-spin" />
                    Actualizando...
                  </Badge>
                ) : orden.es_urgente ? (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-400 transition-colors">
                    <AlertTriangle className="mr-1 size-3" />
                    Urgente
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="hover:border-amber-400 hover:text-amber-600 transition-colors"
                  >
                    Normal
                  </Badge>
                )}
              </button>
            </TableCell>
            <TableCell>{getEstadoBadge(orden.estado_aprobado_rechazado)}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectOrder(orden)}
              >
                <Eye className="mr-1 size-4 text-icon-cyan" />
                Detalles
              </Button>
            </TableCell>
          </TableRow>
        ))}
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
