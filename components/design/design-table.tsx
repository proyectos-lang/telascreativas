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
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Circle,
  Lock,
} from "lucide-react"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"

interface DesignTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function DesignTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: DesignTableProps) {
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

  const getEstadoDisenoBadge = (orden: Orden) => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.dfecha_de_ingreso_diseno) {
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
          <Clock className="mr-1 size-3" />
          Recibido
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <Circle className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
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
          <TableHead>Disenador</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo</TableHead>
          <TableHead className="text-right">Total PC</TableHead>
          <TableHead>Tipo de Diseno</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estado en Diseno</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden, idx) => {
          const isApproved = orden.estado_aprobado_rechazado === "Aprobado"
          return (
            <TableRow
              key={orden.id ?? orden.pedido ?? idx}
              className={
                !isApproved
                  ? "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  : undefined
              }
              title={
                !isApproved
                  ? "Esta orden aun no ha sido aprobada por el Planner"
                  : undefined
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  {!isApproved && (
                    <Lock className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span>{orden.pedido}</span>
                  {(orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() === "YARDAJE" && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] px-1.5 py-0">
                      YARDAJE
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{orden.cliente}</TableCell>
              <TableCell>
                {orden.ddisenador ? (
                  orden.ddisenador
                ) : (
                  <span className="text-muted-foreground italic">
                    Sin asignar
                  </span>
                )}
              </TableCell>
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.dfecha_objetivo_d)}</TableCell>
              <TableCell className="text-right">
                {orden.pcs?.toLocaleString() || "-"}
              </TableCell>
              <TableCell>{orden.tipo_prediseno || "-"}</TableCell>
              <TableCell>
                {orden.es_urgente ? (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                    <AlertTriangle className="mr-1 size-3" />
                    Urgente
                  </Badge>
                ) : (
                  <Badge variant="outline">Normal</Badge>
                )}
              </TableCell>
              <TableCell>
                {!isApproved ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700 bg-amber-50"
                  >
                    <Lock className="mr-1 size-3" />
                    No aprobada
                  </Badge>
                ) : (
                  getEstadoDisenoBadge(orden)
                )}
              </TableCell>
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
