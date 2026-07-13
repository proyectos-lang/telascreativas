"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  CalendarX2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { useDashboard } from "@/lib/dashboard-context"
import { useAppNavigation } from "@/lib/app-navigation"
import type { VistaControlProduccion } from "@/lib/types"

function formatDate(d?: string | null): string {
  if (!d) return "-"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
}

function RiskRow({ row }: { row: VistaControlProduccion }) {
  const { navigateTo } = useAppNavigation()
  const days = row.dias_para_entrega ?? 0
  const isOverdue =
    row.nivel_riesgo === "Vencido" || (typeof days === "number" && days < 0)
  const absDays = Math.abs(days)

  const handleVer = () => {
    // Navegar a "Mis Pedidos" y pedir que se abra el detalle del pedido.
    // Trazabilidad consume `pendingPedidoFocus` al montarse / cuando cambian
    // las ordenes cargadas.
    navigateTo("trazabilidad", { focusPedido: row.pedido })
  }

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        isOverdue
          ? "border-rose-200 bg-rose-50/60 hover:bg-rose-50"
          : "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
      ].join(" ")}
    >
      {/* Big days badge */}
      <div
        className={[
          "flex flex-col items-center justify-center shrink-0 rounded-lg px-3 py-2 min-w-[72px]",
          isOverdue
            ? "bg-rose-600 text-white"
            : "bg-amber-500 text-white",
        ].join(" ")}
      >
        <span className="text-2xl font-bold leading-none">
          {isOverdue ? `-${absDays}` : absDays}
        </span>
        <span className="text-[10px] uppercase tracking-wide font-semibold opacity-90">
          {isOverdue ? "Vencido" : "dias"}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">
            {row.pedido}
          </p>
          {row.es_urgente && (
            <Badge
              variant="outline"
              className="border-rose-300 bg-rose-100 text-rose-700 text-[10px] h-5 px-1.5"
            >
              URGENTE
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{row.cliente}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <CalendarX2
            className={[
              "size-3",
              isOverdue ? "text-rose-600" : "text-amber-600",
            ].join(" ")}
          />
          <span className="text-[11px] text-muted-foreground">
            Entrega: {formatDate(row.fecha_de_entrega)}
          </span>
        </div>
      </div>

      {/* Action */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleVer}
        className="shrink-0 h-8 text-xs bg-white"
        aria-label={`Ver trazabilidad del pedido ${row.pedido}`}
      >
        Ver
        <ArrowRight className="ml-1 size-3" />
      </Button>
    </div>
  )
}

export function DashboardRiskRadar() {
  const { riskRows, isLoading } = useDashboard()

  return (
    <Card className="h-full bg-white/80 backdrop-blur shadow-sm flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-rose-100 flex items-center justify-center">
            <ShieldAlert className="size-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              Radar de Riesgo
              <Badge
                variant="secondary"
                className="bg-rose-100 text-rose-800 hover:bg-rose-100 h-5 text-[10px] px-1.5"
              >
                {riskRows.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Vencidos y en Riesgo Crítico
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : riskRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[260px] text-center">
            <div className="size-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <ShieldCheck className="size-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Todo bajo control
            </p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              No hay pedidos vencidos ni en riesgo critico en este momento.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {riskRows.map((row) => (
              <RiskRow key={row.pedido} row={row} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

