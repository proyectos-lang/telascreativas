"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Palette, Search } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { CatalogoColor } from "@/lib/gestion-disenos-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Caché a nivel de módulo: una sola petición para toda la página
let _coloresCache: CatalogoColor[] | null = null
let _fetching: Promise<CatalogoColor[]> | null = null

async function getColoresCatalogo(): Promise<CatalogoColor[]> {
  if (_coloresCache) return _coloresCache
  if (_fetching) return _fetching
  _fetching = new Promise((resolve) => {
    supabase
      .schema("telas")
      .from("catalogo_colores")
      .select("id, nombre, hex, r, g, b, c, m, y, k, familia, activo, orden")
      .eq("activo", true)
      .order("orden")
      .then(({ data }) => {
        _coloresCache = (data as CatalogoColor[]) ?? []
        resolve(_coloresCache)
      })
  })
  return _fetching
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "")
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    }
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    }
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function isValidHex(val: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)
}

function needsDarkText(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5
}

interface GDColorPickerProps {
  label: string
  value: string | null
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

export function GDColorPicker({ label, value, onChange, required, disabled }: GDColorPickerProps) {
  const [mode, setMode] = useState<"hex" | "rgb">("hex")
  const [hexInput, setHexInput] = useState(value || "")
  const [colores, setColores] = useState<CatalogoColor[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [familiaActiva, setFamiliaActiva] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loaded = useRef(false)

  const rgb = value && isValidHex(value) ? hexToRgb(value) : null
  const [rVal, setRVal] = useState(rgb?.r ?? 0)
  const [gVal, setGVal] = useState(rgb?.g ?? 0)
  const [bVal, setBVal] = useState(rgb?.b ?? 0)

  // Cargar catálogo cuando se abre la paleta (una vez)
  useEffect(() => {
    if (paletteOpen && !loaded.current) {
      loaded.current = true
      getColoresCatalogo().then(setColores)
    }
  }, [paletteOpen])

  // Sincronizar hexInput con value externo
  useEffect(() => {
    setHexInput(value || "")
    if (value && isValidHex(value)) {
      const parsed = hexToRgb(value)
      if (parsed) { setRVal(parsed.r); setGVal(parsed.g); setBVal(parsed.b) }
    }
  }, [value])

  const handleHexChange = useCallback(
    (raw: string) => {
      const val = raw.startsWith("#") ? raw : `#${raw}`
      setHexInput(raw)
      if (isValidHex(val)) {
        const parsed = hexToRgb(val)
        if (parsed) { setRVal(parsed.r); setGVal(parsed.g); setBVal(parsed.b) }
        onChange(val.toUpperCase())
      }
    },
    [onChange]
  )

  const handleRgbChange = useCallback(
    (r: number, g: number, b: number) => {
      setRVal(r); setGVal(g); setBVal(b)
      const hex = rgbToHex(r, g, b)
      setHexInput(hex)
      onChange(hex.toUpperCase())
    },
    [onChange]
  )

  const selectFromCatalog = (color: CatalogoColor) => {
    setHexInput(color.hex)
    const parsed = hexToRgb(color.hex)
    if (parsed) { setRVal(parsed.r); setGVal(parsed.g); setBVal(parsed.b) }
    onChange(color.hex.toUpperCase())
    setPaletteOpen(false)
    setBusqueda("")
  }

  const previewColor = value && isValidHex(value) ? value : "#e2e8f0"

  // Match color in catalog
  const catalogMatch = colores.find(
    (c) => c.hex.toUpperCase() === (value || "").toUpperCase()
  )

  // Filtrar colores
  const q = busqueda.toLowerCase()
  const coloresFiltrados = colores.filter((c) => {
    const matchFamilia = !familiaActiva || c.familia === familiaActiva
    const matchBusqueda = !q || c.hex.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q) || (c.familia || "").toLowerCase().includes(q)
    return matchFamilia && matchBusqueda
  })

  // Agrupar por familia
  const familias = Array.from(new Set(colores.map((c) => c.familia || "Otro")))
  const grupos: Record<string, CatalogoColor[]> = {}
  for (const c of coloresFiltrados) {
    const f = c.familia || "Otro"
    if (!grupos[f]) grupos[f] = []
    grupos[f].push(c)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      <div className="flex items-center gap-2">
        {/* Swatch de preview */}
        <div
          className="size-9 shrink-0 rounded-md border border-slate-200 shadow-inner"
          style={{ backgroundColor: previewColor }}
          title={catalogMatch ? `${catalogMatch.nombre} — ${catalogMatch.familia}` : previewColor}
        />

        <div className="flex-1 space-y-1 min-w-0">
          {/* Botones de modo */}
          <div className="flex gap-1 items-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setMode("hex")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                mode === "hex" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              HEX
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setMode("rgb")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                mode === "rgb" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              RGB
            </button>

            {/* Botón paleta catálogo */}
            {!disabled && (
              <Popover open={paletteOpen} onOpenChange={setPaletteOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
                      paletteOpen ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
                    )}
                    title="Seleccionar del catálogo CMYK"
                  >
                    <Palette className="size-3" />
                    Catálogo
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0"
                  align="start"
                  side="bottom"
                >
                  {/* Header de búsqueda */}
                  <div className="border-b px-3 py-2 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Catálogo CMYK — {colores.length} colores</p>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
                      <Input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por HEX o familia..."
                        className="h-7 pl-6 text-xs"
                      />
                    </div>
                    {/* Pills de familia */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setFamiliaActiva(null)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                          !familiaActiva ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        Todas
                      </button>
                      {familias.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFamiliaActiva(familiaActiva === f ? null : f)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                            familiaActiva === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid de colores */}
                  <div className="max-h-64 overflow-y-auto p-2 space-y-3">
                    {colores.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">Cargando catálogo...</p>
                    ) : Object.keys(grupos).length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">Sin coincidencias</p>
                    ) : (
                      familias
                        .filter((f) => grupos[f]?.length > 0)
                        .map((familia) => (
                          <div key={familia}>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {familia}
                            </p>
                            <div className="grid grid-cols-8 gap-1">
                              {grupos[familia].map((color) => {
                                const isSelected = (value || "").toUpperCase() === color.hex.toUpperCase()
                                return (
                                  <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => selectFromCatalog(color)}
                                    title={`${color.hex}\n${color.nombre}`}
                                    className={cn(
                                      "aspect-square w-full rounded transition-transform hover:scale-110",
                                      isSelected && "ring-2 ring-indigo-500 ring-offset-1 scale-110"
                                    )}
                                    style={{ backgroundColor: color.hex }}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* Color seleccionado del catálogo */}
                  {catalogMatch && (
                    <div className="border-t px-3 py-2 flex items-center gap-2">
                      <div
                        className="size-5 rounded shrink-0 border border-slate-200"
                        style={{ backgroundColor: catalogMatch.hex }}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-slate-700 truncate">{catalogMatch.nombre}</p>
                        <p className="text-[10px] text-slate-400">{catalogMatch.familia} · {catalogMatch.hex}</p>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Input HEX / RGB */}
          {mode === "hex" ? (
            <Input
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#RRGGBB"
              className="h-8 font-mono text-sm uppercase"
              maxLength={7}
              disabled={disabled}
            />
          ) : (
            <div className="flex gap-1">
              {(
                [
                  { label: "R", val: rVal, setter: (v: number) => handleRgbChange(v, gVal, bVal) },
                  { label: "G", val: gVal, setter: (v: number) => handleRgbChange(rVal, v, bVal) },
                  { label: "B", val: bVal, setter: (v: number) => handleRgbChange(rVal, gVal, v) },
                ] as const
              ).map(({ label: l, val, setter }) => (
                <div key={l} className="flex-1">
                  <p className="mb-0.5 text-center text-[10px] text-slate-500">{l}</p>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={val}
                    onChange={(e) => setter(parseInt(e.target.value) || 0)}
                    className="h-8 text-center text-sm"
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Nombre del color si coincide con catálogo */}
          {catalogMatch && (
            <p className="text-[10px] text-slate-400 leading-tight">
              {catalogMatch.familia} · {catalogMatch.nombre}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
