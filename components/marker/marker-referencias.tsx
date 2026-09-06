"use client"

/**
 * Referencias de una orden: las líneas de `detalleorden` que el marker
 * necesita para trazar — qué prenda, en qué tela, género, talla y estilo.
 *
 * Se usa en dos sitios: al armar un marker (para decidir con criterio) y al
 * revisar uno ya armado (para saber qué contiene sin salir de la vista).
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toPcs } from "@/lib/capacidad/fechas"
import { normalizarTela } from "@/lib/marker/cores"
import type { LineaTela } from "@/lib/marker-context"

interface Props {
  lineas: LineaTela[]
  /** Tela del core: las líneas de otra tela se marcan para trazarlas aparte. */
  telaPrincipal?: string
  compacto?: boolean
}

export function MarkerReferencias({ lineas, telaPrincipal, compacto }: Props) {
  if (lineas.length === 0)
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Sin referencias registradas para esta orden.
      </p>
    )

  const principal = telaPrincipal ? normalizarTela(telaPrincipal) : null
  const total = lineas.reduce((s, l) => s + toPcs(l.pcs), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-1.5 pl-3 pr-2 font-medium">Producto</th>
            <th className="px-2 py-1.5 font-medium">Tela</th>
            <th className="px-2 py-1.5 font-medium">Género</th>
            <th className="px-2 py-1.5 font-medium">Talla</th>
            <th className="px-2 py-1.5 font-medium">Estilo</th>
            <th className="py-1.5 pl-2 pr-3 text-right font-medium">Pcs</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => {
            // Piezas de otra tela: no entran en este trazo, van en uno aparte.
            const otraTela =
              principal !== null &&
              normalizarTela(l.tela) !== "" &&
              normalizarTela(l.tela) !== principal
            return (
              <tr
                key={`${l.pedido}-${i}`}
                className={cn(
                  "border-b border-slate-100 last:border-0",
                  otraTela && "bg-amber-50/60"
                )}
              >
                <td className="py-1.5 pl-3 pr-2 text-slate-700">
                  {l.nombre || "—"}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      "font-medium",
                      otraTela ? "text-amber-800" : "text-slate-700"
                    )}
                  >
                    {l.tela || "—"}
                  </span>
                  {otraTela && (
                    <Badge
                      variant="outline"
                      className="ml-1.5 border-amber-300 bg-amber-50 px-1 py-0 text-[9px] text-amber-800"
                      title="Otra tela: requiere un trazo aparte"
                    >
                      aparte
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5 text-slate-600">{l.genero || "—"}</td>
                <td className="px-2 py-1.5 font-medium text-slate-700">
                  {l.talla || "—"}
                </td>
                <td className="px-2 py-1.5 text-slate-600">{l.estilo || "—"}</td>
                <td className="py-1.5 pl-2 pr-3 text-right tabular-nums text-slate-700">
                  {toPcs(l.pcs)}
                </td>
              </tr>
            )
          })}
        </tbody>
        {!compacto && (
          <tfoot>
            <tr className="border-t border-slate-200 font-medium text-slate-700">
              <td colSpan={5} className="py-1.5 pl-3 pr-2 text-right">
                Total
              </td>
              <td className="py-1.5 pl-2 pr-3 text-right tabular-nums">
                {total}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
