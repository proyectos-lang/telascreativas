"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  MessageSquarePlus,
  Search,
  Send,
  Check,
  CheckCheck,
  Link2,
  X,
  Reply,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useComunicaciones, type Mensaje } from "@/lib/comunicaciones-context"
import { useOrders } from "@/lib/orders-context"
import { useGD } from "@/lib/gestion-disenos-context"
import { useAppNavigation } from "@/lib/app-navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { UserAvatar } from "./user-avatar"

function horaCorta(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
}

export function ChatContent() {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()
  const {
    usuarios,
    conversaciones,
    mensajesPorConv,
    cargarMensajes,
    enviarMensaje,
    setActiva,
    abrirConversacionDirecta,
  } = useComunicaciones()

  const [activaId, setActivaId] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [buscar, setBuscar] = useState("")
  const [directorioOpen, setDirectorioOpen] = useState(false)
  const [reply, setReply] = useState<Mensaje | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const convActiva = conversaciones.find((c) => c.id === activaId) || null
  const mensajes = activaId ? mensajesPorConv[activaId] ?? [] : []

  const nombrePorEmail = useMemo(() => {
    const m = new Map<string, { nombre: string | null; foto: string | null }>()
    for (const u of usuarios) m.set(u.email, { nombre: u.nombre, foto: u.foto_url })
    return m
  }, [usuarios])

  // Para una conversación directa, el "otro" participante define nombre/foto.
  const otroDe = (convId: string) => {
    const c = conversaciones.find((x) => x.id === convId)
    if (!c) return null
    const otro = c.participantes.find((p) => p.usuario_email !== email)
    return otro?.usuario_email ?? null
  }

  const tituloConv = (convId: string): string => {
    const c = conversaciones.find((x) => x.id === convId)
    if (!c) return ""
    if (c.tipo === "grupo") return c.nombre || "Grupo"
    const o = otroDe(convId)
    return (o && nombrePorEmail.get(o)?.nombre) || o || "Conversación"
  }

  useEffect(() => {
    if (activaId) {
      setActiva(activaId)
      if (!mensajesPorConv[activaId]) void cargarMensajes(activaId)
    } else {
      setActiva(null)
    }
    return () => setActiva(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [mensajes.length, activaId])

  const enviar = async () => {
    const t = texto.trim()
    if (!t || !activaId) return
    setTexto("")
    await enviarMensaje(activaId, t, { reply_to: reply?.id ?? null })
    setReply(null)
  }

  const abrirConUsuario = async (otroEmail: string) => {
    setDirectorioOpen(false)
    const id = await abrirConversacionDirecta(otroEmail)
    if (id) setActivaId(id)
  }

  const convFiltradas = conversaciones.filter((c) => {
    if (!buscar.trim()) return true
    return tituloConv(c.id).toLowerCase().includes(buscar.trim().toLowerCase())
  })

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Lista de conversaciones */}
      <div className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm">
        <div className="space-y-2 p-3">
          <Button onClick={() => setDirectorioOpen(true)} className="w-full gap-2" size="sm">
            <MessageSquarePlus className="size-4" /> Nuevo chat
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar conversación..."
              className="h-8 bg-white pl-8 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2">
          {convFiltradas.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">
              Sin conversaciones. Empieza una con “Nuevo chat”.
            </p>
          ) : (
            convFiltradas.map((c) => {
              const o = c.tipo === "directa" ? otroDe(c.id) : null
              const info = o ? nombrePorEmail.get(o) : null
              return (
                <button
                  key={c.id}
                  onClick={() => setActivaId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                    activaId === c.id ? "bg-indigo-50" : "hover:bg-slate-50"
                  )}
                >
                  <UserAvatar nombre={info?.nombre ?? c.nombre} email={o ?? undefined} fotoUrl={info?.foto ?? c.foto_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {tituloConv(c.id)}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {horaCorta(c.ultimoMensajeAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs text-slate-500">
                        {c.ultimoMensaje || "—"}
                      </span>
                      {c.noLeidos > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                          {c.noLeidos > 99 ? "99+" : c.noLeidos}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Hilo */}
      <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm">
        {!convActiva ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <UserAvatar
                nombre={tituloConv(convActiva.id)}
                email={otroDe(convActiva.id) ?? undefined}
                fotoUrl={
                  (() => {
                    const o = otroDe(convActiva.id)
                    return (o && nombrePorEmail.get(o)?.foto) || convActiva.foto_url
                  })()
                }
              />
              <p className="text-sm font-semibold text-slate-800">{tituloConv(convActiva.id)}</p>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto px-4 py-3">
              {mensajes.map((m) => (
                <Burbuja
                  key={m.id}
                  mensaje={m}
                  esMio={m.remitente_email.toLowerCase() === email}
                  estado={estadoMensaje(m, convActiva, email)}
                  nombreRemitente={nombrePorEmail.get(m.remitente_email)?.nombre ?? m.remitente_email}
                  quoted={m.reply_to ? mensajes.find((x) => x.id === m.reply_to) ?? null : null}
                  onReply={() => setReply(m)}
                />
              ))}
            </div>

            {reply && (
              <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border-l-2 border-indigo-400 bg-slate-50 px-3 py-1.5 text-xs">
                <Reply className="mt-0.5 size-3 text-indigo-500" />
                <span className="min-w-0 flex-1 truncate text-slate-500">
                  Respondiendo: {resumenTexto(reply)}
                </span>
                <button onClick={() => setReply(null)}>
                  <X className="size-3 text-slate-400" />
                </button>
              </div>
            )}

            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void enviar()
                    }
                  }}
                  placeholder="Escribe un mensaje…"
                  rows={1}
                  className="max-h-32 min-h-[42px] resize-none bg-white"
                />
                <Button
                  onClick={() => void enviar()}
                  disabled={!texto.trim()}
                  size="icon"
                  className="size-[42px] shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Directorio */}
      <Dialog open={directorioOpen} onOpenChange={setDirectorioOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Directorio de usuarios</DialogTitle>
          </DialogHeader>
          <Directorio
            usuarios={usuarios.filter((u) => u.email !== email)}
            onPick={abrirConUsuario}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Directorio({
  usuarios,
  onPick,
}: {
  usuarios: { email: string; nombre: string | null; cargo: string | null; area: string | null; foto_url: string | null }[]
  onPick: (email: string) => void
}) {
  const [q, setQ] = useState("")
  const filtrados = usuarios.filter((u) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return (
      (u.nombre ?? "").toLowerCase().includes(t) ||
      (u.area ?? "").toLowerCase().includes(t)
    )
  })
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o área..."
          className="pl-8"
          autoFocus
        />
      </div>
      <div className="max-h-80 space-y-1 overflow-auto">
        {filtrados.map((u) => (
          <button
            key={u.email}
            onClick={() => onPick(u.email)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
          >
            <UserAvatar nombre={u.nombre} email={u.email} fotoUrl={u.foto_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{u.nombre || u.email}</p>
              <p className="truncate text-[11px] text-slate-400">
                {[u.cargo, u.area].filter(Boolean).join(" · ") || u.email}
              </p>
            </div>
          </button>
        ))}
        {filtrados.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-slate-400">Sin resultados.</p>
        )}
      </div>
    </div>
  )
}

function resumenTexto(m: Mensaje): string {
  if (m.tipo === "referencia") return `🔗 ${m.referencia_tipo} ${m.referencia_valor}`
  return m.contenido || ""
}

type EstadoMsg = "enviado" | "recibido" | "leido" | null

function estadoMensaje(
  m: Mensaje,
  conv: { participantes: { usuario_email: string; last_read_at: string | null; last_delivered_at: string | null }[] },
  yo: string
): EstadoMsg {
  if (m.remitente_email.toLowerCase() !== yo) return null
  const otros = conv.participantes.filter((p) => p.usuario_email !== yo)
  if (otros.length === 0) return "enviado"
  const t = new Date(m.created_at).getTime()
  const leidoTodos = otros.every(
    (p) => p.last_read_at && new Date(p.last_read_at).getTime() >= t
  )
  if (leidoTodos) return "leido"
  const recibidoTodos = otros.every(
    (p) => p.last_delivered_at && new Date(p.last_delivered_at).getTime() >= t
  )
  if (recibidoTodos) return "recibido"
  return "enviado"
}

function Burbuja({
  mensaje,
  esMio,
  estado,
  nombreRemitente,
  quoted,
  onReply,
}: {
  mensaje: Mensaje
  esMio: boolean
  estado: EstadoMsg
  nombreRemitente: string
  quoted: Mensaje | null
  onReply: () => void
}) {
  return (
    <div className={cn("group flex", esMio ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[78%] items-end gap-1">
        {!esMio && (
          <button
            onClick={onReply}
            title="Responder"
            className="mb-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Reply className="size-3.5 text-slate-300 hover:text-slate-500" />
          </button>
        )}
        <div
          className={cn(
            "rounded-2xl px-3 py-1.5 text-sm",
            esMio
              ? "rounded-br-sm bg-indigo-600 text-white"
              : "rounded-bl-sm bg-slate-100 text-slate-800"
          )}
        >
          {quoted && (
            <div
              className={cn(
                "mb-1 rounded border-l-2 px-2 py-0.5 text-[11px]",
                esMio ? "border-white/50 bg-white/10 text-white/80" : "border-indigo-300 bg-white text-slate-500"
              )}
            >
              {resumenTexto(quoted)}
            </div>
          )}
          {mensaje.tipo === "referencia" ? (
            <ReferenciaCard mensaje={mensaje} esMio={esMio} />
          ) : (
            <span className="whitespace-pre-wrap break-words">{mensaje.contenido}</span>
          )}
          <div
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
              esMio ? "text-white/70" : "text-slate-400"
            )}
          >
            <span>{horaCorta(mensaje.created_at)}</span>
            {esMio && estado === "leido" && <CheckCheck className="size-3 text-sky-200" />}
            {esMio && estado === "recibido" && <CheckCheck className="size-3" />}
            {esMio && estado === "enviado" && <Check className="size-3" />}
          </div>
        </div>
        {esMio && (
          <button
            onClick={onReply}
            title="Responder"
            className="mb-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Reply className="size-3.5 text-slate-300 hover:text-slate-500" />
          </button>
        )}
      </div>
    </div>
  )
}

function ReferenciaCard({ mensaje, esMio }: { mensaje: Mensaje; esMio: boolean }) {
  const { ordenes } = useOrders()
  const { solicitudes } = useGD()
  const { navigateTo } = useAppNavigation()

  const esPedido = mensaje.referencia_tipo === "pedido"
  const orden = esPedido ? ordenes.find((o) => o.pedido === mensaje.referencia_valor) : null
  const gestion = !esPedido
    ? solicitudes.find((s) => String(s.id) === mensaje.referencia_valor)
    : null

  const ver = () => {
    if (esPedido && mensaje.referencia_valor) {
      navigateTo("trazabilidad", { focusPedido: mensaje.referencia_valor })
    } else {
      navigateTo("gestion-disenos")
    }
  }

  const titulo = esPedido
    ? `Pedido ${mensaje.referencia_valor}`
    : `Gestión ${gestion?.numero ?? mensaje.referencia_valor}`
  const cliente = esPedido ? orden?.cliente : gestion?.cliente
  const estado = esPedido
    ? orden?.estado_produccion || orden?.estado_aprobado_rechazado
    : gestion?.estado

  return (
    <div
      className={cn(
        "min-w-[200px] rounded-lg border p-2",
        esMio ? "border-white/30 bg-white/10" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Link2 className={cn("size-3.5", esMio ? "text-white" : "text-indigo-500")} />
        <span className={cn("text-xs font-semibold", esMio ? "text-white" : "text-slate-800")}>
          {titulo}
        </span>
        {esPedido && orden?.es_urgente && (
          <AlertTriangle className="size-3 text-amber-400" />
        )}
      </div>
      {mensaje.contenido && (
        <p className={cn("mt-0.5 text-[11px]", esMio ? "text-white/80" : "text-slate-500")}>
          {mensaje.contenido}
        </p>
      )}
      <div className={cn("mt-1 text-[11px]", esMio ? "text-white/80" : "text-slate-600")}>
        {cliente && <div className="truncate">Cliente: {cliente}</div>}
        {estado && <div className="truncate">Estado: {estado}</div>}
      </div>
      <button
        onClick={ver}
        className={cn(
          "mt-1.5 flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
          esMio ? "bg-white/20 text-white hover:bg-white/30" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        )}
      >
        <ExternalLink className="size-3" /> Ver
      </button>
    </div>
  )
}
