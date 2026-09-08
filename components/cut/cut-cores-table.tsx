"use client"

/**
 * Cores (markers) programados para Corte.
 *
 * Un core es una fila desplegable: al abrirla se ven las órdenes que
 * contiene. Recibir y Terminar operan sobre el CORE COMPLETO y escriben las
 * mismas fechas en todas sus órdenes, porque físicamente se cortan juntas.
 *
 * Las yardas se capturan una sola vez para el core y el sistema las
 * prorratea a `cyardas` por orden, que es el campo que ya consumen los
 * indicadores.
 *
 * El cortador NO ve las yardas teóricas del marker: son el dato contra el
 * que se le compara, mostrarlas sesgaría el registro.
 */

import { Fragment, useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Orden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Inbox,
  Scissors,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { LineaTela, MarkerCore } from "@/lib/marker-context"
import { MarkerReferencias } from "@/components/marker/marker-referencias"
import { CutCoreFinishModal } from "./cut-core-finish-modal"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface CoreEnCorte {
  core: MarkerCore
  ordenes: Orden[]
  totalPcs: number
  recibido: boolean
  cortado: boolean
}

interface Props {
  cores: CoreEnCorte[]
  onRecibir: (core: CoreEnCorte) => Promise<void>
  onSelectOrder: (orden: Orden) => void
}

/**
 * Fecha objetivo común de las órdenes de un marker.
 *
 * Todas las órdenes de un core comparten fecha —se programan y entregan
 * juntas— pero si por edición quedara alguna distinta se devuelve la más
 * temprana, que es la que manda: es la primera que se vence.
 */
function objetivoComun(
  ordenes: Orden[],
  campo: "mdfecha_objetivo_md" | "cfecha_objetivo_c"
): { fecha: string | null; dispares: boolean } {
  const fechas = ordenes
    .map((o) => o[campo])
    .filter((v): v is string => !!v)
    .map((v) => String(v).slice(0, 10))
    .sort()
  if (fechas.length === 0) return { fecha: null, dispares: false }
  return { fecha: fechas[0], dispares: fechas[0] !== fechas[fechas.length - 1] }
}

/** Días desde hoy hasta la fecha; negativo = vencida. */
function diasHasta(ymd: string | null): number | null {
  if (!ymd) return null
  const hoy = new Date()
  const h = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const [y, m, d] = ymd.split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - h) / 86400000)
}

function fmt(v: string | null | undefined) {
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

export function CutCoresTable({ cores, onRecibir, onSelectOrder }: Props) {
  const [abierto, setAbierto] = useState<Record<number, boolean>>({})
  /** Referencias (lineas de detalleorden) de las ordenes desplegadas. */
  const [refs, setRefs] = useState<Map<string, LineaTela[]>>(new Map())
  const [refsAbiertas, setRefsAbiertas] = useState<Set<string>>(new Set())
  const [cerrando, setCerrando] = useState<CoreEnCorte | null>(null)
  const [recibiendo, setRecibiendo] = useState<number | null>(null)

  const pendientes = useMemo(
    () => cores.filter((c) => !c.cortado).length,
    [cores]
  )

  // Las referencias se cargan una sola vez para todas las ordenes de los
  // cores visibles: el cortador necesita ver que prendas contiene cada
  // marker sin salir de la pantalla.
  const pedidos = useMemo(
    () => cores.flatMap((c) => c.ordenes.map((o) => o.pedido)),
    [cores]
  )
  useEffect(() => {
    if (pedidos.length === 0) return
    let cancelado = false
    void (async () => {
      const { data } = await supabase
        .schema("telas")
        .from("detalleorden")
        .select("pedido, tela, pcs, nombre, genero, talla, estilo")
        .in("pedido", pedidos)
      if (cancelado) return
      const m = new Map<string, LineaTela[]>()
      for (const l of (data as LineaTela[]) ?? []) {
        const arr = m.get(l.pedido) ?? []
        arr.push(l)
        m.set(l.pedido, arr)
      }
      setRefs(m)
    })()
    return () => {
      cancelado = true
    }
  }, [pedidos.join(",")])

  const alternarRefs = (pedido: string) =>
    setRefsAbiertas((prev) => {
      const n = new Set(prev)
      if (n.has(pedido)) n.delete(pedido)
      else n.add(pedido)
      return n
    })

  if (cores.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="size-4 text-icon-cyan" />
        <h3 className="text-sm font-semibold text-slate-800">
          Markers programados
        </h3>
        <Badge variant="outline" className="text-[11px]">
          {pendientes} por cortar
        </Badge>
        <span className="text-xs text-muted-foreground">
          Se reciben y se cierran completos.
        </span>
      </div>

      {cores.map((c) => {
        const exp = abierto[c.core.id] ?? false
        return (
          <Card key={c.core.id} className="overflow-hidden">
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                c.cortado
                  ? "bg-slate-50"
                  : c.recibido
                    ? "bg-amber-50/60"
                    : "bg-emerald-50/50"
              )}
            >
              <button
                type="button"
                onClick={() => setAbierto((p) => ({ ...p, [c.core.id]: !exp }))}
                className="flex items-center gap-2 text-left"
              >
                {exp ? (
                  <ChevronDown className="size-4 text-slate-400" />
                ) : (
                  <ChevronRight className="size-4 text-slate-400" />
                )}
                <Boxes className="size-4 text-icon-cyan" />
                <span className="font-semibold text-slate-800">
                  {c.core.nombre}
                </span>
              </button>

              <Badge variant="outline" className="text-[11px]">
                {c.core.tela_principal}
              </Badge>
              <Badge variant="outline" className="text-[11px] tabular-nums">
                {c.ordenes.length} órdenes · {c.totalPcs} pcs
              </Badge>
              <span className="text-xs text-slate-500">
                Trazo entregado: {fmt(c.core.fecha_entrega_marker)}
              </span>
              {(() => {
                const mk = objetivoComun(c.ordenes, "mdfecha_objetivo_md")
                const co = objetivoComun(c.ordenes, "cfecha_objetivo_c")
                const dias = diasHasta(co.fecha)
                // Solo se muestra el objetivo del marker si existe: las
                // órdenes anteriores al área no lo tienen y una etiqueta
                // vacía solo estorbaría.
                return (
                  <>
                    {mk.fecha && (
                      <span
                        className="text-xs text-slate-500"
                        title={
                          mk.dispares
                            ? "Las órdenes del marker tienen fechas distintas; se muestra la más próxima"
                            : "Fecha objetivo del marker"
                        }
                      >
                        Objetivo marker: {fmt(mk.fecha)}
                        {mk.dispares && " *"}
                      </span>
                    )}
                    {co.fecha && !c.cortado && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          dias != null && dias < 0
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : dias != null && dias <= 1
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-slate-200 text-slate-600"
                        )}
                        title={
                          co.dispares
                            ? "Las órdenes tienen fechas distintas; se muestra la más próxima"
                            : "Fecha objetivo de Corte"
                        }
                      >
                        Objetivo corte: {fmt(co.fecha)}
                        {dias != null &&
                          (dias < 0
                            ? ` · vencido ${Math.abs(dias)}d`
                            : dias === 0
                              ? " · hoy"
                              : ` · ${dias}d`)}
                      </Badge>
                    )}
                  </>
                )
              })()}

              {c.cortado ? (
                <Badge className="bg-emerald-500 text-xs text-white hover:bg-emerald-600">
                  <CheckCircle2 className="mr-1 size-3" />
                  Cortado
                </Badge>
              ) : c.recibido ? (
                <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-600">
                  En proceso
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Por recibir
                </Badge>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={c.recibido || c.cortado || recibiendo === c.core.id}
                  onClick={async () => {
                    setRecibiendo(c.core.id)
                    await onRecibir(c)
                    setRecibiendo(null)
                  }}
                >
                  <Inbox className="mr-1.5 size-3.5" />
                  Recibir marker
                </Button>
                <Button
                  size="sm"
                  disabled={!c.recibido || c.cortado}
                  onClick={() => setCerrando(c)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Scissors className="mr-1.5 size-3.5" />
                  Terminar corte
                </Button>
              </div>
            </div>

            {exp && (
              <div className="overflow-x-auto border-t border-slate-100">
                <Table className="min-w-[44rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Pcs</TableHead>
                      <TableHead>Urgencia</TableHead>
                      <TableHead>Entrega cliente</TableHead>
                      <TableHead className="text-right">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.ordenes.map((o) => {
                      const abiertaRef = refsAbiertas.has(o.pedido)
                      return (
                      <Fragment key={o.pedido}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={() => alternarRefs(o.pedido)}
                            className="mr-1.5 align-middle text-slate-400 hover:text-slate-700"
                            title="Ver referencias de la orden"
                          >
                            {abiertaRef ? (
                              <ChevronDown className="inline size-3.5" />
                            ) : (
                              <ChevronRight className="inline size-3.5" />
                            )}
                          </button>
                          {o.pedido}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate">
                          {o.cliente || "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.pcs ?? "-"}
                        </TableCell>
                        <TableCell>
                          {o.es_urgente ? (
                            <Badge className="bg-rose-500 text-xs text-white hover:bg-rose-600">
                              <AlertTriangle className="mr-1 size-3" />
                              Urgente
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Normal
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {fmt(o.fecha_de_entrega)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectOrder(o)}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                      {abiertaRef && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-slate-50/70 p-0">
                            <MarkerReferencias
                              lineas={refs.get(o.pedido) ?? []}
                              telaPrincipal={c.core.tela_principal}
                              compacto
                            />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )
      })}

      {cerrando && (
        <CutCoreFinishModal
          core={cerrando}
          open
          onClose={() => setCerrando(null)}
        />
      )}
    </div>
  )
}
