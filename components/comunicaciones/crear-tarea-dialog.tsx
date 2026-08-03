"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ClipboardList, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useComunicaciones, type CrearTareaInput } from "@/lib/comunicaciones-context"

export function CrearTareaDialog({
  open,
  onOpenChange,
  conversacionId,
  mensajeOrigenId,
  participantes,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  conversacionId: string
  mensajeOrigenId?: string | null
  participantes: { email: string; nombre: string }[]
}) {
  const { crearTarea } = useComunicaciones()
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [prioridad, setPrioridad] = useState("media")
  const [tipo, setTipo] = useState("confirmacion")
  const [fecha, setFecha] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) {
      setTitulo("")
      setDescripcion("")
      setPrioridad("media")
      setTipo("confirmacion")
      setFecha("")
      setSel(new Set())
    }
  }, [open])

  const toggle = (em: string) =>
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(em)) n.delete(em)
      else n.add(em)
      return n
    })

  const crear = async () => {
    if (!titulo.trim()) return toast.error("El título es obligatorio")
    if (sel.size === 0) return toast.error("Selecciona al menos un responsable")
    if (!fecha) return toast.error("La fecha de entrega es obligatoria")
    setGuardando(true)
    const input: CrearTareaInput = {
      conversacionId,
      mensajeOrigenId: mensajeOrigenId ?? null,
      titulo,
      descripcion,
      prioridad,
      tipoEntregable: tipo,
      fechaEntrega: fecha,
      responsables: Array.from(sel),
    }
    const r = await crearTarea(input)
    setGuardando(false)
    if (r.success) {
      toast.success("Tarea creada")
      onOpenChange(false)
    } else {
      toast.error("No se pudo crear la tarea", { description: r.error })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-indigo-500" /> Nueva tarea
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título *" />
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (qué debe hacerse)"
            rows={2}
            className="resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Prioridad
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Fecha de entrega *
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-0.5"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-500">
            Tipo de entregable
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="mt-0.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              <option value="confirmacion">Confirmación simple de ejecución</option>
              <option value="texto">Texto de respuesta</option>
              <option value="archivo">Archivo adjunto</option>
              <option value="imagen">Imagen</option>
            </select>
          </label>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Responsable(s) *</p>
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-slate-200 p-1">
              {participantes.map((p) => (
                <button
                  key={p.email}
                  onClick={() => toggle(p.email)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <input type="checkbox" checked={sel.has(p.email)} readOnly className="accent-indigo-600" />
                  <span className="truncate">{p.nombre}</span>
                </button>
              ))}
              {participantes.length === 0 && (
                <p className="px-2 py-2 text-center text-xs text-slate-400">
                  No hay otros participantes en esta conversación.
                </p>
              )}
            </div>
          </div>
          <Button onClick={() => void crear()} disabled={guardando} className="w-full">
            {guardando ? <Loader2 className="mr-1 size-4 animate-spin" /> : <ClipboardList className="mr-1 size-4" />}
            Crear tarea
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
