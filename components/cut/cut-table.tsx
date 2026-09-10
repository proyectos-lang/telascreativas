"use client"

import { useState, useMemo } from "react"
import { Orden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { ReposicionBadge } from "@/components/shared/reposicion-badge"
import { useReposicionesFull, reposicionDePedido } from "@/lib/reposiciones-pendientes"
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
  const { mapa: reposFull } = useReposicionesFull()
  // Paginacion: 100 por pagina con scroll vertical
  const [page, setPage] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const pagedOrdenes = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(ordenes.length / pageSize))
    const safePage = Math.min(page, totalPages - 1)
    return ordenes.slice(safePage * pageSize, (safePage + 1) * pageSize)
  }, [ordenes, page, pageSize])

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

  /**
   * Estatus de Marker Digital.
   *
   * Solo el 11% de la cola de Corte y el 32% de la de Impresion pasa por
   * Marker. Mostrar "Pendiente" en las demas seria mentir: no van a pasar
   * por ahi nunca. Por eso se distingue explicitamente "No aplica".
   */
  const getEstadoMarkerBadge = (orden: Orden) => {
    if (orden.es_marker_digital_si_no !== true) {
      return <span className="text-xs text-muted-foreground">No aplica</span>
    }
    if (orden.mdentrega_marker) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-300 bg-emerald-50 text-emerald-700"
        >
          <CheckCircle2 className="mr-1 size-3" />
          Entregado
        </Badge>
      )
    }
    if (orden.mdfecha_de_recepcion) {
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
      <Badge variant="secondary" className="text-muted-foreground">
        <Circle className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
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
      {/* Scroll vertical y horizontal del listado.
          - `dvh` en vez de `vh`: en tablet/movil `100vh` incluye la barra
            del navegador, asi que el fondo de la tabla quedaba tapado.
          - El tope de 70dvh aplica hasta `lg`: el calculo de -22rem asume
            la altura del encabezado y los filtros en escritorio, y en
            pantallas menores esos bloques se apilan y crecen.
          - `min-w` en la tabla: sin el, 10-12 columnas se comprimen en vez
            de habilitar el desplazamiento horizontal. */}
      <div className="max-h-[70dvh] overflow-auto lg:max-h-[calc(100dvh-22rem)]">
        <Table className="min-w-[60rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo Corte</TableHead>
          <TableHead className="text-right">Total PC</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estatus de Diseno</TableHead>
          <TableHead>Estatus de Marker</TableHead>
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
              <TableCell>{getEstadoMarkerBadge(orden)}</TableCell>
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
                <ReposicionBadge
                  info={reposicionDePedido(orden.pedido, reposFull)}
                  compact
                  className="ml-1"
                />
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
