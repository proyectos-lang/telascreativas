"use client"

/**
 * Panel de edición: color base, textura y capas de logos.
 *
 * Los colores y las texturas salen de los catálogos reales de la empresa
 * (`catalogo_colores`, `gd_catalogo_simbolos`), que son los mismos que usa
 * Gestión de Diseños. Se permite además un color libre porque el módulo
 * es para explorar, pero el catálogo va primero: es lo que de verdad se
 * puede producir.
 */

import { useRef, useState } from "react"
import {
  Check,
  ImagePlus,
  Layers,
  Loader2,
  Palette,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useEstudio3D } from "@/lib/estudio-3d-context"
import type {
  CapaLogo,
  CapaTextura,
  DisenoEstudio,
  Vista,
} from "@/lib/estudio-3d/tipos"

interface Props {
  diseno: DisenoEstudio
  vista: Vista
  seleccionado: string | null
  onSeleccionar: (id: string | null) => void
  onCambiarColor: (hex: string) => void
  onCambiarTextura: (t: CapaTextura | null) => void
  onAgregarLogo: (url: string, nombre: string) => void
  onEditarLogo: (id: string, cambios: Partial<CapaLogo>) => void
  onBorrarLogo: (id: string) => void
}

export function EstudioPanel({
  diseno,
  vista,
  seleccionado,
  onSeleccionar,
  onCambiarColor,
  onCambiarTextura,
  onAgregarLogo,
  onEditarLogo,
  onBorrarLogo,
}: Props) {
  const { colores, texturas, subirArchivo } = useEstudio3D()
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cara = diseno.caras[vista]
  const logos = diseno.logos.filter((l) => l.vista === vista)
  const activo = logos.find((l) => l.id === seleccionado) ?? null

  const subirLogo = async (file: File) => {
    setSubiendo(true)
    const r = await subirArchivo(file, "logos")
    setSubiendo(false)
    if (r.success && r.url) {
      onAgregarLogo(r.url, file.name.replace(/\.[^.]+$/, ""))
      toast.success("Logo agregado")
    } else {
      toast.error("No se pudo subir el logo", { description: r.error })
    }
  }

  return (
    <div className="space-y-5">
      {/* Color base */}
      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Palette className="size-4 text-icon-cyan" />
          Color de la prenda
          <Badge variant="outline" className="ml-auto text-[10px] font-normal">
            {vista === "frontal" ? "Frente" : "Espalda"}
          </Badge>
        </h4>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={cara.color}
            onChange={(e) => onCambiarColor(e.target.value)}
            className="size-9 cursor-pointer rounded border border-slate-200"
            title="Color libre"
          />
          <Input
            value={cara.color.toUpperCase()}
            onChange={(e) => {
              const v = e.target.value.trim()
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onCambiarColor(v)
            }}
            className="h-9 w-28 font-mono text-xs"
          />
          <span className="text-[11px] text-muted-foreground">
            o elige del catálogo
          </span>
        </div>

        {/* Catálogo real: 110 colores con su equivalencia CMYK. */}
        <div className="grid max-h-40 grid-cols-10 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {colores.map((c) => {
            const puesto = cara.color.toUpperCase() === c.hex.toUpperCase()
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCambiarColor(c.hex)}
                title={`${c.nombre}${c.familia ? ` · ${c.familia}` : ""}`}
                style={{ backgroundColor: c.hex }}
                className={cn(
                  "relative aspect-square rounded border transition",
                  puesto
                    ? "border-cyan-500 ring-2 ring-cyan-300"
                    : "border-slate-200 hover:scale-110"
                )}
              >
                {puesto && (
                  <Check className="absolute inset-0 m-auto size-3 text-white mix-blend-difference" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Textura / patrón */}
      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Layers className="size-4 text-icon-cyan" />
          Textura o patrón
        </h4>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onCambiarTextura(null)}
            className={cn(
              "flex size-14 items-center justify-center rounded-lg border text-[10px] transition",
              !cara.textura
                ? "border-cyan-500 bg-cyan-50 text-cyan-700 ring-2 ring-cyan-200"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            Ninguna
          </button>
          {texturas.map((t) => {
            const puesta = cara.textura?.url === t.imagen_url
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onCambiarTextura({
                    url: t.imagen_url,
                    nombre: t.nombre,
                    escala: 1,
                    opacidad: 1,
                    rotacion: 0,
                  })
                }
                title={`${t.nombre} · ${t.categoria}`}
                className={cn(
                  "size-14 overflow-hidden rounded-lg border transition",
                  puesta
                    ? "border-cyan-500 ring-2 ring-cyan-200"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.imagen_url}
                  alt={t.nombre}
                  className="size-full object-cover"
                />
              </button>
            )
          })}
        </div>

        {cara.textura && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
            <Deslizador
              etiqueta="Tamaño"
              valor={cara.textura.escala}
              min={0.1}
              max={4}
              paso={0.05}
              formato={(v) => `${v.toFixed(2)}×`}
              onChange={(v) =>
                onCambiarTextura({ ...cara.textura!, escala: v })
              }
            />
            <Deslizador
              etiqueta="Opacidad"
              valor={cara.textura.opacidad}
              min={0}
              max={1}
              paso={0.05}
              formato={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) =>
                onCambiarTextura({ ...cara.textura!, opacidad: v })
              }
            />
            <Deslizador
              etiqueta="Rotación"
              valor={cara.textura.rotacion}
              min={0}
              max={180}
              paso={1}
              formato={(v) => `${Math.round(v)}°`}
              onChange={(v) =>
                onCambiarTextura({ ...cara.textura!, rotacion: v })
              }
            />
          </div>
        )}
      </section>

      {/* Logos */}
      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <ImagePlus className="size-4 text-icon-cyan" />
          Logos e imágenes
          <Badge variant="outline" className="ml-auto text-[10px]">
            {logos.length}
          </Badge>
        </h4>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void subirLogo(f)
            e.target.value = ""
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          className="w-full"
        >
          {subiendo ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 size-3.5" />
          )}
          Subir logo o imagen
        </Button>

        {logos.length > 0 && (
          <div className="space-y-1">
            {logos
              .slice()
              .sort((a, b) => b.z - a.z)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSeleccionar(l.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition",
                    seleccionado === l.id
                      ? "border-cyan-400 bg-cyan-50"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.url}
                    alt=""
                    className="size-7 shrink-0 rounded border border-slate-200 bg-white object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {l.nombre}
                  </span>
                  <Trash2
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onBorrarLogo(l.id)
                    }}
                    className="size-3.5 shrink-0 text-slate-400 hover:text-rose-600"
                  />
                </button>
              ))}
          </div>
        )}

        {/* Ajustes del logo seleccionado */}
        {activo && (
          <div className="space-y-2 rounded-lg border border-cyan-200 bg-cyan-50/40 p-2.5">
            <p className="truncate text-[11px] font-medium text-cyan-900">
              {activo.nombre}
            </p>
            <Deslizador
              etiqueta="Tamaño"
              valor={activo.ancho}
              min={2}
              max={90}
              paso={1}
              formato={(v) => `${Math.round(v)}%`}
              onChange={(v) => onEditarLogo(activo.id, { ancho: v })}
            />
            <Deslizador
              etiqueta="Rotación"
              valor={activo.rotacion}
              min={-180}
              max={180}
              paso={1}
              formato={(v) => `${Math.round(v)}°`}
              onChange={(v) => onEditarLogo(activo.id, { rotacion: v })}
            />
            <Deslizador
              etiqueta="Opacidad"
              valor={activo.opacidad}
              min={0}
              max={1}
              paso={0.05}
              formato={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onEditarLogo(activo.id, { opacidad: v })}
            />
          </div>
        )}
      </section>
    </div>
  )
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  formato,
  onChange,
}: {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso: number
  formato: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-slate-600">{etiqueta}</Label>
        <span className="text-[11px] tabular-nums text-slate-500">
          {formato(valor)}
        </span>
      </div>
      <Slider
        value={[valor]}
        min={min}
        max={max}
        step={paso}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}
