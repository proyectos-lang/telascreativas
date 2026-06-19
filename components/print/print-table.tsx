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
  Sparkles,
} from "lucide-react"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"

interface PrintTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function PrintTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: PrintTableProps) {
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

  // Estatus de Diseno (Green "Terminado" if dentrega_diseno, otherwise "Pendiente")
  const getEstadoDisenoBadge = (orden: Orden) => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
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

  // Estatus de Corte (informative badge if cfecha_de_corte)
  const getEstadoCorteBadge = (orden: Orden) => {
    if (orden.cfecha_de_corte) {
      return (
        <Badge
          variant="outline"
          className="border-sky-300 bg-sky-50 text-sky-700"
        >
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.cfecha_de_recepcion) {
      return (
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-700"
        >
          <Clock className="mr-1 size-3" />
          En Proceso
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Circle className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
  }

  // Estado Impresion (current stage)
  const getEstadoImpresionBadge = (orden: Orden) => {
    if (orden.ientrega_impresion) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.ifecha_de_ingreso_imp) {
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
      <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
        <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Pcs</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo Impresion</TableHead>
          <TableHead>Impresora</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead className="text-right">Inches</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estatus de Diseno</TableHead>
          <TableHead>Estatus de Corte</TableHead>
          <TableHead>Estado Impresion</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden) => {
          // Visual hint: design has been delivered -> highlight (informational only).
          const isDesignDelivered = Boolean(orden.dentrega_diseno)
          return (
            <TableRow
              key={orden.id}
              className={
                isDesignDelivered
                  ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                  : undefined
              }
              title={
                isDesignDelivered
                  ? "Diseno ya entrego esta orden: lista para imprimir"
                  : undefined
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  {isDesignDelivered && (
                    <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
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
              <TableCell className="text-right tabular-nums">
                {orden.pcs != null ? orden.pcs.toLocaleString() : "-"}
              </TableCell>
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.ifecha_objetivo_i)}</TableCell>
              <TableCell>{orden.iimpresora || "-"}</TableCell>
              <TableCell>{orden.iperfil_de_impresion || "-"}</TableCell>
              <TableCell className="text-right">
                {orden.iinches !== null && orden.iinches !== undefined
                  ? orden.iinches.toLocaleString()
                  : "-"}
              </TableCell>
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
              <TableCell>{getEstadoDisenoBadge(orden)}</TableCell>
              <TableCell>{getEstadoCorteBadge(orden)}</TableCell>
              <TableCell>{getEstadoImpresionBadge(orden)}</TableCell>
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
