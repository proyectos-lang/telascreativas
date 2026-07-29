"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, FileText, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface GDWatermarkImageProps {
  src: string
  alt?: string
  className?: string
  fullSize?: boolean
}

function getExt(url: string) {
  return (url.split("?")[0].split(".").pop() ?? "").toLowerCase()
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"]

export function GDWatermarkImage({ src, alt = "mockup", className, fullSize = false }: GDWatermarkImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const ext = getExt(src)
  const isImage = IMAGE_EXTS.includes(ext)
  const isPdf = ext === "pdf"

  useEffect(() => {
    // Solo las imágenes se dibujan en canvas para aplicar la marca de agua.
    if (!src || !isImage) return
    setLoading(true)
    setError(false)

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const MAX = 800
      const scale = fullSize ? 1 : Math.min(1, MAX / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Diagonal watermark
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.font = `bold ${Math.max(20, canvas.width / 12)}px Arial`
      ctx.fillStyle = "#1e293b"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const text = "Telas Creativas"
      const diag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2)
      const step = diag / 3

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(-Math.PI / 6)

      for (let y = -diag / 2; y < diag / 2; y += step) {
        for (let x = -diag / 2; x < diag / 2; x += canvas.width / 1.5) {
          ctx.fillText(text, x, y)
        }
      }

      ctx.restore()
      setLoading(false)
    }
    img.onerror = () => {
      setError(true)
      setLoading(false)
    }
    img.src = src
  }, [src, isImage, fullSize])

  // PDF: se muestra embebido (la marca de agua no aplica sobre el PDF).
  if (isPdf) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
          className
        )}
      >
        <object
          data={src}
          type="application/pdf"
          className="w-full"
          style={{ height: fullSize ? "85vh" : 384 }}
          aria-label={alt}
        >
          <iframe
            src={src}
            title={alt}
            className="w-full"
            style={{ height: fullSize ? "85vh" : 384 }}
          />
        </object>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-white"
        >
          <ExternalLink className="size-3" />
          Abrir PDF
        </a>
      </div>
    )
  }

  // Otros archivos no-imagen (AI, etc.): link de descarga.
  if (!isImage) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
          className
        )}
      >
        <FileText className="size-8 text-red-500" />
        <span className="text-sm font-medium">Abrir archivo ({ext.toUpperCase()})</span>
      </a>
    )
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
        No se pudo cargar la imagen
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: loading ? "none" : "block", maxWidth: "100%", height: "auto" }}
        aria-label={alt}
      />
    </div>
  )
}
