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

interface SublimationTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function SublimationTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: SublimationTableProps) {
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

  // Estado de Diseno: Terminado / En Proceso / Pendiente
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

  // Estado de Corte: Terminado / En Proceso / Pendiente
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

  // Estado de Impresion: Terminado / En Proceso / Pendiente
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

  // Estado de Sublimacion: Terminado (seta_sublimacion) / Recibido (sfecha_de_ingreso_sub) / Pendiente
  const getEstadoSublimacionBadge = (orden: Orden) => {
    if (orden.seta_sublimacion) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.sfecha_de_ingreso_sub) {
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
        <Loader2 className="size-8 animate-spin text-icon-coral" />
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
          <TableHead>Ciudad</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Estado Diseno</TableHead>
          <TableHead>Estado Corte</TableHead>
          <TableHead>Estado Impresion</TableHead>
          <TableHead>Estado Sublimacion</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden, idx) => {
          // Visual hint de "lista para sublimar" segun el flujo:
          //   - YARDAJE / sin costura: Sublimacion va ANTES de Corte
          //     (Diseño -> Impresion -> Sublimacion -> Corte). Solo requiere
          //     que Impresion haya entregado (ientrega_impresion).
          //   - PRODUCCION_NORMAL con costura: requiere Corte e Impresion
          //     terminados.
          const isYardaje =
            (orden.tipo_flujo_especial ?? "")
              .toString()
              .trim()
              .toUpperCase() === "YARDAJE"
          const sinCostura =
            String(orden.costura_si_no ?? "true").trim().toLowerCase() ===
            "false"
          const isReadyForSublimation =
            isYardaje || sinCostura
              ? Boolean(orden.ientrega_impresion)
              : Boolean(orden.cfecha_de_corte) &&
                Boolean(orden.ientrega_impresion)

          return (
            <TableRow
              key={orden.id ?? `row-${idx}`}
              className={
                isReadyForSublimation
                  ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }
              title={
                isReadyForSublimation
                  ? isYardaje || sinCostura
                    ? "Impresion terminada: lista para sublimar"
                    : "Corte e Impresion terminados: lista para sublimar"
                  : isYardaje || sinCostura
                    ? "Impresion aun no ha entregado"
                    : "Corte e Impresion aun no estan terminados"
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  {isReadyForSublimation && (
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
              <TableCell>{orden.ciudad}</TableCell>
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.sfecha_objetivo_s)}</TableCell>
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
              <TableCell>{getEstadoDisenoBadge(orden)}</TableCell>
              <TableCell>{getEstadoCorteBadge(orden)}</TableCell>
              <TableCell>{getEstadoImpresionBadge(orden)}</TableCell>
              <TableCell>{getEstadoSublimacionBadge(orden)}</TableCell>
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
