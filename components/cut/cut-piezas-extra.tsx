"use client"

/**
 * Captura de piezas extra en Corte.
 *
 * A diferencia de Marker —que solo declara una cantidad, porque al trazar
 * aún no sabe qué talla va a sobrar—, aquí las piezas ya están cortadas y
 * se identifican una por una: de qué pedido son, qué talla y qué
 * referencia. Ese detalle es lo que hace utilizable el inventario.
 *
 * Las tallas y referencias se ofrecen desde el detalle real del pedido,
 * para no depender de que se escriban a mano.
 */

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Layers, Plus, X } from "lucide-react"
import type { AltaCorte } from "@/lib/marker/piezas-extra"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface FilaExtra {
  pedido: string
  talla: string
  referencia: string
  cantidad: string
}

interface LineaRef {
  pedido: string
  talla: string | null
  nombre: string | null
  tela: string | null
}

interface Props {
  /** Pedidos sobre los que se puede registrar (uno suelto o los del core). */
  pedidos: string[]
  filas: FilaExtra[]
  onChange: (filas: FilaExtra[]) => void
}

export function CutPiezasExtra({ pedidos, filas, onChange }: Props) {
  const [refs, setRefs] = useState<LineaRef[]>([])

  useEffect(() => {
    if (pedidos.length === 0) return
    let cancelado = false
    void (async () => {
      const { data } = await supabase
        .schema("telas")
        .from("detalleorden")
        .select("pedido, talla, nombre, tela")
        .in("pedido", pedidos)
      if (!cancelado) setRefs((data as LineaRef[]) ?? [])
    })()
    return () => {
      cancelado = true
    }
  }, [pedidos.join(",")])

  /** Tallas y referencias que realmente tiene cada pedido. */
  const opciones = useMemo(() => {
    const m = new Map<string, { tallas: string[]; referencias: string[] }>()
    for (const r of refs) {
      const e = m.get(r.pedido) ?? { tallas: [], referencias: [] }
      if (r.talla && !e.tallas.includes(r.talla)) e.tallas.push(r.talla)
      if (r.nombre && !e.referencias.includes(r.nombre))
        e.referencias.push(r.nombre)
      m.set(r.pedido, e)
    }
    return m
  }, [refs])

  const total = filas.reduce((s, f) => s + (Number(f.cantidad) || 0), 0)

  const set = (i: number, campo: keyof FilaExtra, valor: string) => {
    const copia = [...filas]
    copia[i] = { ...copia[i], [campo]: valor }
    onChange(copia)
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-icon-cyan" />
        <Label className="text-sm">
          Piezas extra <span className="text-slate-400">(opcional)</span>
        </Label>
        {total > 0 && (
          <Badge variant="outline" className="text-[11px] tabular-nums">
            {total} pcs
          </Badge>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([
              ...filas,
              {
                pedido: pedidos[0] ?? "",
                talla: "",
                referencia: "",
                cantidad: "",
              },
            ])
          }
          className="ml-auto h-7 text-xs"
        >
          <Plus className="mr-1 size-3.5" />
          Agregar
        </Button>
      </div>

      {filas.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Piezas que sobraron del corte. Se registran con su talla y
          referencia para que queden disponibles en el inventario.
        </p>
      ) : (
        <>
          {/* Listas de sugerencias tomadas del detalle real del pedido. */}
          {[...opciones.entries()].map(([pedido, o]) => (
            <div key={pedido} className="hidden">
              <datalist id={`tallas-${pedido}`}>
                {o.tallas.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <datalist id={`refs-${pedido}`}>
                {o.referencias.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          ))}

          <div className="space-y-1.5">
            {filas.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                {pedidos.length > 1 ? (
                  <select
                    value={f.pedido}
                    onChange={(e) => set(i, "pedido", e.target.value)}
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                  >
                    {pedidos.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="min-w-[5.5rem] text-xs font-medium text-slate-700">
                    {f.pedido || pedidos[0]}
                  </span>
                )}
                <Input
                  list={`refs-${f.pedido || pedidos[0]}`}
                  value={f.referencia}
                  onChange={(e) => set(i, "referencia", e.target.value)}
                  placeholder="Referencia"
                  className="h-8 flex-1 text-xs"
                />
                <Input
                  list={`tallas-${f.pedido || pedidos[0]}`}
                  value={f.talla}
                  onChange={(e) => set(i, "talla", e.target.value)}
                  placeholder="Talla"
                  className="h-8 w-20 text-xs"
                />
                <Input
                  type="number"
                  min={1}
                  value={f.cantidad}
                  onChange={(e) => set(i, "cantidad", e.target.value)}
                  placeholder="Pcs"
                  className="h-8 w-20 text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onChange(filas.filter((_, j) => j !== i))}
                  className="size-8 text-slate-400 hover:text-rose-600"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Convierte las filas del formulario en altas listas para guardar. */
export function aAltas(
  filas: FilaExtra[],
  extra?: { coreId?: number | null; registradoPor?: string | null; tela?: string | null }
): AltaCorte[] {
  return filas
    .filter((f) => Number(f.cantidad) > 0)
    .map((f) => ({
      pedido: f.pedido,
      talla: f.talla,
      referencia: f.referencia,
      cantidad: Number(f.cantidad),
      tela: extra?.tela ?? null,
      coreId: extra?.coreId ?? null,
      registradoPor: extra?.registradoPor ?? null,
    }))
}
