"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { GDGarmentDiagram } from "./gd-garment-diagram"
import { GDImageLightbox } from "./gd-image-lightbox"
import { useGD } from "@/lib/gestion-disenos-context"
import type { LogoPosition } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

interface GDLogoPlacementProps {
  tipo: string
  value: LogoPosition[]
  onChange: (positions: LogoPosition[]) => void
  cantidadLogos: number
  disabled?: boolean
  pathPrefix?: string
}

const LOGO_COLORS = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"]
const LOGO_COLORS_BORDER = ["border-red-600", "border-blue-600", "border-green-600", "border-yellow-600"]
const LOGO_HEX_BORDER = ["#dc2626", "#2563eb", "#16a34a", "#ca8a04"]

const BASE_SIZE = 28

export function GDLogoPlacement({
  tipo,
  value,
  onChange,
  cantidadLogos,
  disabled,
  pathPrefix,
}: GDLogoPlacementProps) {
  const { uploadFile } = useGD()
  const [vista, setVista] = useState<"frontal" | "trasera">("frontal")
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState<number | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const logosForVista = value.filter((p) => p.vista === vista)
  const allLogos = Array.from({ length: cantidadLogos }, (_, i) => i + 1)
  const placedLogosInVista = new Set(logosForVista.map((p) => p.logo))
  const unplacedLogos = allLogos.filter((l) => !placedLogosInVista.has(l))

  const getRelativePos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!containerRef.current) return null
      const rect = containerRef.current.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
    },
    []
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleDropNew = useCallback(
    (e: React.DragEvent, logoNum: number) => {
      e.preventDefault()
      const pos = getRelativePos(e.clientX, e.clientY)
      if (!pos) return
      const existing = value.find((p) => p.logo === logoNum && p.vista === vista)
      const newPos: LogoPosition = {
        logo: logoNum,
        x: pos.x,
        y: pos.y,
        vista,
        label: existing?.label,
        size: existing?.size ?? 1,
        imageUrl: existing?.imageUrl,
      }
      const filtered = value.filter((p) => !(p.logo === logoNum && p.vista === vista))
      onChange([...filtered, newPos])
      setDragging(null)
    },
    [getRelativePos, value, onChange, vista]
  )

  const handleMovePlaced = useCallback(
    (e: React.DragEvent, logoNum: number) => {
      e.preventDefault()
      const pos = getRelativePos(e.clientX, e.clientY)
      if (!pos) return
      const updated = value.map((p) =>
        p.logo === logoNum && p.vista === vista ? { ...p, x: pos.x, y: pos.y } : p
      )
      onChange(updated)
      setDragging(null)
    },
    [getRelativePos, value, onChange, vista]
  )

  const removeLogo = useCallback(
    (logoNum: number) => {
      onChange(value.filter((p) => !(p.logo === logoNum && p.vista === vista)))
    },
    [value, onChange, vista]
  )

  const updateLogoProps = useCallback(
    (logoNum: number, props: Partial<Pick<LogoPosition, "label" | "size">>) => {
      const updated = value.map((p) =>
        p.logo === logoNum && p.vista === vista ? { ...p, ...props } : p
      )
      onChange(updated)
    },
    [value, onChange, vista]
  )

  const updateLogoImage = useCallback(
    (logoNum: number, imageUrl: string | undefined) => {
      const updated = value.map((p) =>
        p.logo === logoNum && p.vista === vista ? { ...p, imageUrl } : p
      )
      onChange(updated)
    },
    [value, onChange, vista]
  )

  const handleLogoImageFile = useCallback(
    async (logoNum: number, file: File) => {
      if (!pathPrefix) return
      setUploadingLogo(logoNum)
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${pathPrefix}_logo${logoNum}_${Date.now()}_${safe}`
        const res = await uploadFile(file, path)
        if (res.success && res.url) {
          updateLogoImage(logoNum, res.url)
        } else {
          toast.error(`Error al subir imagen del logo ${logoNum}`, { description: res.error })
        }
      } finally {
        setUploadingLogo(null)
        const ref = fileInputRefs.current[logoNum]
        if (ref) ref.value = ""
      }
    },
    [pathPrefix, uploadFile, updateLogoImage]
  )

  return (
    <div className="space-y-3">
      {/* Vista toggle */}
      <div className="flex gap-1">
        {(["frontal", "trasera"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
              vista === v
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left panel: available logos + placed logos with controls */}
        <div className="w-48 shrink-0 space-y-3">
          {/* Available (unplaced) logos */}
          {unplacedLogos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Disponibles
              </p>
              <div className="flex flex-wrap gap-2">
                {unplacedLogos.map((logoNum) => (
                  <div
                    key={logoNum}
                    draggable={!disabled}
                    onDragStart={() => setDragging(logoNum)}
                    title="Arrastra al diagrama"
                    className={cn(
                      "flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-sm active:cursor-grabbing select-none",
                      LOGO_COLORS[(logoNum - 1) % 4],
                      LOGO_COLORS_BORDER[(logoNum - 1) % 4],
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {logoNum}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placed logos: image upload + size + label */}
          {logosForVista.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Colocados
              </p>
              {logosForVista.map((pos) => {
                const currentSize = pos.size ?? 1
                const isUploading = uploadingLogo === pos.logo
                return (
                  <div
                    key={pos.logo}
                    className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5"
                  >
                    {/* Logo badge + remove */}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white",
                          LOGO_COLORS[(pos.logo - 1) % 4],
                          LOGO_COLORS_BORDER[(pos.logo - 1) % 4]
                        )}
                      >
                        {pos.logo}
                      </div>
                      <span className="flex-1 text-[11px] font-medium text-slate-700">
                        Logo {pos.logo}
                      </span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => removeLogo(pos.logo)}
                          title="Quitar logo"
                          className="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-500 text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Image upload / thumbnail */}
                    {pos.imageUrl ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLightboxSrc(pos.imageUrl!)}
                          className="relative h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-50 hover:opacity-80 transition-opacity"
                          title="Ver imagen del logo"
                        >
                          <img
                            src={pos.imageUrl}
                            alt={`Logo ${pos.logo}`}
                            className="h-full w-full object-contain"
                          />
                        </button>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => updateLogoImage(pos.logo, undefined)}
                            title="Quitar imagen"
                            className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      !disabled && pathPrefix && (
                        <div>
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[pos.logo]?.click()}
                            className={cn(
                              "flex h-8 w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 text-[11px] text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600",
                              isUploading && "cursor-not-allowed opacity-50"
                            )}
                          >
                            {isUploading ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Upload className="size-3" />
                            )}
                            {isUploading ? "Subiendo..." : "Imagen del logo"}
                          </button>
                          <input
                            ref={(el) => { fileInputRefs.current[pos.logo] = el }}
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.ai,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleLogoImageFile(pos.logo, file)
                            }}
                          />
                        </div>
                      )
                    )}

                    {/* Size controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 w-10 shrink-0">Tamaño</span>
                      <button
                        type="button"
                        disabled={disabled || currentSize <= 0.5}
                        onClick={() =>
                          updateLogoProps(pos.logo, { size: Math.max(0.5, currentSize - 0.25) })
                        }
                        className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-[10px] text-slate-600 tabular-nums">
                        {Math.round(currentSize * 100)}%
                      </span>
                      <button
                        type="button"
                        disabled={disabled || currentSize >= 3}
                        onClick={() =>
                          updateLogoProps(pos.logo, { size: Math.min(3, currentSize + 0.25) })
                        }
                        className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    {/* Label input */}
                    <input
                      type="text"
                      value={pos.label ?? ""}
                      onChange={(e) => updateLogoProps(pos.logo, { label: e.target.value })}
                      placeholder="Qué logo va aquí (opcional)"
                      disabled={disabled}
                      className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-300 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {unplacedLogos.length === 0 && logosForVista.length === 0 && (
            <p className="text-xs text-slate-400">Sin logos para colocar</p>
          )}
        </div>

        {/* Garment drop zone */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden"
          style={{ minHeight: 240 }}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            if (dragging !== null) {
              const alreadyPlaced = logosForVista.find((p) => p.logo === dragging)
              if (alreadyPlaced) handleMovePlaced(e, dragging)
              else handleDropNew(e, dragging)
            }
          }}
        >
          <GDGarmentDiagram tipo={tipo} vista={vista} className="h-56 w-full" />

          {logosForVista.map((pos) => {
            const sz = Math.round((pos.size ?? 1) * BASE_SIZE)
            const fs = Math.max(8, Math.round(sz / 3))
            return (
              <div
                key={pos.logo}
                draggable={!disabled}
                onDragStart={() => setDragging(pos.logo)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%,-50%)",
                  width: sz,
                  height: sz,
                  position: "absolute",
                  zIndex: 10,
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                {pos.imageUrl ? (
                  <div
                    className="h-full w-full overflow-hidden rounded-full border-2 shadow-md"
                    style={{ borderColor: LOGO_HEX_BORDER[(pos.logo - 1) % 4] }}
                  >
                    <img
                      src={pos.imageUrl}
                      alt={`Logo ${pos.logo}`}
                      className="h-full w-full object-cover select-none"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center rounded-full border-2 font-bold text-white shadow-md select-none",
                      LOGO_COLORS[(pos.logo - 1) % 4],
                      LOGO_COLORS_BORDER[(pos.logo - 1) % 4]
                    )}
                    style={{ fontSize: fs }}
                  >
                    {pos.logo}
                  </div>
                )}
              </div>
            )
          })}

          <p className="absolute bottom-1 right-2 text-[10px] text-slate-400">
            Arrastra los logos sobre la prenda
          </p>
        </div>
      </div>

      {lightboxSrc && (
        <GDImageLightbox src={lightboxSrc} open onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
