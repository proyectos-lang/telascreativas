"use client"

import { useState, useCallback } from "react"
import { Plus, Pencil, Eye, EyeOff, Loader2, X } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"
import { GDFileUploader } from "./gd-file-uploader"
import type { CatalogoSimbolo } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIAS = ["Textura", "Simbolo", "Patron", "Degradado", "Otro"]

interface SymbolFormData {
  nombre: string
  categoria: string
  imagen_url: string
  activo: boolean
  orden: number
}

const DEFAULT_FORM: SymbolFormData = {
  nombre: "",
  categoria: "",
  imagen_url: "",
  activo: true,
  orden: 0,
}

export function GDAdminCatalogo() {
  const [simbolos, setSimbolos] = useState<CatalogoSimbolo[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SymbolFormData>(DEFAULT_FORM)
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

  const openNew = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
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
    await supabase
      .schema("telas")
      .from("gd_catalogo_simbolos")
      .update({ activo: !s.activo })
      .eq("id", s.id)
    setSimbolos((prev) => prev.map((x) => (x.id === s.id ? { ...x, activo: !s.activo } : x)))
    toast.success(s.activo ? "Símbolo desactivado" : "Símbolo activado")
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    const imagenFinal = imagenUrls[0] ?? form.imagen_url
    if (!imagenFinal) {
      toast.error("Debes subir una imagen")
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, imagen_url: imagenFinal }
      if (editingId) {
        const { error } = await supabase
          .schema("telas")
          .from("gd_catalogo_simbolos")
          .update(payload)
          .eq("id", editingId)
        if (error) { toast.error("Error al actualizar", { description: error.message }); return }
        toast.success("Símbolo actualizado")
      } else {
        const { error } = await supabase
          .schema("telas")
          .from("gd_catalogo_simbolos")
          .insert(payload)
        if (error) { toast.error("Error al crear", { description: error.message }); return }
        toast.success("Símbolo creado")
      }
      setModalOpen(false)
      loadCatalogo()
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-slate-500">Catálogo de símbolos y texturas</p>
        <Button onClick={loadCatalogo} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {loading ? "Cargando..." : "Cargar catálogo"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{simbolos.length} símbolo{simbolos.length !== 1 ? "s" : ""} en el catálogo</p>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4" />
          Agregar símbolo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {simbolos.map((s) => (
          <div
            key={s.id}
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border p-3 transition-all",
              s.activo ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
            )}
          >
            <div className="overflow-hidden rounded-lg bg-slate-100 aspect-square">
              <img src={s.imagen_url} alt={s.nombre} className="h-full w-full object-cover" />
            </div>
            <p className="text-xs font-semibold text-slate-700 leading-tight">{s.nombre}</p>
            {s.categoria && (
              <Badge variant="secondary" className="text-[10px] px-1.5 w-fit">{s.categoria}</Badge>
            )}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openEdit(s)}
                title="Editar"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => toggleActivo(s)}
                title={s.activo ? "Desactivar" : "Activar"}
              >
                {s.activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar símbolo" : "Nuevo símbolo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Degradado Solar"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Orden de visualización</Label>
              <Input
                type="number"
                value={form.orden}
                onChange={(e) => setForm((f) => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
                className="w-24"
              />
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
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
