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
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Images,
  Loader2,
  Users,
  UsersRound,
  UserPlus,
  Trash2,
  LogOut,
  Filter,
  Globe,
  ClipboardList,
  Smile,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  useComunicaciones,
  type Mensaje,
  type Adjunto,
  type Conversacion,
  type DirectorioUsuario,
} from "@/lib/comunicaciones-context"
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
import { CrearTareaDialog } from "./crear-tarea-dialog"
import { TareaModal } from "./tarea-modal"

function horaCorta(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
}

// Emojis frecuentes para el selector del chat.
const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤩", "🥳", "🤔", "😐", "😴", "😢", "😭", "😅",
  "😳", "😱", "😡", "🥺", "🙄", "😉", "😇", "🤗",
  "👍", "👎", "👌", "🙌", "👏", "🙏", "💪", "🤝",
  "👋", "✌️", "🤞", "🫶", "❤️", "🧡", "💛", "💚",
  "💙", "💜", "🔥", "✨", "⭐", "🎉", "🎊", "✅",
  "❌", "⚠️", "❓", "❗", "💯", "👀", "💡", "📌",
  "📎", "📅", "⏰", "🚀", "☕", "🧵", "🪡", "👕",
]

export function ChatContent() {
  const { usuarioActual } = useAuth()
  const email = (usuarioActual?.email ?? "").toLowerCase()
  const {
    usuarios,
    conversaciones,
    mensajesPorConv,
    cargarMensajes,
    cargarAdjuntosConversacion,
    enviarMensaje,
    setActiva,
    abrirConversacionDirecta,
    crearGrupo,
    agregarParticipantes,
    quitarParticipante,
    renombrarGrupo,
    eliminarGrupo,
    salirGrupo,
    buscarGlobal,
    conversacionPendiente,
    limpiarPendiente,
  } = useComunicaciones()

  const [activaId, setActivaId] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [buscar, setBuscar] = useState("")
  const [directorioOpen, setDirectorioOpen] = useState(false)
  const [crearGrupoOpen, setCrearGrupoOpen] = useState(false)
  const [grupoInfoOpen, setGrupoInfoOpen] = useState(false)
  const [reply, setReply] = useState<Mensaje | null>(null)
  const [archivos, setArchivos] = useState<File[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [globalOpen, setGlobalOpen] = useState(false)
  // Búsqueda dentro de la conversación (client-side sobre los mensajes cargados).
  const [buscarOpen, setBuscarOpen] = useState(false)
  const [bTexto, setBTexto] = useState("")
  const [bDesde, setBDesde] = useState("")
  const [bHasta, setBHasta] = useState("")
  const [bParticipante, setBParticipante] = useState("")
  const [bTipo, setBTipo] = useState("")
  const [jumpId, setJumpId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [crearTareaOpen, setCrearTareaOpen] = useState(false)
  const [enlazarOpen, setEnlazarOpen] = useState(false)
  const [mensajeOrigenTarea, setMensajeOrigenTarea] = useState<string | null>(null)
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
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

  // Al cambiar de conversación, resetear la búsqueda interna.
  useEffect(() => {
    setBuscarOpen(false)
    setBTexto("")
    setBDesde("")
    setBHasta("")
    setBParticipante("")
    setBTipo("")
  }, [activaId])

  // Abrir una conversación solicitada desde otra vista (p. ej. "Ver conversación" de una tarea).
  useEffect(() => {
    if (!conversacionPendiente) return
    if (conversaciones.some((c) => c.id === conversacionPendiente)) {
      setActivaId(conversacionPendiente)
      limpiarPendiente()
    }
  }, [conversacionPendiente, conversaciones, limpiarPendiente])

  // Salto + resaltado del mensaje encontrado (reintenta cuando el hilo carga).
  useEffect(() => {
    if (!jumpId) return
    const el = document.getElementById(`msg-${jumpId}`)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
    setHighlightId(jumpId)
    setJumpId(null)
    const t = setTimeout(() => setHighlightId(null), 1600)
    return () => clearTimeout(t)
  }, [jumpId, mensajes])

  // Resultados de la búsqueda dentro de la conversación (client-side).
  const resultadosLocales = useMemo(() => {
    if (!buscarOpen) return []
    const activo = bTexto.trim() || bDesde || bHasta || bParticipante || bTipo
    if (!activo) return []
    const tx = bTexto.trim().toLowerCase()
    const desdeT = bDesde ? new Date(bDesde).getTime() : null
    const hastaT = bHasta ? new Date(bHasta + "T23:59:59").getTime() : null
    return mensajes.filter((m) => {
      if (m.tipo === "evento") return false
      if (tx) {
        const enTexto = (m.contenido || "").toLowerCase().includes(tx)
        const enAdj = (m.adjuntos || []).some((a) =>
          (a.nombre || "").toLowerCase().includes(tx)
        )
        if (!enTexto && !enAdj) return false
      }
      const t = new Date(m.created_at).getTime()
      if (desdeT && t < desdeT) return false
      if (hastaT && t > hastaT) return false
      if (bParticipante && m.remitente_email.toLowerCase() !== bParticipante) return false
      if (bTipo) {
        if (bTipo === "texto" && !(m.tipo === "texto" || m.tipo === "referencia")) return false
        if (bTipo === "imagen" && m.tipo !== "imagen") return false
        if (bTipo === "archivo" && m.tipo !== "archivo") return false
        if (bTipo === "tarea" && m.tipo !== "tarea") return false
      }
      return true
    })
  }, [buscarOpen, bTexto, bDesde, bHasta, bParticipante, bTipo, mensajes])

  const enviar = async () => {
    const t = texto.trim()
    if ((!t && archivos.length === 0) || !activaId || subiendo) return
    const files = archivos
    setTexto("")
    setArchivos([])
    setSubiendo(true)
    const r = await enviarMensaje(activaId, t, {
      reply_to: reply?.id ?? null,
      archivos: files.length ? files : undefined,
    })
    setSubiendo(false)
    if (!r.success) {
      toast.error("No se pudo enviar", { description: r.error })
      setArchivos(files) // restaura para reintentar
    } else {
      setReply(null)
    }
  }

  const onPickFiles = (list: FileList | null) => {
    if (!list) return
    setArchivos((prev) => [...prev, ...Array.from(list)])
  }

  // Inserta un emoji en la posición del cursor del textarea (o al final) y
  // restaura el foco/caret justo después del emoji.
  const insertarEmoji = (emoji: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? texto.length
    const end = el?.selectionEnd ?? texto.length
    const nuevo = texto.slice(0, start) + emoji + texto.slice(end)
    setTexto(nuevo)
    requestAnimationFrame(() => {
      if (el) {
        const pos = start + emoji.length
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    })
  }

  // Pegar imágenes desde el portapapeles (p. ej. un pantallazo con Ctrl+V).
  // Extrae los items de tipo imagen del clipboard y los agrega como adjuntos
  // pendientes, igual que si se hubieran seleccionado con el botón de imagen.
  const onPasteInput = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imgs: File[] = []
    for (const it of Array.from(items)) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const blob = it.getAsFile()
        if (!blob) continue
        // Los pantallazos suelen llegar sin nombre o como "image.png".
        const ext = (blob.type.split("/")[1] || "png").split("+")[0]
        const name =
          blob.name && blob.name.toLowerCase() !== "image.png"
            ? blob.name
            : `pantallazo_${Date.now()}.${ext}`
        imgs.push(new File([blob], name, { type: blob.type }))
      }
    }
    if (imgs.length > 0) {
      // Evita que además se pegue texto/binario en el input.
      e.preventDefault()
      setArchivos((prev) => [...prev, ...imgs])
      toast.success(
        imgs.length === 1 ? "Imagen pegada" : `${imgs.length} imágenes pegadas`
      )
    }
  }

  const abrirDesdeGlobal = (convId: string, mid: string) => {
    setGlobalOpen(false)
    setActivaId(convId)
    setJumpId(mid)
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
          <div className="flex gap-2">
            <Button
              onClick={() => setDirectorioOpen(true)}
              className="flex-1 gap-1.5"
              size="sm"
            >
              <MessageSquarePlus className="size-4" /> Chat
            </Button>
            <Button
              onClick={() => setCrearGrupoOpen(true)}
              variant="outline"
              className="flex-1 gap-1.5"
              size="sm"
            >
              <UsersRound className="size-4" /> Grupo
            </Button>
          </div>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar conversación..."
                className="h-8 bg-white pl-8 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              title="Buscar en todas las conversaciones"
              onClick={() => setGlobalOpen(true)}
            >
              <Globe className="size-4" />
            </Button>
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
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
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
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {tituloConv(convActiva.id)}
                  </p>
                  {convActiva.tipo === "grupo" && (
                    <p className="text-[11px] text-slate-400">
                      {convActiva.participantes.filter((p) => !p.left_at).length} participantes
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setMensajeOrigenTarea(null)
                    setCrearTareaOpen(true)
                  }}
                  title="Crear tarea"
                >
                  <ClipboardList className="size-4" />
                  Tarea
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setEnlazarOpen(true)}
                  title="Enlazar un pedido o una gestión de diseño"
                >
                  <Link2 className="size-4" />
                  Enlazar
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => setBuscarOpen((v) => !v)}
                  title="Buscar en esta conversación"
                >
                  <Search className="size-4" />
                </Button>
                {convActiva.tipo === "grupo" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGrupoInfoOpen(true)}
                    className="gap-1.5"
                    title="Información del grupo"
                  >
                    <Users className="size-4" />
                    Grupo
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConsolidadoOpen(true)}
                  className="gap-1.5"
                  title="Ver archivos e imágenes compartidos"
                >
                  <Images className="size-4" />
                  Archivos
                </Button>
              </div>
            </div>

            {buscarOpen && (
              <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[150px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={bTexto}
                      onChange={(e) => setBTexto(e.target.value)}
                      placeholder="Buscar en la conversación…"
                      className="h-8 bg-white pl-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <input
                    type="date"
                    value={bDesde}
                    onChange={(e) => setBDesde(e.target.value)}
                    title="Desde"
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  />
                  <input
                    type="date"
                    value={bHasta}
                    onChange={(e) => setBHasta(e.target.value)}
                    title="Hasta"
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  />
                  {convActiva.tipo === "grupo" && (
                    <select
                      value={bParticipante}
                      onChange={(e) => setBParticipante(e.target.value)}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
                      title="Participante"
                    >
                      <option value="">Todos</option>
                      {convActiva.participantes
                        .filter((p) => !p.left_at)
                        .map((p) => (
                          <option key={p.usuario_email} value={p.usuario_email}>
                            {nombrePorEmail.get(p.usuario_email)?.nombre ?? p.usuario_email}
                          </option>
                        ))}
                    </select>
                  )}
                  <select
                    value={bTipo}
                    onChange={(e) => setBTipo(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
                    title="Tipo de contenido"
                  >
                    <option value="">Todo</option>
                    <option value="texto">Mensajes</option>
                    <option value="imagen">Imágenes</option>
                    <option value="archivo">Archivos</option>
                    <option value="tarea">Tareas</option>
                  </select>
                  <button
                    onClick={() => setBuscarOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Cerrar búsqueda"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {resultadosLocales.length > 0 ? (
                  <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white">
                    <p className="px-2 py-1 text-[11px] text-slate-400">
                      {resultadosLocales.length} resultado
                      {resultadosLocales.length !== 1 ? "s" : ""}
                    </p>
                    {resultadosLocales.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setJumpId(m.id)}
                        className="flex w-full items-center gap-2 border-t border-slate-50 px-2 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                          <span className="font-medium text-slate-500">
                            {nombrePorEmail.get(m.remitente_email)?.nombre ?? m.remitente_email}:
                          </span>{" "}
                          {resumenBusqueda(m)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : bTexto || bDesde || bHasta || bParticipante || bTipo ? (
                  <p className="px-1 text-xs text-slate-400">Sin resultados.</p>
                ) : null}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto px-4 py-3">
              {mensajes.map((m) =>
                m.tipo === "evento" ? (
                  <div key={m.id} className="flex justify-center py-0.5">
                    <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[11px] text-slate-500">
                      {m.contenido}
                    </span>
                  </div>
                ) : m.tipo === "tarea" ? (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={cn(
                      "flex",
                      m.remitente_email.toLowerCase() === email ? "justify-end" : "justify-start"
                    )}
                  >
                    <button
                      onClick={() => m.referencia_valor && setTareaAbiertaId(m.referencia_valor)}
                      className="flex max-w-[80%] items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-left hover:bg-indigo-100"
                    >
                      <ClipboardList className="size-4 shrink-0 text-indigo-600" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-indigo-500">Tarea</p>
                        <p className="truncate text-sm text-slate-800">{m.contenido}</p>
                        <p className="text-[11px] text-indigo-500 underline">Abrir tarea</p>
                      </div>
                    </button>
                  </div>
                ) : (
                  <Burbuja
                    key={m.id}
                    mensaje={m}
                    esMio={m.remitente_email.toLowerCase() === email}
                    esGrupo={convActiva.tipo === "grupo"}
                    estado={estadoMensaje(m, convActiva, email)}
                    highlight={highlightId === m.id}
                    nombreRemitente={
                      nombrePorEmail.get(m.remitente_email)?.nombre ?? m.remitente_email
                    }
                    quoted={m.reply_to ? mensajes.find((x) => x.id === m.reply_to) ?? null : null}
                    onReply={() => setReply(m)}
                    onCrearTarea={() => {
                      setMensajeOrigenTarea(m.id)
                      setCrearTareaOpen(true)
                    }}
                  />
                )
              )}
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
              {archivos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {archivos.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    >
                      {f.type.startsWith("image/") ? (
                        <ImageIcon className="size-3.5 text-indigo-500" />
                      ) : (
                        <FileText className="size-3.5 text-slate-500" />
                      )}
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <button
                        onClick={() => setArchivos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-[42px] text-slate-500"
                    title="Adjuntar archivo"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-[42px] text-slate-500"
                    title="Adjuntar imagen / cámara"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    <ImageIcon className="size-4" />
                  </Button>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-[42px] text-slate-500"
                      title="Emojis"
                      onClick={() => setEmojiOpen((v) => !v)}
                    >
                      <Smile className="size-4" />
                    </Button>
                    {emojiOpen && (
                      <>
                        {/* Capa para cerrar al hacer clic fuera */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setEmojiOpen(false)}
                        />
                        <div className="absolute bottom-[46px] left-0 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          <div className="grid grid-cols-8 gap-0.5">
                            {EMOJIS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => insertarEmoji(e)}
                                className="flex size-7 items-center justify-center rounded text-lg hover:bg-slate-100"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onPaste={onPasteInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void enviar()
                    }
                  }}
                  placeholder="Escribe un mensaje… (puedes pegar una imagen con Ctrl+V)"
                  rows={1}
                  className="max-h-32 min-h-[42px] resize-none bg-white"
                />
                <Button
                  onClick={() => void enviar()}
                  disabled={subiendo || (!texto.trim() && archivos.length === 0)}
                  size="icon"
                  className="size-[42px] shrink-0"
                >
                  {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <input
                ref={imgInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Archivos e imágenes de la conversación (vista consolidada) */}
      {convActiva && (
        <ConsolidadoDialog
          open={consolidadoOpen}
          onOpenChange={setConsolidadoOpen}
          conversacionId={convActiva.id}
          cargar={cargarAdjuntosConversacion}
        />
      )}

      {/* Enlazar un pedido o una gestión de diseño a la conversación */}
      {convActiva && (
        <EnlazarReferenciaDialog
          open={enlazarOpen}
          onOpenChange={setEnlazarOpen}
          conversacionId={convActiva.id}
        />
      )}

      {/* Crear tarea */}
      {convActiva && (
        <CrearTareaDialog
          open={crearTareaOpen}
          onOpenChange={setCrearTareaOpen}
          conversacionId={convActiva.id}
          mensajeOrigenId={mensajeOrigenTarea}
          participantes={convActiva.participantes
            .filter((p) => !p.left_at && p.usuario_email !== email)
            .map((p) => ({
              email: p.usuario_email,
              nombre: nombrePorEmail.get(p.usuario_email)?.nombre ?? p.usuario_email,
            }))}
        />
      )}

      {/* Modal de tarea */}
      <TareaModal
        open={!!tareaAbiertaId}
        onOpenChange={(v) => !v && setTareaAbiertaId(null)}
        tareaId={tareaAbiertaId}
      />

      {/* Búsqueda global */}
      <BusquedaGlobalDialog
        open={globalOpen}
        onOpenChange={setGlobalOpen}
        buscar={buscarGlobal}
        tituloConv={tituloConv}
        nombrePorEmail={nombrePorEmail}
        onAbrir={abrirDesdeGlobal}
      />

      {/* Crear grupo */}
      <CrearGrupoDialog
        open={crearGrupoOpen}
        onOpenChange={setCrearGrupoOpen}
        usuarios={usuarios.filter((u) => u.email !== email)}
        onCrear={crearGrupo}
        onCreado={(id) => setActivaId(id)}
      />

      {/* Info / administración del grupo */}
      {convActiva && convActiva.tipo === "grupo" && (
        <GrupoInfoDialog
          open={grupoInfoOpen}
          onOpenChange={setGrupoInfoOpen}
          conv={convActiva}
          miEmail={email}
          usuarios={usuarios}
          onAgregar={agregarParticipantes}
          onQuitar={quitarParticipante}
          onRenombrar={renombrarGrupo}
          onEliminar={async () => {
            const r = await eliminarGrupo(convActiva.id)
            if (r.success) {
              setGrupoInfoOpen(false)
              setActivaId(null)
            }
            return r
          }}
          onSalir={async () => {
            const r = await salirGrupo(convActiva.id)
            if (r.success) {
              setGrupoInfoOpen(false)
              setActivaId(null)
            }
            return r
          }}
        />
      )}

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

function resumenBusqueda(m: Mensaje): string {
  if (m.tipo === "imagen") return m.contenido || "📷 Imagen"
  if (m.tipo === "archivo") return m.adjuntos?.[0]?.nombre || m.contenido || "📎 Archivo"
  if (m.tipo === "referencia") return `🔗 ${m.referencia_tipo} ${m.referencia_valor}`
  return m.contenido || ""
}

type EstadoMsg = "enviado" | "recibido" | "leido" | null

function estadoMensaje(
  m: Mensaje,
  conv: {
    participantes: {
      usuario_email: string
      last_read_at: string | null
      last_delivered_at: string | null
      left_at?: string | null
    }[]
  },
  yo: string
): EstadoMsg {
  if (m.remitente_email.toLowerCase() !== yo) return null
  const otros = conv.participantes.filter((p) => p.usuario_email !== yo && !p.left_at)
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
  esGrupo,
  estado,
  highlight,
  nombreRemitente,
  quoted,
  onReply,
  onCrearTarea,
}: {
  mensaje: Mensaje
  esMio: boolean
  esGrupo?: boolean
  estado: EstadoMsg
  highlight?: boolean
  nombreRemitente: string
  quoted: Mensaje | null
  onReply: () => void
  onCrearTarea: () => void
}) {
  return (
    <div
      id={`msg-${mensaje.id}`}
      className={cn(
        "group flex flex-col rounded-xl transition-colors",
        esMio ? "items-end" : "items-start",
        highlight && "bg-amber-100/70 ring-2 ring-amber-300"
      )}
    >
      {esGrupo && !esMio && (
        <span className="mb-0.5 ml-8 text-[11px] font-medium text-indigo-500">
          {nombreRemitente}
        </span>
      )}
      <div className="flex max-w-[78%] items-end gap-1">
        {!esMio && (
          <div className="mb-1 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={onReply} title="Responder">
              <Reply className="size-3.5 text-slate-300 hover:text-slate-500" />
            </button>
            <button onClick={onCrearTarea} title="Crear tarea desde este mensaje">
              <ClipboardList className="size-3.5 text-slate-300 hover:text-indigo-500" />
            </button>
          </div>
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
            <>
              {mensaje.adjuntos && mensaje.adjuntos.length > 0 && (
                <AdjuntosView adjuntos={mensaje.adjuntos} esMio={esMio} />
              )}
              {mensaje.contenido && (
                <span className="whitespace-pre-wrap break-words">{mensaje.contenido}</span>
              )}
            </>
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
          <div className="mb-1 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={onReply} title="Responder">
              <Reply className="size-3.5 text-slate-300 hover:text-slate-500" />
            </button>
            <button onClick={onCrearTarea} title="Crear tarea desde este mensaje">
              <ClipboardList className="size-3.5 text-slate-300 hover:text-indigo-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EnlazarReferenciaDialog({
  open,
  onOpenChange,
  conversacionId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  conversacionId: string
}) {
  const { enviarMensaje } = useComunicaciones()
  const { ordenes } = useOrders()
  const { solicitudes } = useGD()
  const [tab, setTab] = useState<"pedido" | "gestion">("pedido")
  const [q, setQ] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [enviando, setEnviando] = useState(false)

  const term = q.trim().toLowerCase()
  const pedidosFiltrados = ordenes
    .filter((o) =>
      !term
        ? true
        : o.pedido.toLowerCase().includes(term) ||
          (o.cliente ?? "").toLowerCase().includes(term)
    )
    .slice(0, 60)
  const gestionesFiltradas = solicitudes
    .filter((s) =>
      !term
        ? true
        : (s.numero ?? "").toLowerCase().includes(term) ||
          (s.cliente ?? "").toLowerCase().includes(term)
    )
    .slice(0, 60)

  const enviar = async (
    tipo: "pedido" | "gestion",
    valor: string,
    titulo: string
  ) => {
    setEnviando(true)
    // 1) Referencia (tarjeta) sin texto embebido.
    const r = await enviarMensaje(conversacionId, "", {
      tipo: "referencia",
      referencia_tipo: tipo,
      referencia_valor: valor,
    })
    // 2) Mensaje aparte, si se escribió: llega justo debajo de la referencia.
    const texto = mensaje.trim()
    if (r.success && texto) {
      await enviarMensaje(conversacionId, texto)
    }
    setEnviando(false)
    if (r.success) {
      toast.success(texto ? `${titulo} enlazado con mensaje` : `${titulo} enlazado`)
      onOpenChange(false)
      setMensaje("")
      setQ("")
    } else {
      toast.error("No se pudo enlazar", { description: r.error })
    }
  }

  const sinResultados =
    (tab === "pedido" && pedidosFiltrados.length === 0) ||
    (tab === "gestion" && gestionesFiltradas.length === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enlazar en la conversación</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Selector de tipo */}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setTab("pedido")}
              className={cn(
                "flex-1 rounded-md px-2 py-1 font-medium transition-colors",
                tab === "pedido"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Pedidos
            </button>
            <button
              type="button"
              onClick={() => setTab("gestion")}
              className={cn(
                "flex-1 rounded-md px-2 py-1 font-medium transition-colors",
                tab === "gestion"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Gestiones de diseño
            </button>
          </div>

          <Textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribe un mensaje para enviar junto a la referencia (opcional)…"
            rows={2}
            className="resize-none"
          />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "pedido"
                  ? "Buscar pedido o cliente…"
                  : "Buscar gestión o cliente…"
              }
              className="pl-8"
            />
          </div>

          <div className="max-h-72 space-y-1 overflow-auto">
            {tab === "pedido" &&
              pedidosFiltrados.map((o) => (
                <button
                  key={o.pedido}
                  disabled={enviando}
                  onClick={() =>
                    void enviar("pedido", o.pedido, `Pedido ${o.pedido}`)
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <Link2 className="size-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      Pedido {o.pedido}
                      {o.es_urgente && (
                        <span className="ml-1 text-[11px] text-amber-500">
                          • urgente
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {[
                        o.cliente,
                        o.estado_produccion || o.estado_aprobado_rechazado,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            {tab === "gestion" &&
              gestionesFiltradas.map((s) => (
                <button
                  key={s.id}
                  disabled={enviando}
                  onClick={() =>
                    void enviar("gestion", String(s.id), `Gestión ${s.numero}`)
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <Link2 className="size-4 shrink-0 text-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      Gestión {s.numero}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {[s.cliente, s.estado].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            {sinResultados && (
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

function formatSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function descargar(url: string, nombre: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = obj
    a.download = nombre || "archivo"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(obj)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

function AdjuntosView({ adjuntos, esMio }: { adjuntos: Adjunto[]; esMio: boolean }) {
  const imagenes = adjuntos.filter((a) => a.es_imagen)
  const archivos = adjuntos.filter((a) => !a.es_imagen)
  return (
    <div className="mb-1 space-y-1">
      {imagenes.length > 0 && (
        <div className={cn("grid gap-1", imagenes.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {imagenes.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={a.url}
                alt={a.nombre ?? "imagen"}
                className="max-h-48 w-full rounded-lg object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {archivos.map((a) => (
        <button
          key={a.id}
          onClick={() => descargar(a.url, a.nombre ?? "archivo")}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left",
            esMio ? "border-white/30 bg-white/10" : "border-slate-200 bg-white"
          )}
        >
          <FileText className={cn("size-4 shrink-0", esMio ? "text-white" : "text-red-500")} />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-xs", esMio ? "text-white" : "text-slate-700")}>
              {a.nombre}
            </p>
            <p className={cn("text-[10px]", esMio ? "text-white/70" : "text-slate-400")}>
              {formatSize(a.tamano)}
            </p>
          </div>
          <Download className={cn("size-3.5 shrink-0", esMio ? "text-white/80" : "text-slate-400")} />
        </button>
      ))}
    </div>
  )
}

function ConsolidadoDialog({
  open,
  onOpenChange,
  conversacionId,
  cargar,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  conversacionId: string
  cargar: (id: string) => Promise<Adjunto[]>
}) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [tab, setTab] = useState<"imagenes" | "archivos">("imagenes")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!open) return
    setCargando(true)
    cargar(conversacionId)
      .then(setAdjuntos)
      .finally(() => setCargando(false))
  }, [open, conversacionId, cargar])

  const imagenes = adjuntos.filter((a) => a.es_imagen)
  const archivos = adjuntos.filter((a) => !a.es_imagen)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archivos de la conversación</DialogTitle>
        </DialogHeader>
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setTab("imagenes")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              tab === "imagenes" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Imágenes ({imagenes.length})
          </button>
          <button
            onClick={() => setTab("archivos")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              tab === "archivos" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Archivos ({archivos.length})
          </button>
        </div>
        <div className="max-h-96 overflow-auto">
          {cargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-slate-300" />
            </div>
          ) : tab === "imagenes" ? (
            imagenes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin imágenes.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {imagenes.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
                    <img src={a.url} alt={a.nombre ?? ""} className="h-24 w-full rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )
          ) : archivos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sin archivos.</p>
          ) : (
            <div className="space-y-1">
              {archivos.map((a) => (
                <button
                  key={a.id}
                  onClick={() => descargar(a.url, a.nombre ?? "archivo")}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-50"
                >
                  <FileText className="size-4 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700">{a.nombre}</p>
                    <p className="text-[11px] text-slate-400">{formatSize(a.tamano)}</p>
                  </div>
                  <Download className="size-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BusquedaGlobalDialog({
  open,
  onOpenChange,
  buscar,
  tituloConv,
  nombrePorEmail,
  onAbrir,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  buscar: (filtros: {
    texto?: string
    desde?: string
    hasta?: string
    tipo?: string
  }) => Promise<{ conversacionId: string; mensajes: Mensaje[] }[]>
  tituloConv: (id: string) => string
  nombrePorEmail: Map<string, { nombre: string | null; foto: string | null }>
  onAbrir: (convId: string, mid: string) => void
}) {
  const [texto, setTexto] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [tipo, setTipo] = useState("")
  const [cargando, setCargando] = useState(false)
  const [grupos, setGrupos] = useState<{ conversacionId: string; mensajes: Mensaje[] }[]>([])

  const correr = async () => {
    if (!texto.trim() && !desde && !hasta && !tipo) {
      setGrupos([])
      return
    }
    setCargando(true)
    const r = await buscar({ texto, desde, hasta, tipo })
    setGrupos(r)
    setCargando(false)
  }

  useEffect(() => {
    if (!open) {
      setTexto("")
      setDesde("")
      setHasta("")
      setTipo("")
      setGrupos([])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar en todas las conversaciones</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void correr()
                }}
                placeholder="Texto a buscar…"
                className="pl-8"
                autoFocus
              />
            </div>
            <Button onClick={() => void correr()} size="sm">
              <Search className="mr-1 size-4" /> Buscar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              title="Desde"
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
            />
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              title="Hasta"
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
            />
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
            >
              <option value="">Todo</option>
              <option value="texto">Mensajes</option>
              <option value="imagen">Imágenes</option>
              <option value="archivo">Archivos</option>
              <option value="tarea">Tareas</option>
            </select>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Filter className="size-3" /> filtros
            </span>
          </div>

          <div className="max-h-96 space-y-3 overflow-auto pt-1">
            {cargando ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-slate-300" />
              </div>
            ) : grupos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Escribe un texto o aplica filtros y presiona Buscar.
              </p>
            ) : (
              grupos.map((g) => (
                <div key={g.conversacionId}>
                  <p className="mb-1 text-xs font-semibold text-indigo-600">
                    {tituloConv(g.conversacionId)} ({g.mensajes.length})
                  </p>
                  <div className="space-y-1">
                    {g.mensajes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onAbrir(g.conversacionId, m.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                          <span className="font-medium text-slate-500">
                            {nombrePorEmail.get(m.remitente_email)?.nombre ?? m.remitente_email}:
                          </span>{" "}
                          {resumenBusqueda(m)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CrearGrupoDialog({
  open,
  onOpenChange,
  usuarios,
  onCrear,
  onCreado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  usuarios: DirectorioUsuario[]
  onCrear: (nombre: string, descripcion: string, participantes: string[]) => Promise<string | null>
  onCreado: (id: string) => void
}) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [q, setQ] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)

  const toggle = (em: string) =>
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(em)) n.delete(em)
      else n.add(em)
      return n
    })

  const filtrados = usuarios.filter((u) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return (u.nombre ?? "").toLowerCase().includes(t) || (u.area ?? "").toLowerCase().includes(t)
  })

  const crear = async () => {
    if (!nombre.trim() || sel.size === 0) return
    setCreando(true)
    const id = await onCrear(nombre, descripcion, Array.from(sel))
    setCreando(false)
    if (id) {
      onCreado(id)
      onOpenChange(false)
      setNombre("")
      setDescripcion("")
      setSel(new Set())
      setQ("")
    } else {
      toast.error("No se pudo crear el grupo")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo" />
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="resize-none"
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar participantes..."
              className="pl-8"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-auto">
            {filtrados.map((u) => (
              <button
                key={u.email}
                onClick={() => toggle(u.email)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <input type="checkbox" checked={sel.has(u.email)} readOnly className="accent-indigo-600" />
                <UserAvatar nombre={u.nombre} email={u.email} fotoUrl={u.foto_url} className="size-7" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{u.nombre || u.email}</p>
                  <p className="truncate text-[11px] text-slate-400">{u.area || u.email}</p>
                </div>
              </button>
            ))}
          </div>
          <Button onClick={() => void crear()} disabled={creando || !nombre.trim() || sel.size === 0} className="w-full">
            {creando ? <Loader2 className="mr-1 size-4 animate-spin" /> : <UsersRound className="mr-1 size-4" />}
            Crear grupo ({sel.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GrupoInfoDialog({
  open,
  onOpenChange,
  conv,
  miEmail,
  usuarios,
  onAgregar,
  onQuitar,
  onRenombrar,
  onEliminar,
  onSalir,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  conv: Conversacion
  miEmail: string
  usuarios: DirectorioUsuario[]
  onAgregar: (id: string, emails: string[]) => Promise<{ success: boolean; error?: string }>
  onQuitar: (id: string, email: string) => Promise<{ success: boolean; error?: string }>
  onRenombrar: (id: string, nombre: string, descripcion: string) => Promise<{ success: boolean; error?: string }>
  onEliminar: () => Promise<{ success: boolean; error?: string }>
  onSalir: () => Promise<{ success: boolean; error?: string }>
}) {
  const soyAdmin =
    conv.participantes.find((p) => p.usuario_email === miEmail)?.rol === "admin"
  const miembros = conv.participantes.filter((p) => !p.left_at)
  const miembrosEmails = new Set(miembros.map((p) => p.usuario_email))

  const [nombre, setNombre] = useState(conv.nombre ?? "")
  const [descripcion, setDescripcion] = useState(conv.descripcion ?? "")
  const [addOpen, setAddOpen] = useState(false)
  const [q, setQ] = useState("")
  const nombreDe = (em: string) => usuarios.find((u) => u.email === em)?.nombre || em
  const fotoDe = (em: string) => usuarios.find((u) => u.email === em)?.foto_url || null

  const noMiembros = usuarios.filter((u) => !miembrosEmails.has(u.email))
  const noMiembrosFiltrados = noMiembros.filter((u) => {
    const t = q.trim().toLowerCase()
    if (!t) return true
    return (u.nombre ?? "").toLowerCase().includes(t) || (u.area ?? "").toLowerCase().includes(t)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{conv.nombre || "Grupo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {soyAdmin ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción"
                rows={2}
                className="resize-none"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await onRenombrar(conv.id, nombre, descripcion)
                  if (r.success) toast.success("Grupo actualizado")
                  else toast.error("No se pudo actualizar", { description: r.error })
                }}
              >
                Guardar cambios
              </Button>
            </div>
          ) : (
            conv.descripcion && <p className="text-sm text-slate-500">{conv.descripcion}</p>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Participantes ({miembros.length})
              </p>
              {soyAdmin && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAddOpen((v) => !v)}>
                  <UserPlus className="size-3.5" /> Agregar
                </Button>
              )}
            </div>

            {addOpen && soyAdmin && (
              <div className="mb-2 space-y-1 rounded-lg border border-slate-200 p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="h-8 pl-8" />
                </div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {noMiembrosFiltrados.map((u) => (
                    <button
                      key={u.email}
                      onClick={async () => {
                        const r = await onAgregar(conv.id, [u.email])
                        if (r.success) toast.success(`${u.nombre || u.email} agregado`)
                        else toast.error("No se pudo agregar", { description: r.error })
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-slate-50"
                    >
                      <UserAvatar nombre={u.nombre} email={u.email} fotoUrl={u.foto_url} className="size-6" />
                      <span className="truncate text-sm">{u.nombre || u.email}</span>
                    </button>
                  ))}
                  {noMiembrosFiltrados.length === 0 && (
                    <p className="px-2 py-2 text-center text-xs text-slate-400">Sin usuarios.</p>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-56 space-y-1 overflow-auto">
              {miembros.map((p) => (
                <div key={p.usuario_email} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <UserAvatar nombre={nombreDe(p.usuario_email)} email={p.usuario_email} fotoUrl={fotoDe(p.usuario_email)} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">
                      {nombreDe(p.usuario_email)}
                      {p.usuario_email === miEmail && " (tú)"}
                    </p>
                  </div>
                  {p.rol === "admin" && (
                    <span className="rounded bg-indigo-100 px-1.5 text-[10px] font-medium text-indigo-600">
                      Admin
                    </span>
                  )}
                  {soyAdmin && p.usuario_email !== miEmail && (
                    <button
                      onClick={async () => {
                        const r = await onQuitar(conv.id, p.usuario_email)
                        if (!r.success) toast.error("No se pudo quitar", { description: r.error })
                      }}
                      title="Quitar del grupo"
                      className="text-slate-300 hover:text-rose-500"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-slate-600"
              onClick={async () => {
                const r = await onSalir()
                if (!r.success) toast.error("No se pudo salir", { description: r.error })
              }}
            >
              <LogOut className="size-4" /> Salir del grupo
            </Button>
            {soyAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={async () => {
                  if (!confirm("¿Eliminar el grupo para todos? Esta acción no se puede deshacer.")) return
                  const r = await onEliminar()
                  if (!r.success) toast.error("No se pudo eliminar", { description: r.error })
                }}
              >
                <Trash2 className="size-4" /> Eliminar grupo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
