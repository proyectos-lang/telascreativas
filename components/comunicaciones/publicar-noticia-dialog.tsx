"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Megaphone, Loader2, Paperclip, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useComunicaciones, type PublicarNoticiaInput } from "@/lib/comunicaciones-context"

export const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: "comunicado", label: "Comunicado oficial" },
  { valor: "novedad", label: "Novedad operativa" },
  { valor: "politica", label: "Política y normativa" },
  { valor: "urgente", label: "Aviso urgente" },
  { valor: "reconocimiento", label: "Reconocimiento" },
  { valor: "celebracion", label: "Celebración" },
]

export function PublicarNoticiaDialog({
  open,
  onOpenChange,
  onPublicada,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPublicada: () => void
}) {
  const { publicarNoticia, usuarios, conversaciones } = useComunicaciones()
  const [titulo, setTitulo] = useState("")
  const [cuerpo, setCuerpo] = useState("")
  const [categoria, setCategoria] = useState("comunicado")
  const [destacada, setDestacada] = useState(false)
  const [obligatoria, setObligatoria] = useState(false)
  const [reacciones, setReacciones] = useState(true)
  const [comentarios, setComentarios] = useState(true)
  const [publicarAt, setPublicarAt] = useState("")
  const [vigencia, setVigencia] = useState("")
  const [audiencia, setAudiencia] = useState<"org" | "areas" | "grupo">("org")
  const [areasSel, setAreasSel] = useState<Set<string>>(new Set())
  const [grupoSel, setGrupoSel] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)

  const areas = useMemo(
    () => Array.from(new Set(usuarios.map((u) => (u.area ?? "").trim()).filter(Boolean))).sort(),
    [usuarios]
  )
  const grupos = useMemo(
    () => conversaciones.filter((c) => c.tipo === "grupo"),
    [conversaciones]
  )

  useEffect(() => {
    if (!open) {
      setTitulo("")
      setCuerpo("")
      setCategoria("comunicado")
      setDestacada(false)
      setObligatoria(false)
      setReacciones(true)
      setComentarios(true)
      setPublicarAt("")
      setVigencia("")
      setAudiencia("org")
      setAreasSel(new Set())
      setGrupoSel("")
      setArchivos([])
    }
  }, [open])

  const publicar = async () => {
    if (!titulo.trim()) return toast.error("El título es obligatorio")
    let segmentos: { tipo: string; valor?: string | null }[] = []
    if (audiencia === "org") segmentos = [{ tipo: "org" }]
    else if (audiencia === "areas") {
      if (areasSel.size === 0) return toast.error("Selecciona al menos un área")
      segmentos = Array.from(areasSel).map((a) => ({ tipo: "area", valor: a }))
    } else {
      if (!grupoSel) return toast.error("Selecciona un grupo")
      segmentos = [{ tipo: "grupo", valor: grupoSel }]
    }
    setGuardando(true)
    const input: PublicarNoticiaInput = {
      titulo,
      cuerpo,
      categoria,
      destacada,
      obligatoria,
      reaccionesHabilitadas: reacciones,
      comentariosHabilitados: comentarios,
      publicarAt: publicarAt ? new Date(publicarAt).toISOString() : null,
      vigenciaHasta: vigencia ? new Date(vigencia + "T23:59:59").toISOString() : null,
      segmentos,
      archivos: archivos.length ? archivos : undefined,
    }
    const r = await publicarNoticia(input)
    setGuardando(false)
    if (r.success) {
      toast.success("Noticia publicada")
      onOpenChange(false)
      onPublicada()
    } else {
      toast.error("No se pudo publicar", { description: r.error })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-indigo-500" /> Publicar noticia
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[72vh] space-y-3 overflow-auto pr-1">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título *" />
          <Textarea
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Cuerpo del comunicado (admite formato Markdown: **negrita**, listas, etc.)"
            rows={5}
            className="resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Programar (opcional)
              <Input type="datetime-local" value={publicarAt} onChange={(e) => setPublicarAt(e.target.value)} className="mt-0.5" />
            </label>
          </div>

          {/* Audiencia */}
          <div className="rounded-lg border border-slate-200 p-2">
            <p className="mb-1 text-xs font-medium text-slate-500">Audiencia</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {(["org", "areas", "grupo"] as const).map((a) => (
                <label key={a} className="flex items-center gap-1">
                  <input type="radio" checked={audiencia === a} onChange={() => setAudiencia(a)} className="accent-indigo-600" />
                  {a === "org" ? "Toda la organización" : a === "areas" ? "Por áreas" : "Grupo específico"}
                </label>
              ))}
            </div>
            {audiencia === "areas" && (
              <div className="mt-2 flex flex-wrap gap-1">
                {areas.map((a) => (
                  <button
                    key={a}
                    onClick={() =>
                      setAreasSel((prev) => {
                        const n = new Set(prev)
                        if (n.has(a)) n.delete(a)
                        else n.add(a)
                        return n
                      })
                    }
                    className={
                      "rounded-full px-2 py-0.5 text-xs " +
                      (areasSel.has(a) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")
                    }
                  >
                    {a}
                  </button>
                ))}
                {areas.length === 0 && <span className="text-xs text-slate-400">No hay áreas.</span>}
              </div>
            )}
            {audiencia === "grupo" && (
              <select
                value={grupoSel}
                onChange={(e) => setGrupoSel(e.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">Selecciona un grupo…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre || "Grupo"}</option>
                ))}
              </select>
            )}
          </div>

          {/* Opciones */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={destacada} onChange={(e) => setDestacada(e.target.checked)} className="accent-indigo-600" />
              Destacada (fijar arriba)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={obligatoria} onChange={(e) => setObligatoria(e.target.checked)} className="accent-indigo-600" />
              Lectura obligatoria
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={reacciones} onChange={(e) => setReacciones(e.target.checked)} className="accent-indigo-600" />
              Reacciones
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={comentarios} onChange={(e) => setComentarios(e.target.checked)} className="accent-indigo-600" />
              Comentarios
            </label>
            <label className="col-span-2 text-xs text-slate-500">
              Vigencia hasta (opcional)
              <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className="mt-0.5" />
            </label>
          </div>

          {/* Adjuntos */}
          <div>
            <input
              id="noticia-files"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setArchivos((p) => [...p, ...Array.from(e.target.files!)])
                e.target.value = ""
              }}
            />
            <label htmlFor="noticia-files">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <span>
                  <Paperclip className="size-4" /> Adjuntar archivos
                </span>
              </Button>
            </label>
            {archivos.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {archivos.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {f.name}
                    <button onClick={() => setArchivos((p) => p.filter((_, idx) => idx !== i))}>
                      <X className="size-3 text-slate-400" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button onClick={() => void publicar()} disabled={guardando} className="w-full">
            {guardando ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Megaphone className="mr-1 size-4" />}
            Publicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
