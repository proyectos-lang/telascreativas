"use client"

import { Orden } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TrazabilidadTimeline } from "./trazabilidad-timeline"
import { TrazabilidadNovedades } from "./trazabilidad-novedades"
import { TrazabilidadProducts } from "./trazabilidad-products"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  MapPin,
  MessageSquareText,
  Package,
  Route,
  User,
} from "lucide-react"

interface TrazabilidadDetailProps {
  orden: Orden
  onBack: () => void
}

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function TrazabilidadDetail({ orden, onBack }: TrazabilidadDetailProps) {
  const pct = Math.max(
    0,
    Math.min(
      100,
      typeof orden.porcentaje_avance === "number" ? orden.porcentaje_avance : 0
    )
  )
  const entregado = orden.entregado_cliente_si_no === true

  const progressColor = entregado
    ? "bg-emerald-500"
    : pct >= 70
    ? "bg-blue-500"
    : pct >= 40
    ? "bg-amber-500"
    : "bg-rose-500"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1 size-4" />
            Volver a Mis Pedidos
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-foreground">
              {orden.pedido}
            </h2>
            {orden.es_urgente && (
              <Badge className="bg-rose-500 text-white hover:bg-rose-600">
                <AlertTriangle className="mr-1 size-3" />
                Urgente
              </Badge>
            )}
            {entregado && (
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                <CheckCircle2 className="mr-1 size-3" />
                Entregado a Cliente
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {orden.cliente || "Sin cliente"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-foreground leading-none">
            {pct}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
            Avance
          </p>
        </div>
      </div>

      {/* Key meta */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ingreso
                </p>
                <p className="font-medium">{formatDate(orden.fecha_de_ingreso)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarCheck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Entrega Objetivo
                </p>
                <p className="font-medium">{formatDate(orden.fecha_de_entrega)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Vendedora
                </p>
                <p className="font-medium">{orden.vendedora || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ciudad
                </p>
                <p className="font-medium">{orden.ciudad || "-"}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-foreground">
                {orden.estado_produccion || "En proceso"}
              </p>
              <p className="text-xs text-muted-foreground">{pct}%</p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="size-4 text-icon-magenta" />
            Linea de Tiempo de Produccion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrazabilidadTimeline orden={orden} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Novedades */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareText className="size-4 text-icon-cyan" />
              Novedades por Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrazabilidadNovedades orden={orden} />
          </CardContent>
        </Card>

        {/* Products */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4 text-icon-teal" />
              Detalle de Productos y Empaque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrazabilidadProducts
              pedido={orden.pedido}
              totalPcsOrden={orden.pcs}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
