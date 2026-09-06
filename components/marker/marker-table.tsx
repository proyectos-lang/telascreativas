"use client"

/**
 * Listado de órdenes de Marker Digital.
 *
 * Muestra el estado del área y, cuando la orden ya está agrupada, el marker
 * al que pertenece. Las yardas teóricas NO se listan aquí: son un dato de
 * planificación del trazo, no de seguimiento.
 */

import { useMemo, useState } from "react"
import { Orden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ReposicionBadge } from "@/components/shared/reposicion-badge"
import {
  useReposicionesFull,
  reposicionDePedido,
} from "@/lib/reposiciones-pendientes"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/table-pagination"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Loader2,
} from "lucide-react"
import { getDisenoStatus, getMarkerStatus } from "@/lib/production-status"
import type { MarkerCore } from "@/lib/marker-context"

interface Props {
  ordenes: Orden[]
  cores: MarkerCore[]
  onSelectOrder: (orden: Orden) => void
  isLoading: boolean
}

function formatDate(v: string | undefined | null) {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function EstadoMarker({ orden }: { orden: Orden }) {
  const estado = getMarkerStatus(orden)
  if (estado === "Terminado")
    return (
      <Badge className="bg-emerald-500 text-xs text-white hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 size-3" />
        Entregado
      </Badge>
    )
  if (estado === "Recibido")
    return (
      <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-600">
        <Clock className="mr-1 size-3" />
        En proceso
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      <Circle className="mr-1 size-3" />
      Pendiente
    </Badge>
  )
}

function EstadoDiseno({ orden }: { orden: Orden }) {
  const estado = getDisenoStatus(orden)
  if (estado === "Terminado")
    return (
      <Badge className="bg-emerald-500 text-xs text-white hover:bg-emerald-600">
        Entregado
      </Badge>
    )
  if (estado === "Recibido")
    return (
      <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-600">
        En proceso
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Pendiente
    </Badge>
  )
}

export function MarkerTable({ ordenes, cores, onSelectOrder, isLoading }: Props) {
  const { mapa: reposFull } = useReposicionesFull()
  const [page, setPage] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE

  const nombreCore = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of cores) m.set(c.id, c.nombre)
    return m
  }, [cores])

  const paged = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(ordenes.length / pageSize))
    const safePage = Math.min(page, totalPages - 1)
    return ordenes.slice(safePage * pageSize, (safePage + 1) * pageSize)
  }, [ordenes, page, pageSize])

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-icon-cyan" />
      </div>
    )

  return (
    <div className="rounded-md border">
      {/* Scroll vertical y horizontal del listado (mismo criterio que el
          resto de módulos: dvh y min-w para que en tablet no se corte). */}
      <div className="max-h-[70dvh] overflow-auto lg:max-h-[calc(100dvh-22rem)]">
        <Table className="min-w-[60rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Marker</TableHead>
              <TableHead>Fecha Objetivo</TableHead>
              <TableHead className="text-right">Total PC</TableHead>
              <TableHead>Urgencia</TableHead>
              <TableHead>Estado Diseno</TableHead>
              <TableHead>Estado Marker</TableHead>
              <TableHead className="text-right">Accion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((orden) => {
              const repo = reposicionDePedido(orden.pedido, reposFull)
              const core = orden.mdcore_id
                ? nombreCore.get(orden.mdcore_id)
                : null
              // El trazo se hace con el arte ya entregado por Diseño.
              const listaParaTrazo =
                !!orden.dentrega_diseno && !orden.mdentrega_marker
              return (
                <TableRow
                  key={orden.pedido}
                  className={listaParaTrazo ? "bg-emerald-50/40" : undefined}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {orden.pedido}
                      <ReposicionBadge info={repo} compact />
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {orden.cliente || "-"}
                  </TableCell>
                  <TableCell>
                    {core ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-indigo-300 bg-indigo-50 text-[11px] text-indigo-800"
                      >
                        <Boxes className="size-3" />
                        {core}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Suelta</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(orden.mdfecha_objetivo_md)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {orden.pcs ?? "-"}
                  </TableCell>
                  <TableCell>
                    {orden.es_urgente ? (
                      <Badge className="bg-rose-500 text-xs text-white hover:bg-rose-600">
                        <AlertTriangle className="mr-1 size-3" />
                        Urgente
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Normal</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EstadoDiseno orden={orden} />
                  </TableCell>
                  <TableCell>
                    <EstadoMarker orden={orden} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectOrder(orden)}
                    >
                      <Eye className="mr-1 size-4" />
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
