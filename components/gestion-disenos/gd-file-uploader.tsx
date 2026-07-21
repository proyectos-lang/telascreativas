"use client"

import { useRef, useState } from "react"
import { Upload, X, FileText, Image as ImageIcon, Loader2, Expand } from "lucide-react"
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
]
const ALLOWED_EXTS = ".ai,.pdf,.png,.jpg,.jpeg,.webp"
const MAX_BYTES = 25 * 1024 * 1024

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
  maxFiles = 5,
  disabled,
}: GDFileUploaderProps) {
  const { uploadFile } = useGD()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const handleFiles = async (files: FileList) => {
    const remaining = maxFiles - value.length
    const toUpload = Array.from(files).slice(0, remaining)

    const invalid = toUpload.filter(
      (f) =>
        !ALLOWED_TYPES.includes(f.type) &&
        !f.name.toLowerCase().endsWith(".ai")
    )
    if (invalid.length) {
      toast.error("Formato no permitido", {
        description: "Solo se permiten: .ai, .pdf, .png, .jpg, .jpeg, .webp",
      })
      return
    }
    const tooBig = toUpload.filter((f) => f.size > MAX_BYTES)
    if (tooBig.length) {
      toast.error("Archivo demasiado grande", {
        description: "Máximo 25 MB por archivo",
      })
      return
    }

    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${pathPrefix}_${Date.now()}_${safe}`
        const res = await uploadFile(file, path)
        if (res.success && res.url) {
          urls.push(res.url)
        } else {
          toast.error(`Error al subir ${file.name}`, { description: res.error })
        }
      }
      if (urls.length) onChange([...value, ...urls])
    } finally {
      setUploading(false)
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

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTS}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
