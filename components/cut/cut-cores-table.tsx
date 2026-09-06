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

import { useMemo, useState } from "react"
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
import type { MarkerCore } from "@/lib/marker-context"
import { CutCoreFinishModal } from "./cut-core-finish-modal"

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
  const [cerrando, setCerrando] = useState<CoreEnCorte | null>(null)
  const [recibiendo, setRecibiendo] = useState<number | null>(null)

  const pendientes = useMemo(
    () => cores.filter((c) => !c.cortado).length,
    [cores]
  )

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
                    {c.ordenes.map((o) => (
                      <TableRow key={o.pedido}>
                        <TableCell className="font-medium">{o.pedido}</TableCell>
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
                    ))}
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
