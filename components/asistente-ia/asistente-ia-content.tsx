"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import ReactMarkdown from "react-markdown"
import {
  Sparkles,
  Send,
  Plus,
  Loader2,
  Database,
  Bot,
  MessageSquare,
  ChevronDown,
  Brain,
  Trash2,
  Forward,
  Search,
  UsersRound,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { useComunicaciones } from "@/lib/comunicaciones-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserAvatar } from "@/components/comunicaciones/user-avatar"
import { cn } from "@/lib/utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Conversacion {
  id: string
  titulo: string | null
  updated_at: string
}

interface Mensaje {
  rol: "user" | "assistant"
  contenido: string
  consultas?: string[]
  aprendizajes?: string[]
}

interface Conocimiento {
  id: string
  contenido: string
  categoria: string | null
}

const SUGERENCIAS = [
  "¿Qué procesos son los más eficientes y cuál es el cuello de botella?",
  "Muéstrame la curva de tallaje según las órdenes que se manejan.",
  "Curva de tallaje por tipo de tela y por producto.",
  "¿Qué pedidos están pendientes por reposición y de qué área?",
]

export function AsistenteIAContent() {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conocimiento, setConocimiento] = useState<Conocimiento[]>([])
  const [verConocimiento, setVerConocimiento] = useState(false)
  // Texto de una respuesta que se está compartiendo al módulo de chat.
  const [compartirTexto, setCompartirTexto] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  const cargarConocimiento = useCallback(async () => {
    const { data } = await supabase
      .schema("telas")
      .from("ia_conocimiento")
      .select("id, contenido, categoria")
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(300)
    setConocimiento((data ?? []) as Conocimiento[])
  }, [])

  const borrarConocimiento = async (id: string) => {
    await supabase
      .schema("telas")
      .from("ia_conocimiento")
      .update({ activo: false })
      .eq("id", id)
    setConocimiento((prev) => prev.filter((k) => k.id !== id))
  }

  const cargarConversaciones = useCallback(async () => {
    if (!email) return
    const { data } = await supabase
      .schema("telas")
      .from("ia_conversaciones")
      .select("id, titulo, updated_at")
      .eq("usuario_email", email)
      .order("updated_at", { ascending: false })
      .limit(50)
    setConversaciones((data ?? []) as Conversacion[])
  }, [email])

  useEffect(() => {
    cargarConversaciones()
    cargarConocimiento()
  }, [cargarConversaciones, cargarConocimiento])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [mensajes, loading])

  const nuevaConversacion = () => {
    setConversacionId(null)
    setMensajes([])
    setInput("")
  }

  const abrirConversacion = async (id: string) => {
    setConversacionId(id)
    const { data } = await supabase
      .schema("telas")
      .from("ia_mensajes")
      .select("rol, contenido")
      .eq("conversacion_id", id)
      .order("created_at", { ascending: true })
    setMensajes(
      (data ?? []).map((m) => ({
        rol: m.rol === "assistant" ? "assistant" : "user",
        contenido: m.contenido ?? "",
      })) as Mensaje[]
    )
  }

  const enviar = async (texto?: string) => {
    const mensaje = (texto ?? input).trim()
    if (!mensaje || loading) return
    setInput("")
    setMensajes((prev) => [...prev, { rol: "user", contenido: mensaje }])
    setLoading(true)
    try {
      const res = await fetch("/api/asistente-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId, mensaje, usuarioEmail: email }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || "Error del asistente")
      }
      setConversacionId(json.conversacionId)
      setMensajes((prev) => [
        ...prev,
        {
          rol: "assistant",
          contenido: json.respuesta,
          consultas: json.consultas,
          aprendizajes: json.aprendizajes,
        },
      ])
      // El servidor cae a un modelo de respaldo si el principal está saturado.
      if (json.modeloAlterno) {
        toast.info("Respondido con un modelo de respaldo", {
          description:
            "El modelo principal estaba saturado. La respuesta puede ser menos detallada.",
        })
      }
      cargarConversaciones()
      if (json.aprendizajes && json.aprendizajes.length) cargarConocimiento()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado"
      toast.error("El asistente no pudo responder", { description: msg })
      setMensajes((prev) => [
        ...prev,
        { rol: "assistant", contenido: `⚠️ ${msg}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Lista de conversaciones */}
      <div className="hidden w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm md:flex">
        <div className="p-3">
          <Button onClick={nuevaConversacion} className="w-full gap-2" size="sm">
            <Plus className="size-4" /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2">
          {conversaciones.length === 0 ? (
            <p className="px-2 py-4 text-xs text-slate-400">Aún no hay conversaciones.</p>
          ) : (
            conversaciones.map((c) => (
              <button
                key={c.id}
                onClick={() => abrirConversacion(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  conversacionId === c.id
                    ? "bg-indigo-50 text-indigo-800"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{c.titulo || "Conversación"}</span>
              </button>
            ))
          )}
        </div>

        {/* Memoria compartida (conocimiento del asistente) */}
        <div className="border-t border-slate-100">
          <button
            onClick={() => setVerConocimiento((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
            title="Lo que el asistente ha aprendido y aplica en todas las conversaciones"
          >
            <Brain className="size-4 text-icon-purple" />
            <span className="flex-1">Memoria del asistente</span>
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">
              {conocimiento.length}
            </span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", verConocimiento && "rotate-180")}
            />
          </button>
          {verConocimiento && (
            <div className="max-h-56 space-y-1 overflow-auto px-2 pb-2">
              {conocimiento.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-slate-400">
                  Aún no ha aprendido nada. Enséñale reglas o dile “recuerda…”.
                </p>
              ) : (
                conocimiento.map((k) => (
                  <div
                    key={k.id}
                    className="group flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      {k.categoria && (
                        <span className="mr-1 rounded bg-indigo-100 px-1 text-[9px] uppercase text-indigo-600">
                          {k.categoria}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-600">{k.contenido}</span>
                    </div>
                    <button
                      onClick={() => borrarConocimiento(k.id)}
                      title="Olvidar este aprendizaje"
                      className="shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Sparkles className="size-5 text-icon-purple" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Asistente IA</p>
            <p className="text-[11px] text-slate-400">
              Analista de producción — consulta datos en tiempo real (solo lectura)
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto px-4 py-4">
          {mensajes.length === 0 && !loading ? (
            <div className="mx-auto max-w-2xl py-8 text-center">
              <Sparkles className="mx-auto mb-3 size-8 text-icon-purple" />
              <p className="text-sm font-medium text-slate-700">
                Pregúntame sobre la producción
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Puedo consultar los pedidos, estados y tiempos, y ayudarte a analizar la operación.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            mensajes.map((m, i) => (
              <Burbuja
                key={i}
                mensaje={m}
                onCompartir={() => setCompartirTexto(m.contenido)}
              />
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                <Bot className="size-4 text-indigo-600" />
              </div>
              <Loader2 className="size-4 animate-spin" />
              <span>Analizando…</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
              rows={1}
              className="max-h-40 min-h-[42px] resize-none bg-white"
              disabled={loading}
            />
            <Button
              onClick={() => enviar()}
              disabled={loading || !input.trim()}
              size="icon"
              className="size-[42px] shrink-0"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Compartir una respuesta al módulo de chat */}
      <EnviarAlChatDialog
        texto={compartirTexto}
        onOpenChange={(v) => {
          if (!v) setCompartirTexto(null)
        }}
      />
    </div>
  )
}

/**
 * Diálogo para reenviar el contenido de una respuesta del asistente a una
 * conversación del módulo de chat (grupo existente o persona del directorio).
 * Se envía como mensaje de texto, prefijado para identificar su origen.
 */
function EnviarAlChatDialog({
  texto,
  onOpenChange,
}: {
  texto: string | null
  onOpenChange: (v: boolean) => void
}) {
  const { usuarioActual } = useAuth()
  const miEmail = (usuarioActual?.email ?? "").toLowerCase()
  const { usuarios, conversaciones, abrirConversacionDirecta, enviarMensaje } =
    useComunicaciones()
  const [q, setQ] = useState("")
  const [enviando, setEnviando] = useState(false)

  const term = q.trim().toLowerCase()
  const grupos = conversaciones
    .filter((c) => c.tipo === "grupo")
    .filter((c) => !term || (c.nombre ?? "").toLowerCase().includes(term))
  const personas = usuarios
    .filter((u) => u.email !== miEmail)
    .filter(
      (u) =>
        !term ||
        (u.nombre ?? "").toLowerCase().includes(term) ||
        (u.area ?? "").toLowerCase().includes(term)
    )

  const enviarA = async (convId: string, destino: string) => {
    if (!texto) return
    setEnviando(true)
    const cuerpo = `🤖 Asistente IA:\n\n${texto}`
    const r = await enviarMensaje(convId, cuerpo)
    setEnviando(false)
    if (r.success) {
      toast.success(`Enviado a ${destino}`)
      onOpenChange(false)
      setQ("")
    } else {
      toast.error("No se pudo enviar", { description: r.error })
    }
  }

  const enviarAPersona = async (email: string, nombre: string) => {
    const id = await abrirConversacionDirecta(email)
    if (!id) {
      toast.error("No se pudo abrir la conversación")
      return
    }
    await enviarA(id, nombre)
  }

  return (
    <Dialog open={texto !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar respuesta al chat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {texto && (
            <div className="max-h-24 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {texto.length > 240 ? `${texto.slice(0, 240)}…` : texto}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar grupo o persona…"
              className="pl-8"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-auto">
            {grupos.length > 0 && (
              <p className="px-2 pt-1 text-[11px] font-medium uppercase text-slate-400">
                Grupos
              </p>
            )}
            {grupos.map((c) => (
              <button
                key={c.id}
                disabled={enviando}
                onClick={() => void enviarA(c.id, c.nombre || "el grupo")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <UsersRound className="size-4 text-indigo-600" />
                </div>
                <span className="truncate text-sm font-medium text-slate-800">
                  {c.nombre || "Grupo"}
                </span>
              </button>
            ))}
            {personas.length > 0 && (
              <p className="px-2 pt-2 text-[11px] font-medium uppercase text-slate-400">
                Personas
              </p>
            )}
            {personas.map((u) => (
              <button
                key={u.email}
                disabled={enviando}
                onClick={() => void enviarAPersona(u.email, u.nombre || u.email)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
              >
                <UserAvatar nombre={u.nombre} email={u.email} fotoUrl={u.foto_url} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {u.nombre || u.email}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {[u.cargo, u.area].filter(Boolean).join(" · ") || u.email}
                  </p>
                </div>
              </button>
            ))}
            {grupos.length === 0 && personas.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-slate-400">
                Sin resultados.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Burbuja({
  mensaje,
  onCompartir,
}: {
  mensaje: Mensaje
  onCompartir: () => void
}) {
  const [verSQL, setVerSQL] = useState(false)
  if (mensaje.rol === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white whitespace-pre-wrap">
          {mensaje.contenido}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <Bot className="size-4 text-indigo-600" />
      </div>
      <div className="max-w-[85%] space-y-2">
        <div className="markdown-chat rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-2 text-sm text-slate-800">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-slate-200 bg-slate-100 px-2 py-1 text-left font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-200 px-2 py-1">{children}</td>
              ),
              code: ({ children }) => (
                <code className="rounded bg-slate-200 px-1 py-0.5 text-[0.85em]">{children}</code>
              ),
              h1: ({ children }) => <h3 className="mt-2 mb-1 font-semibold">{children}</h3>,
              h2: ({ children }) => <h3 className="mt-2 mb-1 font-semibold">{children}</h3>,
              h3: ({ children }) => <h4 className="mt-2 mb-1 font-semibold">{children}</h4>,
            }}
          >
            {mensaje.contenido}
          </ReactMarkdown>
        </div>
        <button
          onClick={onCompartir}
          title="Enviar esta respuesta a un chat"
          className="flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-indigo-600"
        >
          <Forward className="size-3" />
          Enviar al chat
        </button>
        {mensaje.consultas && mensaje.consultas.length > 0 && (
          <div className="text-xs">
            <button
              onClick={() => setVerSQL((v) => !v)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600"
            >
              <Database className="size-3" />
              {mensaje.consultas.length} consulta
              {mensaje.consultas.length !== 1 ? "s" : ""} ejecutada
              {mensaje.consultas.length !== 1 ? "s" : ""}
              <ChevronDown
                className={cn("size-3 transition-transform", verSQL && "rotate-180")}
              />
            </button>
            {verSQL && (
              <div className="mt-1 space-y-1">
                {mensaje.consultas.map((q, i) => (
                  <pre
                    key={i}
                    className="overflow-x-auto rounded bg-slate-800 px-2 py-1.5 text-[11px] text-slate-100"
                  >
                    {q}
                  </pre>
                ))}
              </div>
            )}
          </div>
        )}
        {mensaje.aprendizajes && mensaje.aprendizajes.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-1.5 text-[11px] text-indigo-700">
            <Brain className="mt-0.5 size-3 shrink-0" />
            <div>
              <span className="font-medium">
                Aprendí {mensaje.aprendizajes.length} cosa
                {mensaje.aprendizajes.length !== 1 ? "s" : ""} para futuras conversaciones:
              </span>
              <ul className="mt-0.5 list-disc pl-4">
                {mensaje.aprendizajes.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
