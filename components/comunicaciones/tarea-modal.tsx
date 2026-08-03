"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ClipboardList,
  Loader2,
  Paperclip,
  Check,
  RotateCcw,
  Play,
  Download,
  CalendarDays,
  History,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  useComunicaciones,
  type Tarea,
  type TareaResponsable,
  type TareaEvento,
} from "@/lib/comunicaciones-context"

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  entregada: "Entregada",
  aceptada: "Aceptada",
  devuelta: "Devuelta",
  vencida: "Vencida",
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-600",
  en_proceso: "bg-blue-100 text-blue-700",
  entregada: "bg-amber-100 text-amber-700",
  aceptada: "bg-emerald-100 text-emerald-700",
  devuelta: "bg-rose-100 text-rose-700",
  vencida: "bg-rose-600 text-white",
}
const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "bg-rose-100 text-rose-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-slate-100 text-slate-600",
}

function estadoEfectivo(r: TareaResponsable, fechaEntrega: string | null): string {
  if (
    (r.estado === "pendiente" || r.estado === "en_proceso") &&
    fechaEntrega &&
    new Date(fechaEntrega).getTime() < new Date(new Date().toDateString()).getTime()
  )
    return "vencida"
  return r.estado
}

function fmt(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TareaModal({
  open,
  onOpenChange,
  tareaId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tareaId: string | null
}) {
  const { usuarioActual } = useAuth()
  const yo = (usuarioActual?.email ?? "").toLowerCase()
  const {
    usuarios,
    cargarTarea,
    iniciarTarea,
    entregarTarea,
    aceptarTarea,
    devolverTarea,
  } = useComunicaciones()

  const [tarea, setTarea] = useState<Tarea | null>(null)
  const [responsables, setResponsables] = useState<TareaResponsable[]>([])
  const [eventos, setEventos] = useState<TareaEvento[]>([])
  const [cargando, setCargando] = useState(false)
  const [entregarTexto, setEntregarTexto] = useState("")
  const [entregarArchivo, setEntregarArchivo] = useState<File | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [devolverPara, setDevolverPara] = useState<string | null>(null)
  const [devolverTexto, setDevolverTexto] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const nombreDe = (em: string) => usuarios.find((u) => u.email === em)?.nombre || em

  const recargar = useCallback(async () => {
    if (!tareaId) return
    setCargando(true)
    const d = await cargarTarea(tareaId)
    if (d) {
      setTarea(d.tarea)
      setResponsables(d.responsables)
      setEventos(d.eventos)
    }
    setCargando(false)
  }, [tareaId, cargarTarea])

  useEffect(() => {
    if (open && tareaId) {
      setEntregarTexto("")
      setEntregarArchivo(null)
      setDevolverPara(null)
      setDevolverTexto("")
      void recargar()
    }
  }, [open, tareaId, recargar])

  if (!tarea && !cargando) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" />
      </Dialog>
    )
  }

  const miRow = responsables.find((r) => r.usuario_email === yo)
  const soyCreador = tarea?.creado_por?.toLowerCase() === yo

  const hacer = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setTrabajando(true)
    const r = await fn()
    setTrabajando(false)
    if (r.success) await recargar()
    else toast.error("No se pudo completar", { description: r.error })
  }

  const entregar = async () => {
    if (!tarea) return
    if (tarea.tipo_entregable === "texto" && !entregarTexto.trim())
      return toast.error("Escribe la respuesta")
    if (
      (tarea.tipo_entregable === "archivo" || tarea.tipo_entregable === "imagen") &&
      !entregarArchivo
    )
      return toast.error("Adjunta el entregable")
    await hacer(() =>
      entregarTarea(tarea.id, {
        texto:
          tarea.tipo_entregable === "confirmacion"
            ? "Confirmado"
            : entregarTexto || undefined,
        archivo: entregarArchivo ?? undefined,
      })
    )
    setEntregarTexto("")
    setEntregarArchivo(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <ClipboardList className="size-5 shrink-0 text-indigo-500" />
            {tarea ? (
              <span className="truncate">
                Tarea #{tarea.consecutivo} — {tarea.titulo}
              </span>
            ) : (
              "Cargando…"
            )}
          </DialogTitle>
        </DialogHeader>

        {cargando || !tarea ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("rounded-full px-2 py-0.5 font-medium", PRIORIDAD_COLOR[tarea.prioridad] ?? "bg-slate-100")}>
                Prioridad {tarea.prioridad}
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <CalendarDays className="size-3.5" /> Entrega: {tarea.fecha_entrega ?? "—"}
              </span>
              <span className="text-slate-400">Entregable: {tarea.tipo_entregable}</span>
            </div>
            {tarea.descripcion && (
              <p className="whitespace-pre-wrap text-sm text-slate-600">{tarea.descripcion}</p>
            )}

            {/* Responsables */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Responsables ({responsables.length})
              </p>
              <div className="space-y-2">
                {responsables.map((r) => {
                  const est = estadoEfectivo(r, tarea.fecha_entrega)
                  return (
                    <div key={r.id} className="rounded-lg border border-slate-200 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">
                          {nombreDe(r.usuario_email)}
                          {r.usuario_email === yo && " (tú)"}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ESTADO_COLOR[est])}>
                          {ESTADO_LABEL[est]}
                        </span>
                      </div>

                      {/* Entregable */}
                      {(r.entregable_texto || r.entregable_url) && (
                        <div className="mt-1 rounded bg-slate-50 p-2 text-xs">
                          {r.entregable_texto && <p className="text-slate-600">{r.entregable_texto}</p>}
                          {r.entregable_url && (
                            r.entregable_nombre?.match(/\.(png|jpe?g|webp|gif)$/i) ? (
                              <a href={r.entregable_url} target="_blank" rel="noopener noreferrer">
                                <img src={r.entregable_url} alt="" className="mt-1 max-h-40 rounded" />
                              </a>
                            ) : (
                              <a
                                href={r.entregable_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-indigo-600 hover:underline"
                              >
                                <Download className="size-3" /> {r.entregable_nombre || "Descargar"}
                              </a>
                            )
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">Cargado: {fmt(r.fecha_entregable)}</p>
                        </div>
                      )}
                      {r.observaciones && r.estado === "devuelta" && (
                        <p className="mt-1 rounded bg-rose-50 p-1.5 text-xs text-rose-700">
                          Observaciones: {r.observaciones}
                        </p>
                      )}

                      {/* Acciones del creador para revisar */}
                      {soyCreador && r.estado === "entregada" && (
                        <div className="mt-2 space-y-1">
                          {devolverPara === r.usuario_email ? (
                            <div className="space-y-1">
                              <Textarea
                                value={devolverTexto}
                                onChange={(e) => setDevolverTexto(e.target.value)}
                                placeholder="Observaciones de la devolución…"
                                rows={2}
                                className="resize-none text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={trabajando || !devolverTexto.trim()}
                                  onClick={() =>
                                    hacer(() =>
                                      devolverTarea(tarea.id, r.usuario_email, devolverTexto)
                                    ).then(() => {
                                      setDevolverPara(null)
                                      setDevolverTexto("")
                                    })
                                  }
                                >
                                  Enviar devolución
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDevolverPara(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={trabajando}
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => hacer(() => aceptarTarea(tarea.id, r.usuario_email))}
                              >
                                <Check className="size-3.5" /> Aceptar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 border-rose-300 text-rose-600 hover:bg-rose-50"
                                onClick={() => setDevolverPara(r.usuario_email)}
                              >
                                <RotateCcw className="size-3.5" /> Devolver
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Acciones para el responsable (yo) */}
            {miRow &&
              (() => {
                const est = estadoEfectivo(miRow, tarea.fecha_entrega)
                if (est === "aceptada")
                  return <p className="text-sm text-emerald-600">Tu entregable fue aceptado ✔</p>
                if (est === "entregada")
                  return <p className="text-sm text-amber-600">Entregado. Esperando revisión…</p>
                return (
                  <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
                    <p className="text-xs font-semibold text-indigo-700">Tu acción</p>
                    {est === "pendiente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={trabajando}
                        onClick={() => hacer(() => iniciarTarea(tarea.id))}
                      >
                        <Play className="size-3.5" /> Marcar en proceso
                      </Button>
                    )}
                    {tarea.tipo_entregable === "texto" && (
                      <Textarea
                        value={entregarTexto}
                        onChange={(e) => setEntregarTexto(e.target.value)}
                        placeholder="Escribe tu respuesta…"
                        rows={2}
                        className="resize-none text-sm"
                      />
                    )}
                    {(tarea.tipo_entregable === "archivo" || tarea.tipo_entregable === "imagen") && (
                      <div>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()}>
                          <Paperclip className="size-3.5" />
                          {entregarArchivo ? entregarArchivo.name : "Adjuntar entregable"}
                        </Button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept={tarea.tipo_entregable === "imagen" ? "image/*" : undefined}
                          className="hidden"
                          onChange={(e) => setEntregarArchivo(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    )}
                    <Button size="sm" disabled={trabajando} onClick={() => void entregar()} className="gap-1">
                      {trabajando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      {tarea.tipo_entregable === "confirmacion" ? "Confirmar ejecución" : "Entregar"}
                    </Button>
                  </div>
                )
              })()}

            {/* Historial */}
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                <History className="size-3.5" /> Historial
              </p>
              <div className="space-y-1">
                {eventos.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 text-slate-400">{fmt(e.created_at)}</span>
                    <span className="text-slate-600">
                      <span className="font-medium">{nombreDe(e.usuario ?? "")}</span> — {e.detalle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
