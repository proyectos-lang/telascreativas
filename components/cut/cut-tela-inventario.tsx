"use client"

/**
 * Selector de la tela de inventario que se descuenta al cerrar el corte.
 *
 * El cortador la elige en vez de deducirse del pedido porque
 * `detalleorden` guarda el nombre de la tela pero no el color, y el
 * inventario sí lo distingue: SUPERSOFT tiene 14 variantes de color.
 * Además solo el 30% de los nombres coincide entre ambos catálogos.
 * Descontar la tela equivocada es peor que no descontar nada.
 *
 * Se sugiere la que coincide por nombre con el detalle del pedido, pero
 * la decisión siempre es del cortador: la sugerencia acierta en un tercio
 * de los casos y presentarla como definitiva daría una falsa confianza.
 */

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Package, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  cargarTelasInventario,
  type TelaInventario,
} from "@/lib/inventario/salida-corte"

/** Misma normalización que usa el motor de cores. */
function normalizar(t: string | null | undefined): string {
  return String(t ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

interface Props {
  /** Nombre de la tela según el detalle del pedido, para sugerir. */
  telaSugerida?: string | null
  /** Yardas que se van a descontar, para avisar si no alcanzan. */
  yardas: number
  valor: number | null
  onChange: (telaId: number | null) => void
}

export function CutTelaInventario({
  telaSugerida,
  yardas,
  valor,
  onChange,
}: Props) {
  const [telas, setTelas] = useState<TelaInventario[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void cargarTelasInventario().then((t) => {
      if (!vivo) return
      setTelas(t)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  /** Telas cuyo nombre coincide con el del pedido. */
  const sugeridas = useMemo(() => {
    const n = normalizar(telaSugerida)
    if (!n) return new Set<number>()
    return new Set(
      telas.filter((t) => normalizar(t.nombre) === n).map((t) => t.id)
    )
  }, [telas, telaSugerida])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const lista = telas.filter(
      (t) =>
        !q ||
        `${t.nombre} ${t.color ?? ""} ${t.codigo ?? ""}`
          .toLowerCase()
          .includes(q)
    )
    // Las sugeridas primero: son las que probablemente busca.
    return lista.sort((a, b) => {
      const sa = sugeridas.has(a.id) ? 0 : 1
      const sb = sugeridas.has(b.id) ? 0 : 1
      if (sa !== sb) return sa - sb
      return a.nombre.localeCompare(b.nombre)
    })
  }, [telas, busqueda, sugeridas])

  const elegida = telas.find((t) => t.id === valor) ?? null
  const stock = Number(elegida?.stock_yardas ?? 0)
  const quedaria = Math.round((stock - yardas) * 100) / 100

  return (
    <div className="space-y-2">
      <Label className="text-sm">
        Tela consumida <span className="text-slate-400">(inventario)</span>
      </Label>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={
            cargando ? "Cargando telas…" : "Buscar por nombre, color o código…"
          }
          disabled={cargando}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
        {visibles.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {cargando ? "Cargando…" : "Ninguna tela coincide."}
          </p>
        ) : (
          visibles.map((t) => {
            const sel = valor === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(sel ? null : t.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                  sel ? "bg-cyan-50 ring-1 ring-cyan-400" : "hover:bg-slate-50"
                )}
              >
                {sel ? (
                  <Check className="size-3.5 shrink-0 text-cyan-600" />
                ) : (
                  <Package className="size-3.5 shrink-0 text-slate-300" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {t.nombre}
                  {t.color ? (
                    <span className="font-normal text-slate-500">
                      {" "}
                      · {t.color}
                    </span>
                  ) : null}
                </span>
                {sugeridas.has(t.id) && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-cyan-300 bg-cyan-50 text-[9px] text-cyan-700"
                  >
                    del pedido
                  </Badge>
                )}
                <span className="shrink-0 tabular-nums text-slate-500">
                  {Number(t.stock_yardas ?? 0).toLocaleString("es-CO", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  yd
                </span>
              </button>
            )
          })
        )}
      </div>

      {elegida && yardas > 0 && (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px]",
            quedaria < 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-600"
          )}
        >
          {quedaria < 0 && (
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" />
          )}
          <span>
            Se descuentan <strong>{yardas} yd</strong> de {elegida.nombre}
            {elegida.color ? ` · ${elegida.color}` : ""}. Quedaría en{" "}
            <strong>{quedaria} yd</strong>
            {quedaria < 0 && (
              <>
                {" "}
                — el stock queda negativo. El corte se registra igual; revisa
                si falta capturar un ingreso.
              </>
            )}
          </span>
        </p>
      )}

      {!elegida && (
        <p className="text-[11px] text-muted-foreground">
          Sin elegir tela no se descuenta del inventario; el corte se registra
          igual.
        </p>
      )}
    </div>
  )
}
