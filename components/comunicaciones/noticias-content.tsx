"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import {
  Megaphone,
  Loader2,
  Pin,
  AlertCircle,
  Check,
  MessageCircle,
  Users,
  Download,
  Search,
  Newspaper,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  useComunicaciones,
  type Noticia,
  type NoticiaComentario,
} from "@/lib/comunicaciones-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { UserAvatar } from "./user-avatar"
import { PublicarNoticiaDialog, CATEGORIAS } from "./publicar-noticia-dialog"

const CAT_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.label]))
const CAT_COLOR: Record<string, string> = {
  comunicado: "bg-blue-100 text-blue-700",
  novedad: "bg-teal-100 text-teal-700",
  politica: "bg-slate-100 text-slate-700",
  urgente: "bg-rose-100 text-rose-700",
  reconocimiento: "bg-amber-100 text-amber-700",
  celebracion: "bg-fuchsia-100 text-fuchsia-700",
}
const EMOJIS = ["👍", "❤️", "🎉", "👏"]

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function NoticiasContent() {
  const { usuarioActual } = useAuth()
  const puedePublicar = usuarioActual?.com_publicar_noticias === true
  const miEmail = (usuarioActual?.email ?? "").toLowerCase()
  const { cargarNoticias, usuarios } = useComunicaciones()

  const [tab, setTab] = useState<"tablero" | "historico">("tablero")
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [loading, setLoading] = useState(true)
  const [publicarOpen, setPublicarOpen] = useState(false)
  const [texto, setTexto] = useState("")
  const [categoria, setCategoria] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const nombreDe = useCallback(
    (em: string) => usuarios.find((u) => u.email === em)?.nombre || em,
    [usuarios]
  )
  const fotoDe = useCallback(
    (em: string) => usuarios.find((u) => u.email === em)?.foto_url || null,
    [usuarios]
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    const data = await cargarNoticias(
      tab === "tablero"
        ? { soloActivas: true }
        : { soloActivas: false, texto, categoria, desde, hasta }
    )
    setNoticias(data)
    setLoading(false)
  }, [cargarNoticias, tab, texto, categoria, desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Newspaper className="size-5 text-icon-magenta" />
          <h2 className="text-sm font-semibold text-slate-800">Noticias y novedades</h2>
          <div className="ml-2 flex rounded-lg border border-slate-200 p-0.5 text-xs">
            <button onClick={() => setTab("tablero")} className={cn("rounded px-2 py-0.5", tab === "tablero" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}>Tablero</button>
            <button onClick={() => setTab("historico")} className={cn("rounded px-2 py-0.5", tab === "historico" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}>Histórico</button>
          </div>
        </div>
        {puedePublicar && (
          <Button size="sm" onClick={() => setPublicarOpen(true)} className="gap-1.5">
            <Megaphone className="size-4" /> Publicar
          </Button>
        )}
      </div>

      {tab === "historico" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs backdrop-blur-sm">
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por texto…" className="h-8 bg-white pl-8" />
          </div>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
            <option value="">Categoría: todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.label}</option>
            ))}
          </select>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-7 animate-spin text-slate-300" />
        </div>
      ) : noticias.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          {tab === "tablero" ? "No hay noticias para ti por ahora." : "Sin resultados en el histórico."}
        </p>
      ) : (
        <div className="mx-auto max-w-2xl space-y-3">
          {noticias.map((n) => (
            <NoticiaCard
              key={n.id}
              noticia={n}
              miEmail={miEmail}
              nombreDe={nombreDe}
              fotoDe={fotoDe}
              onReload={cargar}
            />
          ))}
        </div>
      )}

      <PublicarNoticiaDialog open={publicarOpen} onOpenChange={setPublicarOpen} onPublicada={cargar} />
    </div>
  )
}

function NoticiaCard({
  noticia,
  miEmail,
  nombreDe,
  fotoDe,
  onReload,
}: {
  noticia: Noticia
  miEmail: string
  nombreDe: (em: string) => string
  fotoDe: (em: string) => string | null
  onReload: () => void
}) {
  const {
    confirmarLecturaNoticia,
    reaccionarNoticia,
    comentarNoticia,
    cargarComentariosNoticia,
    pendientesConfirmacionNoticia,
  } = useComunicaciones()
  const soyAutor = noticia.autor?.toLowerCase() === miEmail
  const [comOpen, setComOpen] = useState(false)
  const [comentarios, setComentarios] = useState<NoticiaComentario[]>([])
  const [nuevoCom, setNuevoCom] = useState("")
  const [pendOpen, setPendOpen] = useState(false)
  const [pendientes, setPendientes] = useState<string[] | null>(null)

  const imagenes = noticia.adjuntos.filter((a) => a.es_imagen)
  const archivos = noticia.adjuntos.filter((a) => !a.es_imagen)

  const abrirComentarios = async () => {
    const nuevo = !comOpen
    setComOpen(nuevo)
    if (nuevo) setComentarios(await cargarComentariosNoticia(noticia.id))
  }
  const enviarComentario = async () => {
    if (!nuevoCom.trim()) return
    const r = await comentarNoticia(noticia.id, nuevoCom)
    if (r.success) {
      setNuevoCom("")
      setComentarios(await cargarComentariosNoticia(noticia.id))
    } else toast.error("No se pudo comentar", { description: r.error })
  }
  const verPendientes = async () => {
    const nuevo = !pendOpen
    setPendOpen(nuevo)
    if (nuevo) setPendientes(await pendientesConfirmacionNoticia(noticia.id))
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/80 p-4 backdrop-blur-sm",
        noticia.destacada ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {noticia.destacada && <Pin className="size-3.5 text-amber-500" />}
        {noticia.categoria && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CAT_COLOR[noticia.categoria] ?? "bg-slate-100")}>
            {CAT_LABEL[noticia.categoria] ?? noticia.categoria}
          </span>
        )}
        {noticia.obligatoria && (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
            <AlertCircle className="size-3" /> Lectura obligatoria
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{fmt(noticia.publicar_at)}</span>
      </div>

      <h3 className="text-base font-semibold text-slate-800">{noticia.titulo}</h3>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        <UserAvatar nombre={nombreDe(noticia.autor ?? "")} email={noticia.autor ?? undefined} fotoUrl={fotoDe(noticia.autor ?? "")} className="size-5" />
        {nombreDe(noticia.autor ?? "")}
      </div>

      {noticia.cuerpo && (
        <div className="markdown-noticia mt-2 text-sm text-slate-700 [&_a]:text-indigo-600 [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{noticia.cuerpo}</ReactMarkdown>
        </div>
      )}

      {imagenes.length > 0 && (
        <div className={cn("mt-2 grid gap-2", imagenes.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {imagenes.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
              <img src={a.url} alt={a.nombre ?? ""} className="max-h-64 w-full rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
      {archivos.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Download className="size-4 text-slate-400" /> {a.nombre}
        </a>
      ))}

      {/* Confirmación de lectura */}
      {noticia.obligatoria && (
        <div className="mt-3">
          {noticia.confirmada ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="size-3.5" /> Lectura confirmada
            </span>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                const r = await confirmarLecturaNoticia(noticia.id)
                if (r.success) onReload()
                else toast.error("No se pudo confirmar", { description: r.error })
              }}
            >
              <Check className="size-4" /> Confirmar lectura
            </Button>
          )}
        </div>
      )}

      {/* Reacciones + comentarios */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        {noticia.reacciones_habilitadas &&
          EMOJIS.map((e) => {
            const count = noticia.reacciones[e] ?? 0
            const mine = noticia.miReaccion === e
            return (
              <button
                key={e}
                onClick={async () => {
                  await reaccionarNoticia(noticia.id, e)
                  onReload()
                }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  mine ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <span>{e}</span>
                {count > 0 && <span className="text-slate-500">{count}</span>}
              </button>
            )
          })}
        {noticia.comentarios_habilitados && (
          <button onClick={() => void abrirComentarios()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <MessageCircle className="size-3.5" /> {noticia.comentariosCount} comentarios
          </button>
        )}
        {soyAutor && noticia.obligatoria && (
          <button onClick={() => void verPendientes()} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <Users className="size-3.5" /> Pendientes de leer
          </button>
        )}
      </div>

      {pendOpen && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
          {pendientes === null ? (
            <Loader2 className="size-4 animate-spin text-slate-300" />
          ) : pendientes.length === 0 ? (
            <p className="text-emerald-600">Todos confirmaron la lectura ✔</p>
          ) : (
            <>
              <p className="mb-1 font-medium text-slate-500">
                {pendientes.length} sin confirmar:
              </p>
              <div className="flex flex-wrap gap-1">
                {pendientes.map((em) => (
                  <span key={em} className="rounded bg-white px-1.5 py-0.5 text-slate-600">
                    {nombreDe(em)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {comOpen && (
        <div className="mt-2 space-y-2">
          <div className="space-y-1.5">
            {comentarios.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <UserAvatar nombre={nombreDe(c.usuario_email ?? "")} email={c.usuario_email ?? undefined} fotoUrl={fotoDe(c.usuario_email ?? "")} className="size-6" />
                <div className="rounded-lg bg-slate-50 px-2 py-1">
                  <p className="text-[11px] font-medium text-slate-500">{nombreDe(c.usuario_email ?? "")}</p>
                  <p className="text-sm text-slate-700">{c.texto}</p>
                </div>
              </div>
            ))}
            {comentarios.length === 0 && <p className="text-xs text-slate-400">Sé el primero en comentar.</p>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={nuevoCom}
              onChange={(e) => setNuevoCom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void enviarComentario()}
              placeholder="Escribe un comentario…"
              className="h-8"
            />
            <Button size="sm" onClick={() => void enviarComentario()} disabled={!nuevoCom.trim()}>
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
