"use client"

/**
 * Tarjeta resumen por area productiva. Renderiza dos contadores
 * (Recibidas / Entregadas) con su propia paleta y un acordeon que lista
 * los pedidos del dia.
 *
 * Recibe los buckets ya calculados por `lib/resumen-dia-context.tsx`,
 * por lo que no hace ningun acceso a datos por su cuenta.
 */

import type { LucideIcon } from "lucide-react"
import { ArrowRightToLine, CheckCircle2, MinusCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { ResumenBucket } from "@/lib/resumen-dia-context"

interface ResumenDiaCardProps {
  title: string
  icon: LucideIcon
  /** Token de color para el icono del area (ej. "text-icon-green"). */
  iconColor: string
  recibidas: ResumenBucket | null
  entregadas: ResumenBucket | null
}

function StatBlock({
  variant,
  bucket,
}: {
  variant: "recibidas" | "entregadas"
  bucket: ResumenBucket
}) {
  const isRecibidas = variant === "recibidas"
  const Icon = isRecibidas ? ArrowRightToLine : CheckCircle2
  const palette = isRecibidas
    ? {
        bg: "bg-blue-50",
        border: "border-blue-200",
        chip: "bg-blue-100 text-blue-700",
        title: "text-blue-700",
        big: "text-blue-900",
        sub: "text-blue-600",
      }
    : {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        chip: "bg-emerald-100 text-emerald-700",
        title: "text-emerald-700",
        big: "text-emerald-900",
        sub: "text-emerald-600",
      }

  return (
    <div
      className={`rounded-lg border ${palette.bg} ${palette.border} p-3 flex flex-col gap-1.5`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 ${palette.title}`} />
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${palette.title}`}
        >
          {isRecibidas ? "Recibidas" : "Entregadas"}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold leading-none ${palette.big}`}>
          {bucket.ordenes}
        </span>
        <span className={`text-[11px] font-medium ${palette.sub}`}>
          {bucket.ordenes === 1 ? "orden" : "ordenes"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className={palette.chip}>
          {bucket.piezas.toLocaleString("es-CO")} piezas
        </Badge>
      </div>
    </div>
  )
}

function NotApplicableBlock({ variant }: { variant: "recibidas" | "entregadas" }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 flex flex-col items-center justify-center gap-1 text-slate-400">
      <MinusCircle className="size-4" />
      <span className="text-[11px] font-semibold uppercase tracking-wide">
        {variant === "recibidas" ? "Recibidas" : "Entregadas"}
      </span>
      <span className="text-[10px]">No aplica</span>
    </div>
  )
}

function ItemsList({
  bucket,
  variant,
}: {
  bucket: ResumenBucket
  variant: "recibidas" | "entregadas"
}) {
  const isRecibidas = variant === "recibidas"
  const dotColor = isRecibidas ? "bg-blue-500" : "bg-emerald-500"
  const headerColor = isRecibidas ? "text-blue-700" : "text-emerald-700"

  return (
    <div className="space-y-2">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${headerColor}`}>
        {isRecibidas ? "Recibidas" : "Entregadas"} ({bucket.ordenes})
      </p>
      {bucket.items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin pedidos en esta categoria.
        </p>
      ) : (
        <ul className="space-y-1">
          {bucket.items.map((it) => (
            <li
              key={`${variant}-${it.pedido}`}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${dotColor}`}
                  aria-hidden
                />
                <span className="font-medium text-foreground truncate">
                  {it.pedido}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {it.pcs.toLocaleString("es-CO")} pcs
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResumenDiaCard({
  title,
  icon: Icon,
  iconColor,
  recibidas,
  entregadas,
}: ResumenDiaCardProps) {
  // Solo mostramos detalle si hay al menos un item
  const hasAnyDetail =
    (recibidas?.items.length ?? 0) > 0 || (entregadas?.items.length ?? 0) > 0

  return (
    <Card className="flex flex-col bg-card/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className={`flex size-7 items-center justify-center rounded-md bg-muted ${iconColor}`}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          {recibidas ? (
            <StatBlock variant="recibidas" bucket={recibidas} />
          ) : (
            <NotApplicableBlock variant="recibidas" />
          )}
          {entregadas ? (
            <StatBlock variant="entregadas" bucket={entregadas} />
          ) : (
            <NotApplicableBlock variant="entregadas" />
          )}
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="detalle" className="border-b-0">
            <AccordionTrigger
              disabled={!hasAnyDetail}
              className="py-1.5 text-xs hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasAnyDetail ? "Ver detalle" : "Sin movimientos"}
            </AccordionTrigger>
            {hasAnyDetail && (
              <AccordionContent className="pt-2">
                <div className="grid gap-3">
                  {recibidas && <ItemsList bucket={recibidas} variant="recibidas" />}
                  {entregadas && <ItemsList bucket={entregadas} variant="entregadas" />}
                </div>
              </AccordionContent>
            )}
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
