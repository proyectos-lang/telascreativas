"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import type { CatalogoSimbolo } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface GDSimboloSelectorProps {
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function GDSimboloSelector({ value, onChange, disabled }: GDSimboloSelectorProps) {
  const { getCatalogoSimbolos } = useGD()
  const [simbolos, setSimbolos] = useState<CatalogoSimbolo[]>([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState<string>("Todos")

  useEffect(() => {
    getCatalogoSimbolos().then((data) => {
      setSimbolos(data)
      setLoading(false)
    })
  }, [getCatalogoSimbolos])

  const categorias = ["Todos", ...Array.from(new Set(simbolos.map((s) => s.categoria).filter(Boolean)))]
  const filtered = categoria === "Todos" ? simbolos : simbolos.filter((s) => s.categoria === categoria)

  const toggle = (id: number) => {
    if (disabled) return
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    onChange(next)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Cargando catálogo...</span>
      </div>
    )
  }

  if (!simbolos.length) {
    return (
      <p className="text-sm text-slate-400">
        No hay símbolos en el catálogo. Un administrador debe agregar opciones.
      </p>
    )
  }

  // Read-only: show only the selected items, no category tabs
  if (disabled) {
    const selectedItems = simbolos.filter((s) => value.includes(s.id))
    if (!selectedItems.length) {
      return (
        <p className="text-sm text-slate-400">
          Sin imágenes, símbolos o texturas seleccionadas.
        </p>
      )
    }
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {selectedItems.map((s) => (
          <div
            key={s.id}
            className="relative flex flex-col items-center gap-1 rounded-lg border-2 border-indigo-500 bg-indigo-50 p-2 text-center"
          >
            <div className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-indigo-500">
              <Check className="size-2.5 text-white" />
            </div>
            <div className="h-12 w-full overflow-hidden rounded-md bg-slate-100">
              <img src={s.imagen_url} alt={s.nombre} className="h-full w-full object-cover" />
            </div>
            <p className="text-[10px] font-medium leading-tight text-slate-700">{s.nombre}</p>
            {s.categoria && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">{s.categoria}</Badge>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Editing mode: full catalog with category filter tabs
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {categorias.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(cat)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              categoria === cat
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {filtered.map((s) => {
          const selected = value.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-center transition-all",
                selected
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              {selected && (
                <div className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-indigo-500">
                  <Check className="size-2.5 text-white" />
                </div>
              )}
              <div className="h-12 w-full overflow-hidden rounded-md bg-slate-100">
                <img
                  src={s.imagen_url}
                  alt={s.nombre}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-[10px] font-medium leading-tight text-slate-700">{s.nombre}</p>
              {s.categoria && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {s.categoria}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
