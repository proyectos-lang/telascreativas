"use client"

import { Orden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getDaysUntil } from "@/lib/date-utils"
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react"

interface TrazabilidadCardProps {
  orden: Orden
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

export function TrazabilidadCard({ orden, onSelect }: TrazabilidadCardProps) {
  const pct = Math.max(
    0,
    Math.min(100, typeof orden.porcentaje_avance === "number" ? orden.porcentaje_avance : 0)
  )
  const entregado = orden.entregado_cliente_si_no === true
  const cancelado =
    (orden.estado_aprobado_rechazado ?? "").toString().trim().toLowerCase() ===
    "cancelado"

  // Alerta de proximidad a vencimiento: 3 dias o menos (incluye vencidos).
  // Solo aplica si el pedido aun no ha sido entregado ni cancelado.
  const diasRestantes = getDaysUntil(orden.fecha_de_entrega)
  const proximoAVencer =
    !entregado && !cancelado && diasRestantes !== null && diasRestantes <= 3
  const vencido = proximoAVencer && diasRestantes !== null && diasRestantes < 0

  const alertaLabel = vencido
    ? `Vencido ${Math.abs(diasRestantes ?? 0)}d`
    : diasRestantes === 0
    ? "Vence hoy"
    : diasRestantes === 1
    ? "Falta 1 dia"
    : `Faltan ${diasRestantes} dias`

  // Progress color by state
  const progressColor = entregado
    ? "bg-emerald-500"
    : pct >= 70
    ? "bg-blue-500"
    : pct >= 40
    ? "bg-amber-500"
    : "bg-rose-500"

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-md bg-white ${
        proximoAVencer
          ? vencido
            ? "ring-2 ring-rose-400 ring-offset-1 shadow-rose-100"
            : "ring-2 ring-amber-400 ring-offset-1 shadow-amber-100"
          : ""
      }`}
    >
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base text-foreground truncate">
                {orden.pedido}
              </h3>
              {orden.es_urgente && (
                <Badge className="bg-rose-500 text-white hover:bg-rose-600">
                  <AlertTriangle className="mr-1 size-3" />
                  Urgente
                </Badge>
              )}
              {proximoAVencer && (
                <Badge
                  className={`text-white ${
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
                  <Clock className="mr-1 size-3" />
                  {alertaLabel}
                </Badge>
              )}
              {entregado && (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="mr-1 size-3" />
                  Entregado
                </Badge>
              )}
              {cancelado && (
                <Badge className="bg-slate-500 text-white hover:bg-slate-600">
                  <Ban className="mr-1 size-3" />
                  Cancelada
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {orden.cliente || "Sin cliente"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-foreground leading-none">
              {pct}%
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
              Avance
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-foreground font-medium">
            {orden.estado_produccion || "En proceso"}
          </p>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
          <div className="flex items-start gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Ingreso
              </p>
              <p className="font-medium truncate">
                {formatDate(orden.fecha_de_ingreso)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <CalendarCheck className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Entrega Objetivo
              </p>
              <p className="font-medium truncate">
                {formatDate(orden.fecha_de_entrega)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <User className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Vendedora
              </p>
              <p className="font-medium truncate">{orden.vendedora || "-"}</p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <User className="size-3.5 text-muted-foreground mt-0.5 shrink-0 opacity-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Ciudad
              </p>
              <p className="font-medium truncate">{orden.ciudad || "-"}</p>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={() => onSelect(orden)}
          >
            Ver trazabilidad completa
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
