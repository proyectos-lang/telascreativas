"use client"

import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, ChevronUp, AlertTriangle, FileCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { GDColorPicker } from "./gd-color-picker"
import { GDFileUploader } from "./gd-file-uploader"
import { GDLogoPlacement } from "./gd-logo-placement"
import { GDSimboloSelector } from "./gd-simbolo-selector"
import type { GestionDiseno, TipoDiseno, LogoPosition, CatalogoPrenda } from "@/lib/gestion-disenos-types"
import {
  ACCESORIOS_GD_OPTIONS,
  TIPOGRAFIA_GD_OPTIONS,
} from "@/lib/gestion-disenos-types"
import { getCatalogoPrendas, CATEGORIAS_PRENDA, prendaLabel } from "@/lib/catalogo-prendas"
import { cn } from "@/lib/utils"

type FormData = Partial<GestionDiseno>

interface GDSchematicFormProps {
  initialData?: FormData
  gestId?: number
  onChange: (data: FormData) => void
  disabled?: boolean
  onRequestSourcePicker?: () => void
  sourceDesignLabel?: string | null
  onRequestManualUpload?: () => void
  uploadingBase?: boolean
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      {title}
      {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
    </button>
  )
}

export function GDSchematicForm({
  initialData = {},
  gestId,
  onChange,
  disabled,
  onRequestSourcePicker,
  sourceDesignLabel,
  onRequestManualUpload,
  uploadingBase,
}: GDSchematicFormProps) {
  const [data, setData] = useState<FormData>(initialData)
  const [openSections, setOpenSections] = useState({
    base: true,
    colores: true,
    simbolos: false,
    logos: false,
    segunda: false,
    detalles: true,
  })

  const update = (patch: Partial<FormData>) => {
    const next = { ...data, ...patch }
    setData(next)
    onChange(next)
  }

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  const [catalogoPrendas, setCatalogoPrendas] = useState<CatalogoPrenda[]>([])
  useEffect(() => { getCatalogoPrendas().then(setCatalogoPrendas) }, [])

  const tiposPrend = data.tipos_prenda || []
  const cantLogos = data.cantidad_logos || 0

  const prefix = gestId ? `gd_${gestId}` : `gd_new_${Date.now()}`

  return (
    <div className="space-y-3">
      {/* Tipo de diseño */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Tipo de Diseño <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2">
          {(["Nuevo", "Recreacion", "Editable", "Existente"] as TipoDiseno[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => update({ tipo_diseno: t })}
              className={cn(
                "flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all",
                data.tipo_diseno === t
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Base del diseño existente — dos opciones: historial o archivo manual */}
      {data.tipo_diseno === "Existente" && !disabled && (onRequestSourcePicker || onRequestManualUpload) && (
        <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-semibold text-indigo-900">Base del diseño existente</p>

          {/* Estado actual */}
          {sourceDesignLabel ? (
            <div className="flex items-center gap-1.5 rounded bg-indigo-100 px-2 py-1 text-xs">
              <span className="text-indigo-500">Del historial:</span>
              <span className="font-mono font-semibold text-indigo-800">{sourceDesignLabel}</span>
            </div>
          ) : data.urls_diseno_base?.length ? (
            <div className="flex items-center gap-1.5 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs">
              <FileCheck className="size-3 shrink-0 text-green-600" />
              <span className="truncate text-green-700">
                {decodeURIComponent(
                  data.urls_diseno_base[0].split("/").pop()?.split("?")[0]?.replace(/^[^_]+_[^_]+_[^_]+_/, "") || "Archivo subido"
                )}
              </span>
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              Selecciona un diseño del historial o sube un archivo como base
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex gap-1.5">
            {onRequestSourcePicker && (
              <button
                type="button"
                onClick={onRequestSourcePicker}
                className="flex-1 rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                {sourceDesignLabel ? "Cambiar historial" : "Del historial..."}
              </button>
            )}
            {onRequestManualUpload && (
              <button
                type="button"
                onClick={onRequestManualUpload}
                disabled={uploadingBase}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {uploadingBase
                  ? "Subiendo..."
                  : data.urls_diseno_base?.length && !sourceDesignLabel
                  ? "Cambiar archivo"
                  : "Subir archivo..."}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cambios solicitados (campo clave cuando tipo = Existente) */}
      {data.tipo_diseno === "Existente" && (
        <div className="space-y-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
          <Label className="flex items-center gap-1 text-sm font-semibold text-amber-900">
            <AlertTriangle className="size-3.5" />
            Cambios solicitados <span className="text-red-500">*</span>
          </Label>
          <Textarea
            placeholder="Describe qué debe modificarse respecto al diseño anterior..."
            value={data.cambios_solicitados || ""}
            onChange={(e) => update({ cambios_solicitados: e.target.value })}
            rows={3}
            disabled={disabled}
            className="border-amber-200 bg-white"
          />
          <p className="text-xs text-amber-700">
            Indica claramente qué elementos cambian del diseño original.
          </p>
        </div>
      )}

      {/* Temática (Nuevo / Recreacion) */}
      {data.tipo_diseno && data.tipo_diseno !== "Editable" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Temática <span className="text-red-500">*</span>
          </Label>
          <Input
            value={data.tematica || ""}
            onChange={(e) => update({ tematica: e.target.value })}
            placeholder="Describe hacia dónde va orientado el diseño..."
            disabled={disabled}
          />
        </div>
      )}

      {/* Sección: Tipo de Prenda */}
      <div className="space-y-2">
        <SectionHeader
          title="Tipo de Prenda"
          open={openSections.base}
          onToggle={() => toggleSection("base")}
        />
        {openSections.base && (
          <div className="space-y-2 px-1">
            <div className="flex flex-wrap gap-2">
              {tiposPrend.map((p, i) => (
                <div key={i} className="flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1">
                  <span className="text-sm text-indigo-700">{p}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        update({ tipos_prenda: tiposPrend.filter((_, idx) => idx !== i) })
                      }
                    >
                      <X className="size-3 text-indigo-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!disabled && (
              <Select
                onValueChange={(v) =>
                  !tiposPrend.includes(v) &&
                  update({ tipos_prenda: [...tiposPrend, v] })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Agregar prenda..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PRENDA.map((cat) => {
                    const items = catalogoPrendas.filter((p) => p.categoria === cat)
                    if (!items.length) return null
                    return (
                      <SelectGroup key={cat}>
                        <SelectLabel>{cat}</SelectLabel>
                        {items.map((p) => {
                          const label = prendaLabel(p)
                          return (
                            <SelectItem key={p.id} value={label}>
                              {label}
                            </SelectItem>
                          )
                        })}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            )}

            {data.tipo_diseno !== "Editable" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo de Manga</Label>
                <div className="flex gap-2">
                  {(["Corta", "Larga"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => update({ tipo_manga: m })}
                      className={cn(
                        "rounded-lg border px-4 py-1.5 text-sm transition-all",
                        data.tipo_manga === m
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <GDFileUploader
              label="Prototipo de prenda (referencia)"
              value={data.urls_prototipo_prenda || []}
              onChange={(urls) => update({ urls_prototipo_prenda: urls })}
              pathPrefix={`${prefix}_prenda`}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Sección: Colores */}
      {data.tipo_diseno !== "Editable" && (
        <div className="space-y-2">
          <SectionHeader
            title="Colores"
            open={openSections.colores}
            onToggle={() => toggleSection("colores")}
          />
          {openSections.colores && (
            <div className="grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
              <div className="space-y-2">
                <GDColorPicker
                  label="Color de Fondo"
                  value={data.color_fondo || null}
                  onChange={(v) => update({ color_fondo: v })}
                  required
                />
                <GDFileUploader
                  value={data.urls_diseno_base || []}
                  onChange={(urls) => update({ urls_diseno_base: urls })}
                  pathPrefix={`${prefix}_colorfd`}
                  disabled={disabled}
                  maxFiles={3}
                />
              </div>
              <div className="space-y-2">
                <GDColorPicker
                  label="Color Secundario"
                  value={data.color_secundario || null}
                  onChange={(v) => update({ color_secundario: v })}
                  required
                />
                <GDFileUploader
                  value={data.urls_imagenes_simbolos || []}
                  onChange={(urls) => update({ urls_imagenes_simbolos: urls })}
                  pathPrefix={`${prefix}_colorsec`}
                  disabled={disabled}
                  maxFiles={3}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sección: Símbolos y texturas */}
      {data.tipo_diseno !== "Editable" && (
        <div className="space-y-2">
          <SectionHeader
            title="Imágenes, Símbolos o Texturas"
            open={openSections.simbolos}
            onToggle={() => toggleSection("simbolos")}
          />
          {openSections.simbolos && (
            <div className="space-y-3 px-1">
              <GDSimboloSelector
                value={data.simbolos_seleccionados || []}
                onChange={(ids) => update({ simbolos_seleccionados: ids })}
                disabled={disabled}
              />
              <GDFileUploader
                label="Imágenes de referencia adicionales"
                value={data.urls_imagenes_simbolos || []}
                onChange={(urls) => update({ urls_imagenes_simbolos: urls })}
                pathPrefix={`${prefix}_simbolos`}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {/* Recreacion: prototipo específico */}
      {data.tipo_diseno === "Recreacion" && (
        <GDFileUploader
          label="Archivo / imagen a recrear"
          value={data.urls_recreacion || []}
          onChange={(urls) => update({ urls_recreacion: urls })}
          pathPrefix={`${prefix}_recreacion`}
          disabled={disabled}
        />
      )}

      {/* Sección: Logos */}
      {data.tipo_diseno !== "Editable" && (
        <div className="space-y-2">
          <SectionHeader
            title="Logos y Patrocinadores"
            open={openSections.logos}
            onToggle={() => toggleSection("logos")}
          />
          {openSections.logos && (
            <div className="space-y-4 px-1">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lleva_logos"
                    checked={data.lleva_logos || false}
                    onCheckedChange={(c) => update({ lleva_logos: !!c })}
                    disabled={disabled}
                  />
                  <Label htmlFor="lleva_logos" className="text-sm">Lleva logos</Label>
                  {data.lleva_logos && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Cantidad:</span>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={data.cantidad_logos || ""}
                        onChange={(e) => update({ cantidad_logos: parseInt(e.target.value) || 0 })}
                        className="h-7 w-16 text-sm"
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="lleva_pat"
                    checked={data.lleva_patrocinadores || false}
                    onCheckedChange={(c) => update({ lleva_patrocinadores: !!c })}
                    disabled={disabled}
                  />
                  <Label htmlFor="lleva_pat" className="text-sm">Lleva patrocinadores</Label>
                  {data.lleva_patrocinadores && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Cantidad:</span>
                      <Input
                        type="number"
                        min={1}
                        value={data.cantidad_patrocinadores || ""}
                        onChange={(e) => update({ cantidad_patrocinadores: parseInt(e.target.value) || 0 })}
                        className="h-7 w-16 text-sm"
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              </div>

              {data.lleva_logos && cantLogos > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Posición de logos — Prenda 1</Label>
                  <GDLogoPlacement
                    tipo={tiposPrend[0] || "Camiseta Básica"}
                    value={data.posiciones_logos_prenda1 || []}
                    onChange={(pos) => update({ posiciones_logos_prenda1: pos })}
                    cantidadLogos={cantLogos}
                    disabled={disabled}
                    pathPrefix={`${prefix}_logos1`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Segunda prenda */}
      {data.tipo_diseno !== "Editable" && tiposPrend.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="seg_prenda"
              checked={data.segunda_prenda_activa || false}
              onCheckedChange={(c) => update({ segunda_prenda_activa: !!c })}
              disabled={disabled}
            />
            <Label htmlFor="seg_prenda" className="text-sm font-medium">
              Agregar segunda prenda
            </Label>
          </div>

          {data.segunda_prenda_activa && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex gap-2">
                {(["Relacionado", "Diferente"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ segunda_prenda_relacion: r })}
                    className={cn(
                      "rounded-lg border px-4 py-1.5 text-sm transition-all",
                      data.segunda_prenda_relacion === r
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {data.segunda_prenda_relacion === "Diferente" && (
                <div className="space-y-3">
                  <Select
                    value={data.segunda_tipo_prenda || ""}
                    onValueChange={(v) => update({ segunda_tipo_prenda: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de segunda prenda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_PRENDA.map((cat) => {
                        const items = catalogoPrendas.filter((p) => p.categoria === cat)
                        if (!items.length) return null
                        return (
                          <SelectGroup key={cat}>
                            <SelectLabel>{cat}</SelectLabel>
                            {items.map((p) => {
                              const label = prendaLabel(p)
                              return <SelectItem key={p.id} value={label}>{label}</SelectItem>
                            })}
                          </SelectGroup>
                        )
                      })}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-3">
                    <GDColorPicker
                      label="Color de Fondo"
                      value={data.segunda_color_fondo || null}
                      onChange={(v) => update({ segunda_color_fondo: v })}
                    />
                    <GDColorPicker
                      label="Color Secundario"
                      value={data.segunda_color_secundario || null}
                      onChange={(v) => update({ segunda_color_secundario: v })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="seg_bolsas"
                      checked={data.segunda_bolsas || false}
                      onCheckedChange={(c) => update({ segunda_bolsas: !!c })}
                      disabled={disabled}
                    />
                    <Label htmlFor="seg_bolsas" className="text-sm">Lleva bolsas</Label>
                  </div>

                  {data.lleva_logos && cantLogos > 0 && data.segunda_tipo_prenda && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Posición de logos — Prenda 2</Label>
                      <GDLogoPlacement
                        tipo={data.segunda_tipo_prenda}
                        value={data.posiciones_logos_prenda2 || []}
                        onChange={(pos) => update({ posiciones_logos_prenda2: pos })}
                        cantidadLogos={cantLogos}
                        disabled={disabled}
                        pathPrefix={`${prefix}_logos2`}
                      />
                    </div>
                  )}

                  <Textarea
                    placeholder="Otros detalles de la segunda prenda..."
                    value={data.segunda_otros_detalles || ""}
                    onChange={(e) => update({ segunda_otros_detalles: e.target.value })}
                    rows={2}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sección: Detalles finales */}
      <div className="space-y-2">
        <SectionHeader
          title="Accesorios, Tipografía y Otros Detalles"
          open={openSections.detalles}
          onToggle={() => toggleSection("detalles")}
        />
        {openSections.detalles && (
          <div className="space-y-3 px-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Accesorios</Label>
                <Select
                  value={data.accesorios || ""}
                  onValueChange={(v) => update({ accesorios: v })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESORIOS_GD_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipografía</Label>
                <Select
                  value={data.tipografia || ""}
                  onValueChange={(v) => update({ tipografia: v })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOGRAFIA_GD_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Otros detalles (colores, logos, patrocinadores, ubicaciones no especificadas)
              </Label>
              <Textarea
                placeholder="Especificar detalles adicionales..."
                value={data.otros_detalles || ""}
                onChange={(e) => update({ otros_detalles: e.target.value })}
                rows={3}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
