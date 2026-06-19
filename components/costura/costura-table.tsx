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

interface CosturaTableProps {
  ordenes: Orden[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

export function CosturaTable({
  ordenes,
  onSelectOrder,
  isLoading,
}: CosturaTableProps) {
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

  // Generic "previous stage" badge: green if delivered, amber/gray if not
  const getPreviousStageBadge = (deliveredDate: string | undefined) => {
    if (deliveredDate) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Entregado
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="border-amber-300 text-amber-700 bg-amber-50"
      >
        <Clock className="mr-1 size-3" />
        Pendiente
      </Badge>
    )
  }

  // Badge para etapas que se saltan en flujo "Solo Corte / Costura".
  // Visualmente deshabilitado pero legible para que el coordinador sepa
  // al instante que esa etapa no aplica (no es un retraso).
  const getSkippedStageBadge = () => (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-400"
      title="Esta etapa se omite en flujo Solo Corte/Costura"
    >
      <MinusCircle className="mr-1 size-3" />
      N/A
    </Badge>
  )

  // Estado de Costura: Terminado (coseta_costura) / Recibido (cosfecha_conteo) / Pendiente
  const getEstadoCosturaBadge = (orden: Orden) => {
    if (orden.coseta_costura) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.cosfecha_conteo) {
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
        <Loader2 className="size-8 animate-spin text-icon-purple" />
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
          <TableHead>Ciudad</TableHead>
          <TableHead>Fecha Ingreso</TableHead>
          <TableHead>Fecha Objetivo</TableHead>
          <TableHead>Contador</TableHead>
          <TableHead>Maquilador</TableHead>
          <TableHead>Urgencia</TableHead>
          <TableHead>Diseno</TableHead>
          <TableHead>Corte</TableHead>
          <TableHead>Impresion</TableHead>
          <TableHead>Sublimacion</TableHead>
          <TableHead>Estado Costura</TableHead>
          <TableHead className="text-right">Accion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedOrdenes.map((orden) => {
          // Flujo reducido "Solo Corte / Costura": la orden se salta Diseno,
          // Impresion y Sublimacion. La etapa previa para Costura pasa a ser
          // Corte directamente.
          const isSoloCorteCostura = orden.solo_corte_costura === true
          const isYardajeFlujo =
            (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
            "YARDAJE"

          // Visual hint: ready for costura
          //  - flujo normal: cuando Sublimacion entrego (seta_sublimacion).
          //  - flujo "Solo Corte/Costura" o "Yardaje": cuando Corte entrego
          //    (cfecha_de_corte). En Yardaje el corte ocurre despues de sublimacion.
          const isReadyForCostura =
            isSoloCorteCostura || isYardajeFlujo
              ? Boolean(orden.cfecha_de_corte)
              : Boolean(orden.seta_sublimacion)

          const readyTooltip =
            isSoloCorteCostura || isYardajeFlujo
              ? isReadyForCostura
                ? "Corte entregado: lista para costura"
                : "Corte aun no ha sido entregado"
              : isReadyForCostura
              ? "Sublimacion entregada: lista para costura"
              : "Sublimacion aun no ha sido entregada"

          return (
            <TableRow
              key={orden.id}
              className={
                isReadyForCostura
                  ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }
              title={readyTooltip}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2 flex-wrap">
                  {isReadyForCostura && (
                    <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span>{orden.pedido}</span>
                  {(orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() === "YARDAJE" && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] px-1.5 py-0">
                      YARDAJE
                    </Badge>
                  )}
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
                </div>
              </TableCell>
              <TableCell>{orden.cliente}</TableCell>
              <TableCell className="text-right tabular-nums">
                {orden.pcs != null ? orden.pcs.toLocaleString() : "-"}
              </TableCell>
              <TableCell>{orden.ciudad}</TableCell>
              <TableCell>{formatDate(orden.fecha_de_ingreso)}</TableCell>
              <TableCell>{formatDate(orden.cosfecha_objetivo_cs)}</TableCell>
              <TableCell className="text-xs">
                {orden.cosnombre_de_persona_que_conto || "-"}
              </TableCell>
              <TableCell className="text-xs">
                {orden.cosnombre_maquilador || "-"}
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
              <TableCell>
                {isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.dentrega_diseno)}
              </TableCell>
              <TableCell>
                {getPreviousStageBadge(orden.cfecha_de_corte)}
              </TableCell>
              <TableCell>
                {isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.ientrega_impresion)}
              </TableCell>
              <TableCell>
                {isSoloCorteCostura
                  ? getSkippedStageBadge()
                  : getPreviousStageBadge(orden.seta_sublimacion)}
              </TableCell>
              <TableCell>{getEstadoCosturaBadge(orden)}</TableCell>
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
