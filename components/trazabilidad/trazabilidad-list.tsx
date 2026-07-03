"use client"

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
import { getDaysUntil } from "@/lib/date-utils"
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, Clock } from "lucide-react"

interface TrazabilidadListProps {
  ordenes: Orden[]
  onSelect: (orden: Orden) => void
}

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Vista de lista (tabla) para Mis Pedidos.
 * Alternativa compacta a la vista por tarjetas cuando el usuario necesita
 * escanear rapidamente muchos pedidos a la vez.
 */
export function TrazabilidadList({ ordenes, onSelect }: TrazabilidadListProps) {
  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Pedido</TableHead>
              <TableHead className="whitespace-nowrap">Cliente</TableHead>
              <TableHead className="whitespace-nowrap">Vendedora</TableHead>
              <TableHead className="whitespace-nowrap">Ciudad</TableHead>
              <TableHead className="whitespace-nowrap">Ingreso</TableHead>
              <TableHead className="whitespace-nowrap">Entrega</TableHead>
              <TableHead className="whitespace-nowrap w-[180px]">
                Avance
              </TableHead>
              <TableHead className="whitespace-nowrap">Estado</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.map((orden, idx) => {
              const pct = Math.max(
                0,
                Math.min(
                  100,
                  typeof orden.porcentaje_avance === "number"
                    ? orden.porcentaje_avance
                    : 0
                )
              )
              const entregado = orden.entregado_cliente_si_no === true
              const cancelado =
                (orden.estado_aprobado_rechazado ?? "")
                  .toString()
                  .trim()
                  .toLowerCase() === "cancelado"
              const progressColor = entregado
                ? "bg-emerald-500"
                : pct >= 70
                ? "bg-blue-500"
                : pct >= 40
                ? "bg-amber-500"
                : "bg-rose-500"

              // Alerta: faltan 3 dias o menos para la entrega (o ya vencio)
              // y el pedido aun no ha sido entregado ni cancelado.
              const diasRestantes = getDaysUntil(orden.fecha_de_entrega)
              const proximoAVencer =
                !entregado &&
                !cancelado &&
                diasRestantes !== null &&
                diasRestantes <= 3
              const vencido =
                proximoAVencer &&
                diasRestantes !== null &&
                diasRestantes < 0

              const alertaLabel = vencido
                ? `Vencido ${Math.abs(diasRestantes ?? 0)}d`
                : diasRestantes === 0
                ? "Vence hoy"
                : diasRestantes === 1
                ? "Falta 1 dia"
                : `Faltan ${diasRestantes} dias`

              return (
                <TableRow
                  key={orden.id ?? orden.pedido ?? idx}
                  className={`cursor-pointer hover:bg-muted/40 ${
                    proximoAVencer
                      ? vencido
                        ? "bg-rose-50/70 hover:bg-rose-50"
                        : "bg-amber-50/70 hover:bg-amber-50"
                      : ""
                  }`}
                  onClick={() => onSelect(orden)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {proximoAVencer && (
                        <AlertTriangle
                          className={`size-4 shrink-0 ${
                            vencido ? "text-rose-600" : "text-amber-500"
                          }`}
                          aria-label={
                            vencido
                              ? "Pedido vencido"
                              : "Pedido proximo a vencer"
                          }
                        />
                      )}
                      <span className="truncate">{orden.pedido}</span>
                      {orden.es_urgente && (
                        <Badge className="bg-rose-500 text-white hover:bg-rose-600 px-1.5 py-0 text-[10px]">
                          <AlertTriangle className="mr-0.5 size-2.5" />
                          Urgente
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {orden.cliente || "-"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {orden.vendedora || "-"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {orden.ciudad || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(orden.fecha_de_ingreso)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          proximoAVencer
                            ? vencido
                              ? "text-rose-700 font-medium"
                              : "text-amber-700 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {formatDate(orden.fecha_de_entrega)}
                      </span>
                      {proximoAVencer && (
                        <Badge
                          className={`px-1.5 py-0 text-[10px] text-white ${
                            vencido
                              ? "bg-rose-600 hover:bg-rose-700"
                              : "bg-amber-500 hover:bg-amber-600"
                          }`}
                          title={
                            vencido
                              ? "Este pedido esta vencido"
                              : "Faltan 3 dias o menos para la fecha de entrega"
                          }
                        >
                          <Clock className="mr-0.5 size-2.5" />
                          {alertaLabel}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${progressColor} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {cancelado ? (
                      <Badge className="bg-slate-500 text-white hover:bg-slate-600">
                        <Ban className="mr-1 size-3" />
                        Cancelada
                      </Badge>
                    ) : entregado ? (
                      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                        <CheckCircle2 className="mr-1 size-3" />
                        Entregado
                      </Badge>
                    ) : (
                      <span className="text-xs text-foreground">
                        {orden.estado_produccion || "En proceso"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(orden)
                      }}
                    >
                      Ver
                      <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
