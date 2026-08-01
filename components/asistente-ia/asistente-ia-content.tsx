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
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
}

const SUGERENCIAS = [
  "¿Qué pedidos están pendientes por reposición y de qué área?",
  "Dame los pedidos en riesgo crítico o vencidos para esta semana.",
  "Analiza la eficiencia por área con los lead times y dime dónde está el cuello de botella.",
  "¿Cuántas piezas hay por empacar hoy y de qué clientes?",
]

export function AsistenteIAContent() {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

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
  }, [cargarConversaciones])

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
        { rol: "assistant", contenido: json.respuesta, consultas: json.consultas },
      ])
      cargarConversaciones()
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
            mensajes.map((m, i) => <Burbuja key={i} mensaje={m} />)
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
    </div>
  )
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
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
      </div>
    </div>
  )
}
