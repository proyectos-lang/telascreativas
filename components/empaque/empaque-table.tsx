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
  MinusCircle,
  Scissors,
} from "lucide-react"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"

interface EmpaqueTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function EmpaqueTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: EmpaqueTableProps) {
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

  // Mini badge for previous stages: green if delivered, gray if not
  const getPreviousStageBadge = (deliveredDate: string | undefined) => {
    if (deliveredDate) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] px-1.5 py-0">
          <CheckCircle2 className="mr-0.5 size-2.5" />
          OK
        </Badge>
      )
    }
    return (
      <Badge
        variant="secondary"
        className="text-muted-foreground text-[10px] px-1.5 py-0"
      >
        <Circle className="mr-0.5 size-2.5" />
        Pend.
      </Badge>
    )
  }

  // Badge para etapas que se saltan en flujo "Solo Corte / Costura".
  // Deshabilitado visualmente para que el coordinador entienda de un vistazo
  // que no aplica (no es un retraso).
  const getSkippedStageBadge = () => (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-400 text-[10px] px-1.5 py-0"
      title="Esta etapa se omite en flujo Solo Corte/Costura"
    >
      <MinusCircle className="mr-0.5 size-2.5" />
      N/A
    </Badge>
  )

  // Estado Empaque: Terminado (efecha_de_empaque) / En Proceso (enombre_de_quien_empaca) / Pendiente
  const getEstadoEmpaqueBadge = (orden: Orden) => {
    if (orden.efecha_de_empaque) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.enombre_de_quien_empaca) {
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

  const isVentaInventario = (orden: Orden) =>
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "VENTA_INVENTARIO"

  const isYardaje = (orden: Orden) =>
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "YARDAJE"

  // VENTA_INVENTARIO llega directo a Empaque sin pasar por producción; se
  // considera lista en cuanto está aprobada. Flujo normal: requiere coseta_costura.
  const isReadyForEmpaque = (orden: Orden) => {
    if (isVentaInventario(orden)) {
      return (
        (orden.estado_aprobado_rechazado ?? "")
          .toString()
          .trim()
          .toLowerCase() === "aprobado"
      )
    }
    return Boolean(orden.coseta_costura)
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
          <TableHead className="text-right">Pcs</TableHead>
          <TableHead>Ciudad</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo</TableHead>
          <TableHead>Fecha Entrega</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead className="text-center">Dis.</TableHead>
          <TableHead className="text-center">Corte</TableHead>
          <TableHead className="text-center">Impr.</TableHead>
          <TableHead className="text-center">Sub.</TableHead>
          <TableHead className="text-center">Cost.</TableHead>
          <TableHead>Estado Empaque</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden) => {
          const ready = isReadyForEmpaque(orden)
          const isSoloCorteCostura = orden.solo_corte_costura === true
          // VENTA_INVENTARIO salta TODAS las etapas de producción y llega
          // directo a Empaque.
          const isVI = isVentaInventario(orden)
          const isYardajeFlujo = isYardaje(orden)
          return (
            <TableRow
              key={orden.id}
              className={
                ready
                  ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }
              title={
                ready
                  ? isVI
                    ? "Venta de inventario: lista directo para empaque"
                    : "Costura terminada: lista para empaque"
                  : isVI
                    ? "Venta de inventario: pendiente de aprobacion"
                    : "Aun no se ha terminado Costura"
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {ready && (
                    <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span>{orden.pedido}</span>
                  {isYardajeFlujo && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] px-1.5 py-0">
                      YARDAJE
                    </Badge>
                  )}
                  {isVI && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-blue-300 text-blue-700 bg-blue-50"
                      title="Venta de Inventario: llega directo a Empaque"
                    >
                      Venta Inventario
                    </Badge>
                  )}
                  {!isVI && !isYardajeFlujo && isSoloCorteCostura && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-icon-green/40 text-icon-green bg-emerald-50"
                      title="Flujo reducido: Solo Corte y Costura"
                    >
                      <Scissors className="mr-0.5 size-2.5" />
                      Solo Corte/Costura
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{orden.cliente}</TableCell>
              <TableCell className="text-right tabular-nums">
                {orden.pcs != null ? orden.pcs.toLocaleString() : "-"}
              </TableCell>
              <TableCell>{orden.ciudad}</TableCell>
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.efecha_objetivo_e)}</TableCell>
              <TableCell>{formatDate(orden.fecha_de_entrega)}</TableCell>
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
              {/* Dis. */}
              <TableCell className="text-center">
                {isVI || isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.dentrega_diseno)}
              </TableCell>
              {/* Corte */}
              <TableCell className="text-center">
                {isVI
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.cfecha_de_corte)}
              </TableCell>
              {/* Impr. */}
              <TableCell className="text-center">
                {isVI || isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.ientrega_impresion)}
              </TableCell>
              {/* Sub. */}
              <TableCell className="text-center">
                {isVI || isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.seta_sublimacion)}
              </TableCell>
              {/* Cost. */}
              <TableCell className="text-center">
                {isVI
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.coseta_costura)}
              </TableCell>
              <TableCell>{getEstadoEmpaqueBadge(orden)}</TableCell>
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
