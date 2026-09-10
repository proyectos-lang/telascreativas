"use client"

import { useRef, useState } from "react"
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Loader2,
  Expand,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useGD } from "@/lib/gestion-disenos-context"
import { GDImageLightbox } from "./gd-image-lightbox"

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
  // Excel / hojas de cálculo
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
]
// Extensiones válidas (los .xlsx suelen llegar con MIME vacío o genérico, así
// que la validación se apoya principalmente en la extensión).
const ALLOWED_EXT_LIST = [
  "ai",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "xlsx",
  "xls",
  "csv",
]
const ALLOWED_EXTS = ".ai,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
const MAX_BYTES = 50 * 1024 * 1024

interface GDFileUploaderProps {
  label?: string
  value: string[]
  onChange: (urls: string[]) => void
  pathPrefix: string
  maxFiles?: number
  disabled?: boolean
}

function getExt(url: string) {
  return (url.split("?")[0].split(".").pop() ?? "").toLowerCase()
}

function isImage(url: string) {
  return ["png", "jpg", "jpeg", "webp"].includes(getExt(url))
}

function fileIcon(url: string) {
  const ext = getExt(url)
  if (ext === "pdf") return <FileText className="size-4 text-red-500" />
  if (ext === "ai") return <FileText className="size-4 text-orange-500" />
  if (["xlsx", "xls", "csv"].includes(ext))
    return <FileSpreadsheet className="size-4 text-green-600" />
  return <ImageIcon className="size-4 text-blue-500" />
}

function displayName(url: string) {
  const filename = url.split("?")[0].split("/").pop() ?? ""
  // Strip upload prefix pattern: anything_13digits_originalname
  const match = filename.match(/^.+_\d{13}_(.+)$/)
  return match ? match[1] : filename
}

export function GDFileUploader({
  label,
  value,
  onChange,
  pathPrefix,
  maxFiles = 10,
  disabled,
}: GDFileUploaderProps) {
  const { uploadFile } = useGD()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Progreso del lote: con archivos pesados, un spinner a secas no dice
  // si el sistema sigue trabajando o se quedo colgado.
  const [progreso, setProgreso] = useState<{
    hecho: number
    total: number
    nombre: string
  } | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const handleFiles = async (files: FileList) => {
    const remaining = maxFiles - value.length
    const elegidos = Array.from(files)

    if (remaining <= 0) {
      toast.error("No caben más archivos", {
        description: `El máximo es ${maxFiles}. Quita alguno para subir otro.`,
      })
      return
    }

    // Antes se recortaba en silencio: al elegir 10 con 3 huecos libres,
    // los otros 7 desaparecian sin que nadie lo dijera.
    const toUpload = elegidos.slice(0, remaining)
    if (elegidos.length > remaining) {
      toast.warning(
        `Solo caben ${remaining} archivo${remaining === 1 ? "" : "s"} más`,
        {
          description: `Se subirán los primeros ${remaining} de ${elegidos.length}; el máximo es ${maxFiles}.`,
        }
      )
    }

    // Los invalidos se apartan en vez de abortar el lote entero: un solo
    // archivo pesado o de formato raro no debe impedir que suban los que
    // si sirven.
    const validos: File[] = []
    const malFormato: string[] = []
    const muyGrandes: string[] = []

    for (const f of toUpload) {
      const ext = (f.name.split(".").pop() ?? "").toLowerCase()
      if (!ALLOWED_EXT_LIST.includes(ext) && !ALLOWED_TYPES.includes(f.type)) {
        malFormato.push(f.name)
      } else if (f.size > MAX_BYTES) {
        muyGrandes.push(f.name)
      } else {
        validos.push(f)
      }
    }

    if (malFormato.length)
      toast.error(
        malFormato.length === 1
          ? `"${malFormato[0]}" no tiene un formato permitido`
          : `${malFormato.length} archivos con formato no permitido`,
        {
          description:
            "Solo se permiten: .ai, .pdf, .png, .jpg, .jpeg, .webp, .xlsx, .xls, .csv",
        }
      )
    if (muyGrandes.length)
      toast.error(
        muyGrandes.length === 1
          ? `"${muyGrandes[0]}" supera los 50 MB`
          : `${muyGrandes.length} archivos superan los 50 MB`,
        { description: "Máximo 50 MB por archivo." }
      )
    if (validos.length === 0) {
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    setUploading(true)
    // Se sube de uno en uno, esperando a que termine cada archivo: subirlos
    // a la vez satura la conexion y, con archivos pesados, es lo que hace
    // que fallen a mitad de camino.
    try {
      const urls: string[] = []
      const fallidos: string[] = []

      for (let i = 0; i < validos.length; i++) {
        const file = validos[i]
        setProgreso({ hecho: i, total: validos.length, nombre: file.name })

        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${pathPrefix}_${Date.now()}_${safe}`
        const res = await uploadFile(file, path)

        if (res.success && res.url) {
          urls.push(res.url)
          // Se publica cada archivo en cuanto sube, en vez de esperar al
          // final: si el lote se corta, lo ya subido no se pierde.
          onChange([...value, ...urls])
        } else {
          fallidos.push(file.name)
          toast.error(`No se pudo subir "${file.name}"`, {
            description: res.error,
          })
        }
      }

      if (urls.length && validos.length > 1)
        toast.success(
          `${urls.length} de ${validos.length} archivos subidos`,
          fallidos.length
            ? { description: `No subieron: ${fallidos.join(", ")}` }
            : undefined
        )
    } finally {
      setUploading(false)
      setProgreso(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const removeFile = (url: string) => {
    onChange(value.filter((u) => u !== url))
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}

      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div
            key={url}
            className={cn(
              "group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
              isImage(url) && "cursor-pointer"
            )}
            onClick={() => isImage(url) && setLightboxSrc(url)}
          >
            {isImage(url) ? (
              <>
                <img src={url} alt="prototipo" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <Expand className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={displayName(url)}
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center gap-1 hover:opacity-70"
              >
                {fileIcon(url)}
                <span className="max-w-[56px] truncate text-[9px] text-slate-500">
                  {displayName(url)}
                </span>
              </a>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(url) }}
                className="absolute right-0.5 top-0.5 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:flex"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        ))}

        {!disabled && value.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500",
              uploading && "cursor-not-allowed opacity-50"
            )}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <Upload className="size-4" />
                <span className="text-[10px]">Agregar</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Progreso del lote. Con archivos pesados la subida tarda, y sin
          esto no hay forma de saber en cual va ni si sigue viva. */}
      {progreso && progreso.total > 1 && (
        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Loader2 className="size-3 shrink-0 animate-spin" />
            <span className="min-w-0 flex-1 truncate">
              Subiendo {progreso.nombre}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {progreso.hecho + 1} de {progreso.total}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{
                width: `${(progreso.hecho / progreso.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTS}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} watermark={false} />
      )}
    </div>
  )
}
