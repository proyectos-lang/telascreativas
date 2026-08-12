"use client"

import { useState } from "react"
import { Send, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useComunicaciones } from "@/lib/comunicaciones-context"
import { useAuth } from "@/lib/auth-context"
import { UserAvatar } from "@/components/comunicaciones/user-avatar"

type Props =
  | { tipo: "pedido"; pedido: string; label?: string }
  | { tipo: "gestion"; gestionId: number | string; numero?: string; label?: string }

/**
 * Botón reutilizable para referenciar un pedido o una gestión en un chat.
 * Se coloca en la barra de acciones del detalle de cada módulo. Abre un
 * diálogo para elegir un usuario del directorio y una nota opcional, y envía
 * la referencia como mensaje (crea la conversación 1:1 si no existe).
 */
export function EnviarPorChatButton(props: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [enviando, setEnviando] = useState(false)
  const { usuarios, enviarReferencia, enviarMensaje } = useComunicaciones()
  const { usuarioActual } = useAuth()
  const miEmail = (usuarioActual?.email ?? "").toLowerCase()

  const valor = props.tipo === "pedido" ? props.pedido : String(props.gestionId)
  const titulo =
    props.tipo === "pedido"
      ? `Pedido ${props.pedido}`
      : `Gestión ${props.numero ?? props.gestionId}`

  const filtrados = usuarios
    .filter((u) => u.email !== miEmail)
    .filter((u) => {
      const t = q.trim().toLowerCase()
      if (!t) return true
      return (
        (u.nombre ?? "").toLowerCase().includes(t) ||
        (u.area ?? "").toLowerCase().includes(t)
      )
    })

  const enviar = async (otroEmail: string) => {
    setEnviando(true)
    // 1) Enviar la referencia (tarjeta del pedido/gestión).
    const r = await enviarReferencia(otroEmail, {
      tipo: props.tipo,
      valor,
    })
    // 2) Si se escribió un mensaje, enviarlo enseguida como mensaje aparte en
    //    la misma conversación (llega justo debajo de la referencia).
    const texto = mensaje.trim()
    if (r.success && texto && r.conversacionId) {
      await enviarMensaje(r.conversacionId, texto)
    }
    setEnviando(false)
    if (r.success) {
      toast.success(
        texto ? `${titulo} y mensaje enviados por chat` : `${titulo} enviado por chat`
      )
      setOpen(false)
      setMensaje("")
      setQ("")
    } else {
      toast.error("No se pudo enviar", { description: r.error })
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 text-sm"
      >
        <Send className="mr-1 size-3.5" />
        {props.label ?? "Enviar por chat"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar {titulo} por chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
                placeholder="Buscar usuario por nombre o área..."
                className="pl-8"
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-auto">
              {filtrados.map((u) => (
                <button
                  key={u.email}
                  disabled={enviando}
                  onClick={() => void enviar(u.email)}
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
              {filtrados.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-slate-400">Sin resultados.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
