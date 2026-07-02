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

interface CutTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function CutTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: CutTableProps) {
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

  // Status badge for Diseno (input)
  const getEstadoDisenoBadge = (orden: Orden) => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Entregado
        </Badge>
      )
    }
    if (orden.dfecha_de_ingreso_diseno) {
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
          <Clock className="mr-1 size-3" />
          En Proceso
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

  // Status badge for Corte (current stage)
  const getEstadoCorteBadge = (orden: Orden) => {
    if (orden.cfecha_de_corte) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.cfecha_de_recepcion) {
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
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo Corte</TableHead>
          <TableHead className="text-right">Total PC</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estatus de Diseno</TableHead>
          <TableHead>Estado de Corte</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden, idx) => {
          // Gating normal: por APROBACION del Planner (Corte en paralelo con
          // Diseño). En YARDAJE el Corte va DESPUES de Sublimacion, asi que
          // ademas exige que Sublimacion haya terminado (seta_sublimacion).
          const estadoNormalized = (orden.estado_aprobado_rechazado || "")
            .toString()
            .trim()
            .toLowerCase()
          const isApprovedByPlanner = estadoNormalized === "aprobado"
          const isYardaje =
            (orden.tipo_flujo_especial ?? "")
              .toString()
              .trim()
              .toUpperCase() === "YARDAJE"
          const isSublimationFinished = Boolean(orden.seta_sublimacion)
          const isApproved = isYardaje
            ? isApprovedByPlanner && isSublimationFinished
            : isApprovedByPlanner
          return (
            <TableRow
              key={orden.id ?? orden.pedido ?? idx}
              className={
                !isApproved
                  ? "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  : "bg-emerald-50/40 hover:bg-emerald-50/60"
              }
              title={
                !isApproved
                  ? isYardaje && isApprovedByPlanner && !isSublimationFinished
                    ? "Yardaje: el Corte se realiza despues de Sublimacion"
                    : "Esta orden aun no ha sido aprobada por el Planner"
                  : "Orden lista para procesar en Corte"
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
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.cfecha_objetivo_c)}</TableCell>
              <TableCell className="text-right">
                {orden.pcs?.toLocaleString() || "-"}
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
              {/* Estatus de Diseno: INFORMATIONAL only, never blocks Corte */}
              <TableCell>{getEstadoDisenoBadge(orden)}</TableCell>
              <TableCell>
                {!isApproved ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700 bg-amber-50"
                  >
                    <Lock className="mr-1 size-3" />
                    {isYardaje && isApprovedByPlanner && !isSublimationFinished
                      ? "Esperando Sublimacion"
                      : "Esperando aprobacion"}
                  </Badge>
                ) : (
                  getEstadoCorteBadge(orden)
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
