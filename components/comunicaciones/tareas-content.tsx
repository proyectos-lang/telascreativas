"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  ClipboardList,
  List,
  CalendarDays,
  LayoutGrid,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { useComunicaciones, type TareaVistaRow } from "@/lib/comunicaciones-context"
import { useAppNavigation } from "@/lib/app-navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { TareaModal } from "./tarea-modal"

const ESTADOS = ["pendiente", "en_proceso", "entregada", "aceptada", "devuelta", "vencida"]
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
const PRIORIDAD_ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 }

function hoy0(): number {
  return new Date(new Date().toDateString()).getTime()
}
function estadoEfectivo(r: TareaVistaRow): string {
  if (
    (r.estado === "pendiente" || r.estado === "en_proceso") &&
    r.fechaEntrega &&
    new Date(r.fechaEntrega).getTime() < hoy0()
  )
    return "vencida"
  return r.estado
}
function venceHoy(r: TareaVistaRow): boolean {
  return !!r.fechaEntrega && new Date(r.fechaEntrega).getTime() === hoy0()
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function TareasContent() {
  const { usuarioActual } = useAuth()
  const esAdmin = usuarioActual?.mod_admin === true
  const {
    usuarios,
    cargarTareasVista,
    reasignarResponsable,
    cambiarFechaEntrega,
    abrirEnChat,
  } = useComunicaciones()
  const { navigateTo } = useAppNavigation()

  const [scope, setScope] = useState<"mias" | "todas">("mias")
  const [rows, setRows] = useState<TareaVistaRow[]>([])
  const [convInfo, setConvInfo] = useState<Map<string, { tipo: string; nombre: string | null }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<"lista" | "tablero" | "calendario">("lista")
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)

  // Filtros
  const [fTexto, setFTexto] = useState("")
  const [fEstado, setFEstado] = useState("")
  const [fResponsable, setFResponsable] = useState("")
  const [fArea, setFArea] = useState("")
  const [fGrupo, setFGrupo] = useState("")
  const [fDesde, setFDesde] = useState("")
  const [fHasta, setFHasta] = useState("")
  const [orden, setOrden] = useState<"fecha" | "prioridad" | "estado">("fecha")

  // Calendario
  const [calMode, setCalMode] = useState<"mes" | "semana">("mes")
  const [ancla, setAncla] = useState(() => new Date(new Date().toDateString()))

  const nombreDe = useCallback(
    (em: string) => usuarios.find((u) => u.email === em)?.nombre || em,
    [usuarios]
  )
  const areaDe = useCallback(
    (em: string) => usuarios.find((u) => u.email === em)?.area || "",
    [usuarios]
  )

  const recargar = useCallback(async () => {
    setLoading(true)
    const { rows, convInfo } = await cargarTareasVista(scope === "todas" && esAdmin)
    setRows(rows)
    setConvInfo(convInfo)
    setLoading(false)
  }, [cargarTareasVista, scope, esAdmin])

  useEffect(() => {
    recargar()
  }, [recargar])

  const areas = useMemo(
    () => Array.from(new Set(rows.map((r) => areaDe(r.responsableEmail)).filter(Boolean))).sort(),
    [rows, areaDe]
  )
  const grupos = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      if (r.conversacionId) {
        const c = convInfo.get(r.conversacionId)
        if (c?.tipo === "grupo" && c.nombre) s.add(c.nombre)
      }
    }
    return Array.from(s).sort()
  }, [rows, convInfo])
  const responsables = useMemo(
    () => Array.from(new Set(rows.map((r) => r.responsableEmail))).sort(),
    [rows]
  )

  const filtradas = useMemo(() => {
    const tx = fTexto.trim().toLowerCase()
    const desdeT = fDesde ? new Date(fDesde).getTime() : null
    const hastaT = fHasta ? new Date(fHasta).getTime() : null
    const out = rows.filter((r) => {
      const est = estadoEfectivo(r)
      if (tx && !(`${r.consecutivo} ${r.titulo}`.toLowerCase().includes(tx))) return false
      if (fEstado && est !== fEstado) return false
      if (fResponsable && r.responsableEmail !== fResponsable) return false
      if (fArea && areaDe(r.responsableEmail) !== fArea) return false
      if (fGrupo) {
        const c = r.conversacionId ? convInfo.get(r.conversacionId) : null
        if (c?.nombre !== fGrupo) return false
      }
      if (r.fechaEntrega) {
        const t = new Date(r.fechaEntrega).getTime()
        if (desdeT && t < desdeT) return false
        if (hastaT && t > hastaT) return false
      } else if (desdeT || hastaT) {
        return false
      }
      return true
    })
    out.sort((a, b) => {
      if (orden === "prioridad")
        return (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9)
      if (orden === "estado")
        return ESTADOS.indexOf(estadoEfectivo(a)) - ESTADOS.indexOf(estadoEfectivo(b))
      // fecha
      const fa = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : Infinity
      const fb = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : Infinity
      return fa - fb
    })
    return out
  }, [rows, fTexto, fEstado, fResponsable, fArea, fGrupo, fDesde, fHasta, orden, areaDe, convInfo])

  const exportar = () => {
    const headers = [
      "#",
      "Título",
      "Responsable",
      "Área",
      "Estado",
      "Prioridad",
      "Fecha entrega",
      "Grupo/Chat",
      "Creado por",
    ]
    const data = filtradas.map((r) => [
      r.consecutivo,
      r.titulo,
      nombreDe(r.responsableEmail),
      areaDe(r.responsableEmail),
      ESTADO_LABEL[estadoEfectivo(r)],
      r.prioridad,
      r.fechaEntrega ?? "",
      (r.conversacionId && convInfo.get(r.conversacionId)?.nombre) || "Directo",
      r.creadoPor ? nombreDe(r.creadoPor) : "",
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Tareas")
    XLSX.writeFile(wb, `tareas-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const irAConversacion = (convId: string | null) => {
    if (!convId) return
    abrirEnChat(convId)
    navigateTo("comunicaciones")
  }

  return (
    <div className="space-y-3">
      {/* Encabezado + controles */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-icon-green" />
          <h2 className="text-sm font-semibold text-slate-800">Tareas</h2>
          {esAdmin && (
            <div className="ml-2 flex rounded-lg border border-slate-200 p-0.5 text-xs">
              <button
                onClick={() => setScope("mias")}
                className={cn("rounded px-2 py-0.5", scope === "mias" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}
              >
                Mías
              </button>
              <button
                onClick={() => setScope("todas")}
                className={cn("rounded px-2 py-0.5", scope === "todas" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}
              >
                Toda la organización
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {([
              ["lista", List],
              ["tablero", LayoutGrid],
              ["calendario", CalendarDays],
            ] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={cn(
                  "rounded p-1.5",
                  vista === v ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:text-slate-600"
                )}
                title={v}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={recargar} className="gap-1.5">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5">
            <Download className="size-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs backdrop-blur-sm">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={fTexto} onChange={(e) => setFTexto(e.target.value)} placeholder="Buscar por # o título…" className="h-8 bg-white pl-8" />
        </div>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
          <option value="">Estado: todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
        {esAdmin && (
          <>
            <select value={fResponsable} onChange={(e) => setFResponsable(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
              <option value="">Responsable: todos</option>
              {responsables.map((em) => (
                <option key={em} value={em}>{nombreDe(em)}</option>
              ))}
            </select>
            <select value={fArea} onChange={(e) => setFArea(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
              <option value="">Área: todas</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {grupos.length > 0 && (
              <select value={fGrupo} onChange={(e) => setFGrupo(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
                <option value="">Grupo: todos</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}
          </>
        )}
        <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} title="Desde" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600" />
        <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} title="Hasta" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600" />
        {vista === "lista" && (
          <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-600">
            <option value="fecha">Ordenar: fecha</option>
            <option value="prioridad">Ordenar: prioridad</option>
            <option value="estado">Ordenar: estado</option>
          </select>
        )}
        <span className="text-slate-400">{filtradas.length} tarea(s)</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-7 animate-spin text-slate-300" />
        </div>
      ) : vista === "lista" ? (
        <ListaTareas
          rows={filtradas}
          esAdmin={esAdmin}
          usuarios={usuarios}
          convInfo={convInfo}
          nombreDe={nombreDe}
          onAbrir={setTareaAbierta}
          onConversacion={irAConversacion}
          onCambiarFecha={async (id, f) => {
            const r = await cambiarFechaEntrega(id, f)
            if (r.success) recargar()
            else toast.error("No se pudo cambiar la fecha", { description: r.error })
          }}
          onReasignar={async (id, oldE, newE) => {
            const r = await reasignarResponsable(id, oldE, newE)
            if (r.success) recargar()
            else toast.error("No se pudo reasignar", { description: r.error })
          }}
        />
      ) : vista === "tablero" ? (
        <Tablero rows={filtradas} nombreDe={nombreDe} onAbrir={setTareaAbierta} />
      ) : (
        <Calendario
          rows={filtradas}
          modo={calMode}
          setModo={setCalMode}
          ancla={ancla}
          setAncla={setAncla}
          onAbrir={setTareaAbierta}
        />
      )}

      <TareaModal
        open={!!tareaAbierta}
        onOpenChange={(v) => {
          if (!v) {
            setTareaAbierta(null)
            recargar()
          }
        }}
        tareaId={tareaAbierta}
      />
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ESTADO_COLOR[estado])}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

function ListaTareas({
  rows,
  esAdmin,
  usuarios,
  convInfo,
  nombreDe,
  onAbrir,
  onConversacion,
  onCambiarFecha,
  onReasignar,
}: {
  rows: TareaVistaRow[]
  esAdmin: boolean
  usuarios: { email: string; nombre: string | null }[]
  convInfo: Map<string, { tipo: string; nombre: string | null }>
  nombreDe: (em: string) => string
  onAbrir: (id: string) => void
  onConversacion: (convId: string | null) => void
  onCambiarFecha: (tareaId: string, fecha: string) => void
  onReasignar: (tareaId: string, oldEmail: string, newEmail: string) => void
}) {
  if (rows.length === 0)
    return <p className="py-12 text-center text-sm text-slate-400">No hay tareas con estos filtros.</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Título</th>
            <th className="px-3 py-2">Responsable</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Prioridad</th>
            <th className="px-3 py-2">Entrega</th>
            <th className="px-3 py-2">Origen</th>
            {esAdmin && <th className="px-3 py-2">Admin</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const est = estadoEfectivo(r)
            const hoy = venceHoy(r)
            return (
              <tr
                key={r.responsableId}
                className={cn(
                  "border-b border-slate-50 hover:bg-slate-50/60",
                  est === "vencida" && "bg-rose-50/40",
                  hoy && est !== "vencida" && "bg-amber-50/40"
                )}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.consecutivo}</td>
                <td className="px-3 py-2">
                  <button onClick={() => onAbrir(r.tareaId)} className="font-medium text-slate-800 hover:text-indigo-600">
                    {r.titulo}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-600">{nombreDe(r.responsableEmail)}</td>
                <td className="px-3 py-2"><EstadoBadge estado={est} /></td>
                <td className="px-3 py-2 text-slate-500 capitalize">{r.prioridad}</td>
                <td className="px-3 py-2">
                  <span className={cn(hoy && "font-semibold text-amber-600", est === "vencida" && "font-semibold text-rose-600")}>
                    {r.fechaEntrega ?? "—"}
                    {hoy && " (hoy)"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onConversacion(r.conversacionId)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                    title="Ir a la conversación de origen"
                  >
                    <MessageSquare className="size-3" />
                    {(r.conversacionId && convInfo.get(r.conversacionId)?.nombre) || "Chat"}
                  </button>
                </td>
                {esAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        defaultValue={r.fechaEntrega ?? ""}
                        onChange={(e) => e.target.value && onCambiarFecha(r.tareaId, e.target.value)}
                        title="Cambiar fecha de entrega"
                        className="h-7 rounded border border-slate-200 bg-white px-1 text-[11px]"
                      />
                      <select
                        value={r.responsableEmail}
                        onChange={(e) => {
                          if (e.target.value !== r.responsableEmail)
                            onReasignar(r.tareaId, r.responsableEmail, e.target.value)
                        }}
                        title="Reasignar responsable"
                        className="h-7 max-w-[110px] rounded border border-slate-200 bg-white px-1 text-[11px]"
                      >
                        {usuarios.map((u) => (
                          <option key={u.email} value={u.email}>{u.nombre || u.email}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Tablero({
  rows,
  nombreDe,
  onAbrir,
}: {
  rows: TareaVistaRow[]
  nombreDe: (em: string) => string
  onAbrir: (id: string) => void
}) {
  const porEstado = useMemo(() => {
    const m = new Map<string, TareaVistaRow[]>()
    for (const e of ESTADOS) m.set(e, [])
    for (const r of rows) m.get(estadoEfectivo(r))?.push(r)
    return m
  }, [rows])
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ESTADOS.map((e) => (
        <div key={e} className="w-64 shrink-0 rounded-xl border border-slate-200 bg-white/70 p-2 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ESTADO_COLOR[e])}>
              {ESTADO_LABEL[e]}
            </span>
            <span className="text-xs text-slate-400">{porEstado.get(e)?.length ?? 0}</span>
          </div>
          <div className="space-y-2">
            {(porEstado.get(e) ?? []).map((r) => (
              <button
                key={r.responsableId}
                onClick={() => onAbrir(r.tareaId)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-indigo-300"
              >
                <p className="truncate text-sm font-medium text-slate-800">
                  <span className="font-mono text-[11px] text-slate-400">#{r.consecutivo}</span> {r.titulo}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{nombreDe(r.responsableEmail)}</p>
                {r.fechaEntrega && (
                  <p className={cn("text-[11px]", venceHoy(r) ? "text-amber-600" : "text-slate-400")}>
                    Entrega: {r.fechaEntrega}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Calendario({
  rows,
  modo,
  setModo,
  ancla,
  setAncla,
  onAbrir,
}: {
  rows: TareaVistaRow[]
  modo: "mes" | "semana"
  setModo: (m: "mes" | "semana") => void
  ancla: Date
  setAncla: (d: Date) => void
  onAbrir: (id: string) => void
}) {
  const porDia = useMemo(() => {
    const m = new Map<string, TareaVistaRow[]>()
    for (const r of rows) {
      if (!r.fechaEntrega) continue
      const arr = m.get(r.fechaEntrega) ?? []
      arr.push(r)
      m.set(r.fechaEntrega, arr)
    }
    return m
  }, [rows])

  // Rango de días a mostrar.
  const dias: Date[] = useMemo(() => {
    if (modo === "semana") {
      const d = new Date(ancla)
      const dow = (d.getDay() + 6) % 7 // lunes=0
      const lunes = new Date(d)
      lunes.setDate(d.getDate() - dow)
      return Array.from({ length: 7 }, (_, i) => {
        const x = new Date(lunes)
        x.setDate(lunes.getDate() + i)
        return x
      })
    }
    // mes: cuadrícula desde el lunes de la primera semana
    const first = new Date(ancla.getFullYear(), ancla.getMonth(), 1)
    const dow = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - dow)
    return Array.from({ length: 42 }, (_, i) => {
      const x = new Date(start)
      x.setDate(start.getDate() + i)
      return x
    })
  }, [modo, ancla])

  const mover = (dir: number) => {
    const d = new Date(ancla)
    if (modo === "semana") d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setAncla(d)
  }

  const titulo =
    modo === "semana"
      ? `Semana de ${dias[0].toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}`
      : ancla.toLocaleDateString("es-CO", { month: "long", year: "numeric" })

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => mover(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium capitalize text-slate-700">{titulo}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => mover(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
          <button onClick={() => setModo("mes")} className={cn("rounded px-2 py-0.5", modo === "mes" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}>Mes</button>
          <button onClick={() => setModo("semana")} className={cn("rounded px-2 py-0.5", modo === "semana" ? "bg-indigo-100 text-indigo-700" : "text-slate-500")}>Semana</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-1 py-0.5 text-center font-medium text-slate-400">{d}</div>
        ))}
        {dias.map((d, i) => {
          const key = ymd(d)
          const tareas = porDia.get(key) ?? []
          const esHoy = d.getTime() === hoy0()
          const otroMes = modo === "mes" && d.getMonth() !== ancla.getMonth()
          return (
            <div
              key={i}
              className={cn(
                "min-h-[72px] rounded-lg border border-slate-100 p-1",
                otroMes && "bg-slate-50/50 text-slate-300",
                esHoy && "ring-1 ring-indigo-300"
              )}
            >
              <div className={cn("mb-0.5 text-[11px]", esHoy ? "font-bold text-indigo-600" : "text-slate-400")}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {tareas.slice(0, 4).map((r) => {
                  const est = estadoEfectivo(r)
                  return (
                    <button
                      key={r.responsableId}
                      onClick={() => onAbrir(r.tareaId)}
                      className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[10px]", ESTADO_COLOR[est])}
                      title={`#${r.consecutivo} ${r.titulo}`}
                    >
                      {r.titulo}
                    </button>
                  )
                })}
                {tareas.length > 4 && (
                  <span className="text-[10px] text-slate-400">+{tareas.length - 4} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
