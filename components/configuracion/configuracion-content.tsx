"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Settings,
  UserPlus,
  KeyRound,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ShieldOff,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PERMISOS, GRUPOS_PERMISO } from "@/lib/configuracion/permisos"

interface UsuarioAdmin {
  email: string
  nombre?: string
  cargo?: string
  area?: string
  foto_url?: string
  [k: string]: unknown
}

export function ConfiguracionContent() {
  const { usuarioActual } = useAuth()
  const miEmail = (usuarioActual?.email ?? "").toLowerCase()
  const esAdmin = usuarioActual?.mod_admin === true

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [editar, setEditar] = useState<UsuarioAdmin | null>(null)
  const [reset, setReset] = useState<UsuarioAdmin | null>(null)

  const api = useCallback(
    async (accion: string, payload: Record<string, unknown> = {}) => {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, solicitanteEmail: miEmail, ...payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Error")
      return json
    },
    [miEmail]
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { usuarios } = await api("listar")
      setUsuarios((usuarios ?? []) as UsuarioAdmin[])
    } catch (e) {
      toast.error("No se pudo cargar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (esAdmin) cargar()
  }, [esAdmin, cargar])

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
        <ShieldOff className="size-10 text-slate-300" />
        <p className="text-sm">Solo los administradores pueden acceder a Configuración.</p>
      </div>
    )
  }

  const filtrados = usuarios
    .filter((u) => {
      const t = q.trim().toLowerCase()
      if (!t) return true
      return (
        (u.nombre ?? "").toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        (u.area ?? "").toLowerCase().includes(t)
      )
    })
    .sort((a, b) => (a.nombre ?? a.email).localeCompare(b.nombre ?? b.email, "es"))

  const eliminar = async (u: UsuarioAdmin) => {
    if (!confirm(`¿Eliminar a ${u.nombre || u.email}? Esta acción no se puede deshacer.`)) return
    try {
      await api("eliminar", { email: u.email })
      toast.success("Usuario eliminado")
      cargar()
    } catch (e) {
      toast.error("No se pudo eliminar", { description: e instanceof Error ? e.message : "" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Configuración — Usuarios</h2>
          <span className="text-xs text-slate-400">{usuarios.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-8 w-48 bg-white pl-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => setNuevoOpen(true)} className="gap-1.5">
            <UserPlus className="size-4" /> Nuevo usuario
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-7 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Cargo</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Permisos</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const activos = PERMISOS.filter((p) => u[p.key] === true).length
                return (
                  <tr key={u.email} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {u.nombre || "—"}
                      {u.mod_admin === true && (
                        <span className="ml-1 rounded bg-indigo-100 px-1 text-[10px] text-indigo-600">admin</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{u.email}</td>
                    <td className="px-3 py-2 text-slate-500">{u.cargo || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{u.area || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{activos}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-7" title="Editar permisos" onClick={() => setEditar(u)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" title="Resetear contraseña" onClick={() => setReset(u)}>
                          <KeyRound className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          title="Eliminar"
                          onClick={() => eliminar(u)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <NuevoUsuarioDialog open={nuevoOpen} onOpenChange={setNuevoOpen} api={api} onListo={cargar} />
      <EditarUsuarioDialog usuario={editar} onClose={() => setEditar(null)} api={api} onListo={cargar} />
      <ResetDialog usuario={reset} onClose={() => setReset(null)} api={api} />
    </div>
  )
}

function PermisosGrid({
  value,
  onChange,
}: {
  value: Record<string, boolean>
  onChange: (v: Record<string, boolean>) => void
}) {
  return (
    <div className="space-y-2">
      {GRUPOS_PERMISO.map((g) => (
        <div key={g}>
          <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">{g}</p>
          <div className="grid grid-cols-2 gap-1">
            {PERMISOS.filter((p) => p.grupo === g).map((p) => (
              <label key={p.key} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={!!value[p.key]}
                  onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
                  className="accent-indigo-600"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

type ApiFn = (accion: string, payload?: Record<string, unknown>) => Promise<{ [k: string]: unknown }>

function NuevoUsuarioDialog({
  open,
  onOpenChange,
  api,
  onListo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  api: ApiFn
  onListo: () => void
}) {
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [area, setArea] = useState("")
  const [password, setPassword] = useState("")
  const [permisos, setPermisos] = useState<Record<string, boolean>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail("")
      setNombre("")
      setCargo("")
      setArea("")
      setPassword("")
      setPermisos({})
    }
  }, [open])

  const crear = async () => {
    if (!email.trim() || !password.trim()) return toast.error("Email y contraseña son obligatorios")
    setGuardando(true)
    try {
      await api("crear", { email, password, datos: { nombre, cargo, area, ...permisos } })
      toast.success("Usuario creado")
      onOpenChange(false)
      onListo()
    } catch (e) {
      toast.error("No se pudo crear", { description: e instanceof Error ? e.message : "" })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-indigo-500" /> Nuevo usuario
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[72vh] space-y-3 overflow-auto pr-1">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Usuario o email * (ej. juan.perez)" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña *" />
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" />
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área" />
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <PermisosGrid value={permisos} onChange={setPermisos} />
          </div>
          <Button onClick={() => void crear()} disabled={guardando} className="w-full">
            {guardando ? <Loader2 className="mr-1 size-4 animate-spin" /> : <UserPlus className="mr-1 size-4" />}
            Crear usuario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditarUsuarioDialog({
  usuario,
  onClose,
  api,
  onListo,
}: {
  usuario: UsuarioAdmin | null
  onClose: () => void
  api: ApiFn
  onListo: () => void
}) {
  const [nombre, setNombre] = useState("")
  const [cargo, setCargo] = useState("")
  const [area, setArea] = useState("")
  const [permisos, setPermisos] = useState<Record<string, boolean>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre ?? "")
      setCargo(usuario.cargo ?? "")
      setArea(usuario.area ?? "")
      const p: Record<string, boolean> = {}
      for (const def of PERMISOS) p[def.key] = usuario[def.key] === true
      setPermisos(p)
    }
  }, [usuario])

  const guardar = async () => {
    if (!usuario) return
    setGuardando(true)
    try {
      await api("permisos", { email: usuario.email, datos: { nombre, cargo, area, ...permisos } })
      toast.success("Usuario actualizado")
      onClose()
      onListo()
    } catch (e) {
      toast.error("No se pudo actualizar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-indigo-500" /> {usuario?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[72vh] space-y-3 overflow-auto pr-1">
          <div className="grid grid-cols-2 gap-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" />
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área" className="col-span-2" />
          </div>
          <div className="rounded-lg border border-slate-200 p-2">
            <PermisosGrid value={permisos} onChange={setPermisos} />
          </div>
          <Button onClick={() => void guardar()} disabled={guardando} className="w-full">
            {guardando ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ResetDialog({
  usuario,
  onClose,
  api,
}: {
  usuario: UsuarioAdmin | null
  onClose: () => void
  api: ApiFn
}) {
  const [password, setPassword] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (usuario) setPassword("")
  }, [usuario])

  const resetear = async () => {
    if (!usuario || !password.trim()) return toast.error("Escribe la nueva contraseña")
    setGuardando(true)
    try {
      await api("resetear", { email: usuario.email, password })
      toast.success("Contraseña actualizada")
      onClose()
    } catch (e) {
      toast.error("No se pudo resetear", { description: e instanceof Error ? e.message : "" })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!usuario} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-indigo-500" /> Resetear contraseña
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{usuario?.nombre || usuario?.email}</p>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" autoFocus />
          <Button onClick={() => void resetear()} disabled={guardando} className="w-full">
            {guardando ? <Loader2 className="mr-1 size-4 animate-spin" /> : <KeyRound className="mr-1 size-4" />}
            Actualizar contraseña
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
