"use client"

/**
 * Telas de una orden, cada una con sus piezas.
 *
 * Para agrupar solo cuenta la tela mayoritaria, pero quien traza necesita
 * ver el detalle completo: el marker saca una impresión aparte por cada
 * tela y le hace falta saber cuántas piezas van en cada una. En la cola
 * real hay órdenes de hasta 8 telas distintas, de ahí el tope de badges
 * visibles con un "+N" para el resto.
 *
 * La principal se marca en color para que se siga leyendo de un vistazo
 * por qué la orden cayó en el core en el que cayó.
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TelaConPiezas } from "@/lib/marker/cores"

interface Props {
  desglose: TelaConPiezas[]
  /** Tela que decidió la agrupación; se resalta. */
  principal?: string
  /** Cuántas telas se muestran antes de colapsar en "+N". */
  max?: number
  className?: string
}

export function MarkerTelasOrden({
  desglose,
  principal,
  max = 4,
  className,
}: Props) {
  if (desglose.length === 0)
    return (
      <Badge variant="outline" className="text-[10px] text-slate-400">
        sin tela
      </Badge>
    )

  const visibles = desglose.slice(0, max)
  const ocultas = desglose.slice(max)
  const pcsOcultas = ocultas.reduce((s, t) => s + t.pcs, 0)

  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibles.map((t) => (
        <Badge
          key={t.tela}
          variant="outline"
          className={cn(
            "text-[10px] font-normal",
            // Solo se resalta cuando hay más de una: en una orden de tela
            // única el color no distinguiría nada.
            desglose.length > 1 && t.tela === principal
              ? "border-cyan-300 bg-cyan-50 text-cyan-800"
              : "text-slate-600"
          )}
          title={
            desglose.length > 1 && t.tela === principal
              ? "Tela principal: es la que define el core"
              : undefined
          }
        >
          {t.tela}
          <span className="ml-1 tabular-nums text-slate-400">{t.pcs}</span>
        </Badge>
      ))}
      {ocultas.length > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] font-normal text-slate-500"
          title={ocultas.map((t) => `${t.tela}: ${t.pcs} pcs`).join("\n")}
        >
          +{ocultas.length} telas · {pcsOcultas} pcs
        </Badge>
      )}
    </span>
  )
}
