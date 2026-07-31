"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Search,
  FileText,
  Image as ImageIcon,
  Expand,
  Download,
  Users,
  ArrowLeft,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS } from "@/lib/gestion-disenos-types"
import { GDImageLightbox } from "./gd-image-lightbox"

// ---------------------------------------------------------------------------
// Helpers de archivo
// ---------------------------------------------------------------------------

function getExt(url: string): string {
  return (url.split("?")[0].split(".").pop() ?? "").toLowerCase()
}
function isImageUrl(url: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(getExt(url))
}
function isPdfUrl(url: string): boolean {
  return getExt(url) === "pdf"
}
/** Nombre original: quita el prefijo de subida `..._<13 dígitos>_`. */
function displayName(url: string): string {
  const filename = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "")
  const match = filename.match(/^.+_\d{13}_(.+)$/)
  return match ? match[1] : filename
}

interface Archivo {
  categoria: string
  url: string
}

/** Recolecta TODOS los adjuntos de una gestión (y sus propuestas). */
function archivosDeGestion(g: GestionDiseno): Archivo[] {
  const out: Archivo[] = []
  const push = (categoria: string, urls?: (string | null | undefined)[] | null) => {
    for (const u of urls ?? []) if (u) out.push({ categoria, url: u })
  }

  push("Prototipo de prenda", g.urls_prototipo_prenda)
  push("Prototipo 2ª prenda", g.urls_prototipo_segunda)
  push("Diseño base", g.urls_diseno_base)
  push("Imágenes / símbolos", g.urls_imagenes_simbolos)
  push("Referencia a recrear", g.urls_recreacion)
  push("Texturas", g.urls_texturas)
  push("Imagen aprobada", [g.imagen_aprobada_url])

  const logos = [
    ...(g.posiciones_logos_prenda1 ?? []),
    ...(g.posiciones_logos_prenda2 ?? []),
    ...(g.segunda_posiciones_logos ?? []),
  ]
    .map((p) => p.imageUrl)
    .filter((u): u is string => !!u)
  push("Logos", logos)

  for (const p of g.propuestas ?? []) {
    const v = `Propuesta V${p.numero_propuesta}`
    push(v, p.imagenes_propuesta_urls)
    push(v, [p.imagen_mockup_url])
    push(`Cambio V${p.numero_propuesta}`, [p.imagen_cambio_url])
    push(`Archivos finales V${p.numero_propuesta}`, p.archivos_finales_urls)
    push(`Adjuntos cliente V${p.numero_propuesta}`, p.imagenes_cliente_urls)
    push(`Logos nuevos V${p.numero_propuesta}`, p.logos_nuevos_urls)
  }

  // Dedupe por URL, conservando la primera categoría.
  const seen = new Set<string>()
  return out.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
}

/** Descarga real (cross-origin): fetch → blob → <a download>. Fallback: abrir. */
async function descargarArchivo(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error("fetch failed")
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

// ---------------------------------------------------------------------------
// Estructura de clientes
// ---------------------------------------------------------------------------

interface ClienteFolder {
  key: string
  nombre: string
  disenos: GestionDiseno[]
  totalArchivos: number
}

interface Props {
  solicitudes: GestionDiseno[]
}

export function GDCarpetasClientes({ solicitudes }: Props) {
  const [query, setQuery] = useState("")
  const [clienteSel, setClienteSel] = useState<string | null>(null)
  const [disenoSel, setDisenoSel] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Precalcula archivos por gestión (memo por id) para no recorrer repetido.
  const archivosPorId = useMemo(() => {
    const m = new Map<number, Archivo[]>()
    for (const s of solicitudes) m.set(s.id, archivosDeGestion(s))
    return m
  }, [solicitudes])

  const clientes = useMemo<ClienteFolder[]>(() => {
    const map = new Map<string, ClienteFolder>()
    for (const s of solicitudes) {
      const nombre = (s.cliente ?? "").trim() || "Sin cliente"
      const key = nombre.toLowerCase()
      const f = map.get(key)
      const nArch = archivosPorId.get(s.id)?.length ?? 0
      if (f) {
        f.disenos.push(s)
        f.totalArchivos += nArch
      } else {
        map.set(key, { key, nombre, disenos: [s], totalArchivos: nArch })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    )
  }, [solicitudes, archivosPorId])

  const clientesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q))
  }, [clientes, query])

  const clienteActual = clienteSel ? clientes.find((c) => c.key === clienteSel) : null
  const disenoActual =
    clienteActual && disenoSel != null
      ? clienteActual.disenos.find((d) => d.id === disenoSel) ?? null
      : null

  // ---- Vista 3: archivos de un diseño ----
  if (disenoActual && clienteActual) {
    const archivos = archivosPorId.get(disenoActual.id) ?? []
    // Agrupar por categoría preservando orden de inserción.
    const grupos: { categoria: string; items: Archivo[] }[] = []
    const idx = new Map<string, number>()
    for (const a of archivos) {
      let i = idx.get(a.categoria)
      if (i == null) {
        i = grupos.length
        idx.set(a.categoria, i)
        grupos.push({ categoria: a.categoria, items: [] })
      }
      grupos[i].items.push(a)
    }

    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Clientes", onClick: () => { setClienteSel(null); setDisenoSel(null) } },
            { label: clienteActual.nombre, onClick: () => setDisenoSel(null) },
            { label: disenoActual.numero },
          ]}
        />
        <button
          onClick={() => setDisenoSel(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="size-4" /> Volver a los diseños de {clienteActual.nombre}
        </button>

        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800">
            {disenoActual.numero} — {disenoActual.cliente}
          </h3>
          <Badge className={cn("text-xs", ESTADO_GD_COLORS[disenoActual.estado])}>
            {disenoActual.estado}
          </Badge>
          <span className="text-xs text-slate-400">{archivos.length} archivo{archivos.length !== 1 ? "s" : ""}</span>
        </div>

        {archivos.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Este diseño aún no tiene archivos adjuntos.
          </p>
        ) : (
          <div className="space-y-5">
            {grupos.map((grupo) => (
              <div key={grupo.categoria}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {grupo.categoria} ({grupo.items.length})
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {grupo.items.map((a, i) => (
                    <ArchivoCard
                      key={`${a.url}-${i}`}
                      url={a.url}
                      onPreview={() => setLightbox(a.url)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {lightbox && (
          <GDImageLightbox src={lightbox} open onClose={() => setLightbox(null)} watermark={false} />
        )}
      </div>
    )
  }

  // ---- Vista 2: diseños de un cliente ----
  if (clienteActual) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Clientes", onClick: () => setClienteSel(null) },
            { label: clienteActual.nombre },
          ]}
        />
        <button
          onClick={() => setClienteSel(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="size-4" /> Volver a clientes
        </button>

        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800">{clienteActual.nombre}</h3>
          <span className="text-xs text-slate-400">
            {clienteActual.disenos.length} diseño{clienteActual.disenos.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clienteActual.disenos
            .slice()
            .sort((a, b) =>
              (b.fecha_creacion ?? "").localeCompare(a.fecha_creacion ?? "")
            )
            .map((d) => {
              const n = archivosPorId.get(d.id)?.length ?? 0
              return (
                <button
                  key={d.id}
                  onClick={() => setDisenoSel(d.id)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  <Folder className="size-8 shrink-0 text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-indigo-700">{d.numero}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {d.fecha_creacion
                        ? format(new Date(d.fecha_creacion), "dd MMM yyyy", { locale: es })
                        : "—"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge className={cn("text-[10px]", ESTADO_GD_COLORS[d.estado])}>
                        {d.estado}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        {n} archivo{n !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                </button>
              )
            })}
        </div>
      </div>
    )
  }

  // ---- Vista 1: lista de clientes ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800">Carpetas de Clientes</h3>
          <span className="text-xs text-slate-400">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9 h-9 bg-white"
          />
        </div>
      </div>

      {clientesFiltrados.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {clientes.length === 0
            ? "Aún no hay diseños registrados."
            : "No se encontraron clientes con esa búsqueda."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((c) => (
            <button
              key={c.key}
              onClick={() => setClienteSel(c.key)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
            >
              <Folder className="size-8 shrink-0 text-indigo-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{c.nombre}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {c.disenos.length} diseño{c.disenos.length !== 1 ? "s" : ""} · {c.totalArchivos} archivo
                  {c.totalArchivos !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[]
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.onClick ? (
            <button onClick={it.onClick} className="hover:text-indigo-600 hover:underline">
              {it.label}
            </button>
          ) : (
            <span className="font-medium text-slate-700">{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="size-3 text-slate-300" />}
        </span>
      ))}
    </div>
  )
}

function ArchivoCard({ url, onPreview }: { url: string; onPreview: () => void }) {
  const nombre = displayName(url)
  const esImg = isImageUrl(url)
  const esPdf = isPdfUrl(url)
  const ext = getExt(url)

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onPreview}
        className="block h-28 w-full bg-slate-50"
        title="Previsualizar"
      >
        {esImg ? (
          <img src={url} alt={nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            {esPdf ? (
              <FileText className="size-7 text-red-500" />
            ) : (
              <ImageIcon className="size-7 text-slate-400" />
            )}
            <span className="text-[10px] font-medium uppercase">{ext || "archivo"}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-28 items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
          <Expand className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </button>
      <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600" title={nombre}>
          {nombre}
        </span>
        <button
          type="button"
          onClick={() => descargarArchivo(url, nombre)}
          title="Descargar"
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
        >
          <Download className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
