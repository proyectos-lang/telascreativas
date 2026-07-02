"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, Pencil, Eye, EyeOff, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"
import { GDFileUploader } from "./gd-file-uploader"
import type { CatalogoSimbolo, CatalogoColor, CatalogoPrenda } from "@/lib/gestion-disenos-types"
import { CATEGORIAS_PRENDA, prendaLabel } from "@/lib/catalogo-prendas"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Valores reales en la BD → nombre para mostrar (singular y plural)
const CATEGORIAS: { value: string; plural: string; singular: string }[] = [
  { value: "Patron",    plural: "Patrones",   singular: "Patrón"    },
  { value: "Textura",   plural: "Texturas",   singular: "Textura"   },
  { value: "Simbolo",   plural: "Símbolos",   singular: "Símbolo"   },
  { value: "Degradado", plural: "Degradados", singular: "Degradado" },
  { value: "Otro",      plural: "Otros",      singular: "Otro"      },
]

const FAMILIAS_COLOR = [
  "Blanco/Negro", "Rojo", "Salmon/Piel", "Naranja/Marrón",
  "Dorado/Mostaza", "Amarillo", "Verde Lima/Oliva", "Verde",
  "Turquesa/Cian", "Azul", "Azul Marino", "Azul/Violeta",
  "Violeta/Morado", "Magenta",
]

// ─── Catálogo de Patrones y Texturas ────────────────────────────────────────

interface SymbolFormData {
  nombre: string
  categoria: string
  imagen_url: string
  activo: boolean
  orden: number
}

const DEFAULT_SYMBOL_FORM: SymbolFormData = {
  nombre: "", categoria: CATEGORIAS[0].value, imagen_url: "", activo: true, orden: 1,
}

function CatalogoPatrones() {
  const [simbolos, setSimbolos] = useState<CatalogoSimbolo[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [categoriaActiva, setCategoriaActiva] = useState(CATEGORIAS[0].value)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SymbolFormData>(DEFAULT_SYMBOL_FORM)
  const [saving, setSaving] = useState(false)
  const [imagenUrls, setImagenUrls] = useState<string[]>([])

  const loadCatalogo = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .schema("telas")
      .from("gd_catalogo_simbolos")
      .select("*")
      .order("orden")
    setLoading(false)
    setLoaded(true)
    if (!error) setSimbolos((data as CatalogoSimbolo[]) || [])
  }, [])

  useEffect(() => { loadCatalogo() }, [loadCatalogo])

  const nextOrden = (cat: string) => {
    const max = simbolos
      .filter((s) => s.categoria === cat)
      .reduce((m, s) => Math.max(m, s.orden), 0)
    return max + 1
  }

  const openNew = (cat: string) => {
    setEditingId(null)
    setForm({ ...DEFAULT_SYMBOL_FORM, categoria: cat, orden: nextOrden(cat) })
    setImagenUrls([])
    setModalOpen(true)
  }

  const openEdit = (s: CatalogoSimbolo) => {
    setEditingId(s.id)
    setForm({ nombre: s.nombre, categoria: s.categoria, imagen_url: s.imagen_url, activo: s.activo, orden: s.orden })
    setImagenUrls(s.imagen_url ? [s.imagen_url] : [])
    setModalOpen(true)
  }

  const toggleActivo = async (s: CatalogoSimbolo) => {
    await supabase.schema("telas").from("gd_catalogo_simbolos").update({ activo: !s.activo }).eq("id", s.id)
    setSimbolos((prev) => prev.map((x) => x.id === s.id ? { ...x, activo: !s.activo } : x))
    toast.success(s.activo ? "Desactivado" : "Activado")
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return }
    const imagenFinal = imagenUrls[0] ?? form.imagen_url
    if (!imagenFinal) { toast.error("Debes subir una imagen"); return }
    setSaving(true)
    try {
      const payload = { ...form, imagen_url: imagenFinal }
      if (editingId) {
        const { error } = await supabase.schema("telas").from("gd_catalogo_simbolos").update(payload).eq("id", editingId)
        if (error) { toast.error("Error al actualizar", { description: error.message }); return }
        toast.success("Actualizado")
      } else {
        const { error } = await supabase.schema("telas").from("gd_catalogo_simbolos").insert(payload)
        if (error) { toast.error("Error al crear", { description: error.message }); return }
        toast.success("Creado")
      }
      setModalOpen(false)
      loadCatalogo()
    } finally {
      setSaving(false)
    }
  }

  const catInfo = (val: string) => CATEGORIAS.find((c) => c.value === val) ?? CATEGORIAS[0]

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Tabs value={categoriaActiva} onValueChange={setCategoriaActiva}>
        {/* Toolbar: sub-tabs + botón agregar */}
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-8 flex-wrap">
            {CATEGORIAS.map((cat) => {
              const count = simbolos.filter((s) => s.categoria === cat.value).length
              return (
                <TabsTrigger key={cat.value} value={cat.value} className="h-7 gap-1 text-xs">
                  {cat.plural}
                  <span className="text-[10px] tabular-nums text-slate-400 group-data-[state=active]:text-indigo-300">
                    ({count})
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <Button
            onClick={() => openNew(categoriaActiva)}
            size="sm"
            className="shrink-0 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            Agregar {catInfo(categoriaActiva).singular}
          </Button>
        </div>

        {/* Grid por categoría */}
        {CATEGORIAS.map((cat) => {
          const items = simbolos.filter((s) => s.categoria === cat.value)
          return (
            <TabsContent key={cat.value} value={cat.value} className="mt-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <p className="text-sm">Sin {cat.plural.toLowerCase()} todavía</p>
                  <Button variant="outline" size="sm" onClick={() => openNew(cat.value)} className="gap-1.5">
                    <Plus className="size-3.5" /> Agregar {cat.singular.toLowerCase()}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border p-3 transition-all",
                        s.activo ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-55"
                      )}
                    >
                      <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                        <img src={s.imagen_url} alt={s.nombre} className="h-full w-full object-cover" />
                      </div>
                      <p className="text-xs font-semibold leading-tight text-slate-700">{s.nombre}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} title="Editar">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActivo(s)} title={s.activo ? "Desactivar" : "Activar"}>
                          {s.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Modal crear / editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar" : "Agregar"} {catInfo(form.categoria).singular}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder={`Ej: ${catInfo(form.categoria).singular} Solar`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    categoria: v,
                    orden: editingId ? f.orden : nextOrden(v),
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.plural}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Imagen *</Label>
              <GDFileUploader
                value={imagenUrls}
                onChange={setImagenUrls}
                pathPrefix={`catalogo_${Date.now()}`}
                maxFiles={1}
              />
              {form.imagen_url && !imagenUrls.length && (
                <img src={form.imagen_url} alt="actual" className="mt-1 h-12 w-12 rounded object-cover" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Catálogo de Colores ────────────────────────────────────────────────────

interface ColorFormData {
  nombre: string
  hex: string
  r: number
  g: number
  b: number
  familia: string
  orden: number
}

const DEFAULT_COLOR_FORM: ColorFormData = {
  nombre: "", hex: "#000000", r: 0, g: 0, b: 0, familia: "", orden: 0,
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "")
  if (clean.length === 6)
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    }
  return null
}

function isValidHex(v: string) { return /^#([0-9A-Fa-f]{6})$/.test(v) }

function CatalogoColores() {
  const [colores, setColores] = useState<CatalogoColor[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [familiaFiltro, setFamiliaFiltro] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ColorFormData>(DEFAULT_COLOR_FORM)
  const [saving, setSaving] = useState(false)

  const loadColores = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .schema("telas")
      .from("catalogo_colores")
      .select("*")
      .order("orden")
    setLoading(false)
    setLoaded(true)
    if (!error) setColores((data as CatalogoColor[]) || [])
  }, [])

  useEffect(() => { loadColores() }, [loadColores])

  const toggleActivo = async (c: CatalogoColor) => {
    await supabase.schema("telas").from("catalogo_colores").update({ activo: !c.activo }).eq("id", c.id)
    setColores((prev) => prev.map((x) => x.id === c.id ? { ...x, activo: !c.activo } : x))
    toast.success(c.activo ? "Color quitado del catálogo" : "Color agregado al catálogo")
  }

  const updateHex = (hex: string) => {
    const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 }
    setForm((f) => ({ ...f, hex, r: rgb.r, g: rgb.g, b: rgb.b }))
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return }
    if (!isValidHex(form.hex)) { toast.error("HEX inválido (debe ser #RRGGBB)"); return }
    setSaving(true)
    try {
      const payload = { ...form, hex: form.hex.toUpperCase() }
      const { error } = await supabase.schema("telas").from("catalogo_colores").insert(payload)
      if (error) { toast.error("Error al crear", { description: error.message }); return }
      toast.success("Color agregado al catálogo")
      setModalOpen(false)
      setForm(DEFAULT_COLOR_FORM)
      loadColores()
    } finally {
      setSaving(false)
    }
  }

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  // Filtrar
  const q = busqueda.toLowerCase()
  const filtered = colores.filter((c) => {
    const matchFamilia = !familiaFiltro || c.familia === familiaFiltro
    const matchQ = !q || c.hex.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q) || (c.familia || "").toLowerCase().includes(q)
    return matchFamilia && matchQ
  })

  // Agrupar por familia
  const familiasPresentes = FAMILIAS_COLOR.filter((f) => filtered.some((c) => c.familia === f))
  const sinFamilia = filtered.filter((c) => !c.familia || !FAMILIAS_COLOR.includes(c.familia))
  const grupos: Record<string, CatalogoColor[]> = {}
  for (const f of familiasPresentes) grupos[f] = filtered.filter((c) => c.familia === f)
  if (sinFamilia.length) grupos["Otros"] = sinFamilia

  const activos = colores.filter((c) => c.activo).length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500 shrink-0">
          {activos} activos / {colores.length} total
        </p>
        <div className="relative flex-1 max-w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar HEX o familia..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm" className="shrink-0 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4" /> Agregar color
        </Button>
      </div>

      {/* Pills de familia */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFamiliaFiltro(null)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            !familiaFiltro ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          Todas
        </button>
        {FAMILIAS_COLOR.filter((f) => colores.some((c) => c.familia === f)).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamiliaFiltro(familiaFiltro === f ? null : f)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              familiaFiltro === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grupos de colores */}
      <div className="space-y-4">
        {Object.keys(grupos).length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin coincidencias</p>
        ) : (
          Object.entries(grupos).map(([familia, items]) => (
            <div key={familia}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {familia} <span className="font-normal normal-case">({items.length})</span>
              </p>
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14">
                {items.map((color) => (
                  <div key={color.id} className="group relative flex flex-col gap-1">
                    <div
                      className={cn(
                        "aspect-square w-full rounded-lg border transition-all",
                        color.activo ? "border-slate-200 shadow-sm" : "border-slate-100 opacity-30 grayscale"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={`${color.hex}\n${color.nombre}\n${color.familia}`}
                    />
                    <p className={cn(
                      "text-center font-mono text-[9px] leading-none",
                      color.activo ? "text-slate-500" : "text-slate-300"
                    )}>
                      {color.hex}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleActivo(color)}
                      title={color.activo ? "Quitar del catálogo" : "Agregar al catálogo"}
                      className={cn(
                        "absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full shadow group-hover:flex",
                        color.activo
                          ? "bg-white text-slate-500 hover:text-red-500"
                          : "bg-white text-slate-400 hover:text-indigo-600"
                      )}
                    >
                      {color.activo ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal agregar color */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Agregar color</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">HEX *</Label>
              <div className="flex items-center gap-2">
                <div
                  className="size-9 shrink-0 rounded-lg border border-slate-200 shadow-inner"
                  style={{ backgroundColor: isValidHex(form.hex) ? form.hex : "#e2e8f0" }}
                />
                <Input
                  value={form.hex}
                  onChange={(e) => updateHex(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
                  placeholder="#RRGGBB"
                  className="font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre (código CMYK o descriptivo) *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: C=0 M=0 Y=100 K=0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Familia</Label>
              <Select value={form.familia} onValueChange={(v) => setForm((f) => ({ ...f, familia: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {FAMILIAS_COLOR.map((fa) => <SelectItem key={fa} value={fa}>{fa}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Catálogo de Tipos de Prenda ────────────────────────────────────────────

const GENEROS = ["Caballero", "Dama", "Niño"]

interface PrendaFormData {
  nombre: string
  categoria: string
  genero: string
  mangas: string
  medidas: string
  orden: number
}

const DEFAULT_PRENDA_FORM: PrendaFormData = {
  nombre: "", categoria: CATEGORIAS_PRENDA[0], genero: "", mangas: "", medidas: "", orden: 1,
}

const OPCIONES_MANGAS = ["Sin Mangas", "Manga Corta", "Manga Larga", "Manga China"]

function CatalogoPrendas() {
  const [prendas, setPrendas] = useState<CatalogoPrenda[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [catActiva, setCatActiva] = useState<string>(CATEGORIAS_PRENDA[0])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<PrendaFormData>(DEFAULT_PRENDA_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .schema("telas")
      .from("catalogo_tipos_prenda")
      .select("*")
      .order("orden")
    setLoading(false)
    setLoaded(true)
    if (!error) setPrendas((data as CatalogoPrenda[]) || [])
  }, [])

  useEffect(() => { load() }, [load])

  const nextOrden = (cat: string) => {
    const max = prendas.filter((p) => p.categoria === cat).reduce((m, p) => Math.max(m, p.orden), 0)
    return max + 1
  }

  const openNew = (cat: string) => {
    setEditingId(null)
    setForm({ ...DEFAULT_PRENDA_FORM, categoria: cat, orden: nextOrden(cat) })
    setModalOpen(true)
  }

  const openEdit = (p: CatalogoPrenda) => {
    setEditingId(p.id)
    setForm({
      nombre: p.nombre, categoria: p.categoria,
      genero: p.genero ?? "", mangas: p.mangas ?? "", medidas: p.medidas ?? "",
      orden: p.orden,
    })
    setModalOpen(true)
  }

  const toggleActivo = async (p: CatalogoPrenda) => {
    await supabase.schema("telas").from("catalogo_tipos_prenda").update({ activo: !p.activo }).eq("id", p.id)
    setPrendas((prev) => prev.map((x) => x.id === p.id ? { ...x, activo: !p.activo } : x))
    toast.success(p.activo ? "Desactivado" : "Activado")
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return }
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        genero: form.genero || null,
        mangas: form.mangas || null,
        medidas: form.medidas || null,
        orden: form.orden,
      }
      if (editingId) {
        const { error } = await supabase.schema("telas").from("catalogo_tipos_prenda").update(payload).eq("id", editingId)
        if (error) { toast.error("Error al actualizar", { description: error.message }); return }
        toast.success("Actualizado")
      } else {
        const { error } = await supabase.schema("telas").from("catalogo_tipos_prenda").insert(payload)
        if (error) { toast.error("Error al crear", { description: error.message }); return }
        toast.success("Prenda creada")
      }
      setModalOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const esPromocional = form.categoria === "Promocionales"

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Tabs value={catActiva} onValueChange={setCatActiva}>
        {/* Sub-tabs por categoría + botón Agregar */}
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-8">
            {CATEGORIAS_PRENDA.map((cat) => {
              const count = prendas.filter((p) => p.categoria === cat).length
              return (
                <TabsTrigger key={cat} value={cat} className="h-7 gap-1 text-xs">
                  {cat}
                  <span className="text-[10px] tabular-nums text-slate-400">({count})</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <Button onClick={() => openNew(catActiva)} size="sm" className="shrink-0 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="size-4" /> Agregar
          </Button>
        </div>

        {/* Tabla por categoría */}
        {CATEGORIAS_PRENDA.map((cat) => {
          const items = prendas.filter((p) => p.categoria === cat)
          const esPromo = cat === "Promocionales"
          return (
            <TabsContent key={cat} value={cat} className="mt-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                  <p className="text-sm">Sin referencias en {cat}</p>
                  <Button variant="outline" size="sm" onClick={() => openNew(cat)} className="gap-1.5">
                    <Plus className="size-3.5" /> Agregar
                  </Button>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Nombre</th>
                        {!esPromo && <th className="px-3 py-2 text-left font-medium">Género</th>}
                        {!esPromo && <th className="px-3 py-2 text-left font-medium">Mangas</th>}
                        {esPromo  && <th className="px-3 py-2 text-left font-medium">Medidas</th>}
                        <th className="px-3 py-2 text-center font-medium">Estado</th>
                        <th className="px-3 py-2 text-center font-medium">Acc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((p) => (
                        <tr key={p.id} className={cn("transition-colors hover:bg-slate-50", !p.activo && "opacity-40")}>
                          <td className="px-3 py-2 font-medium text-slate-700">{p.nombre}</td>
                          {!esPromo && (
                            <td className="px-3 py-2">
                              {p.genero ? (
                                <span className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  p.genero === "Caballero" && "bg-blue-50 text-blue-600",
                                  p.genero === "Dama"      && "bg-pink-50 text-pink-600",
                                  p.genero === "Niño"      && "bg-green-50 text-green-600",
                                )}>
                                  {p.genero}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          {!esPromo && (
                            <td className="px-3 py-2 text-slate-500">
                              {p.mangas ?? <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          {esPromo && (
                            <td className="px-3 py-2 text-slate-500">
                              {p.medidas ?? <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              p.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                            )}>
                              {p.activo ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}>
                                <Pencil className="size-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleActivo(p)}>
                                {p.activo ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Modal crear / editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar prenda" : "Agregar prenda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: BASICO"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v, orden: editingId ? f.orden : nextOrden(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PRENDA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!esPromocional && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">Género</Label>
                  <Select
                    value={form.genero || "_none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, genero: v === "_none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin especificar</SelectItem>
                      {GENEROS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Mangas</Label>
                  <Select
                    value={form.mangas || "_none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, mangas: v === "_none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin especificar</SelectItem>
                      {OPCIONES_MANGAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {esPromocional && (
              <div className="space-y-1.5">
                <Label className="text-sm">Medidas</Label>
                <Input
                  value={form.medidas}
                  onChange={(e) => setForm((f) => ({ ...f, medidas: e.target.value }))}
                  placeholder='Ej: 70X30"'
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

export function GDAdminCatalogo() {
  return (
    <Tabs defaultValue="prendas" className="space-y-4">
      <TabsList>
        <TabsTrigger value="prendas">Tipos de Prenda</TabsTrigger>
        <TabsTrigger value="colores">Colores</TabsTrigger>
        <TabsTrigger value="patrones">Patrones y Texturas</TabsTrigger>
      </TabsList>

      <TabsContent value="prendas">
        <CatalogoPrendas />
      </TabsContent>

      <TabsContent value="colores">
        <CatalogoColores />
      </TabsContent>

      <TabsContent value="patrones">
        <CatalogoPatrones />
      </TabsContent>
    </Tabs>
  )
}
