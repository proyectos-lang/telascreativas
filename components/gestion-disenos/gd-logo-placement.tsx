"use client"

import { useRef, useState, useCallback } from "react"
import { GDGarmentDiagram } from "./gd-garment-diagram"
import type { LogoPosition } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

interface GDLogoPlacementProps {
  tipo: string
  value: LogoPosition[]
  onChange: (positions: LogoPosition[]) => void
  cantidadLogos: number
  disabled?: boolean
}

const LOGO_COLORS = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"]
const LOGO_COLORS_BORDER = ["border-red-600", "border-blue-600", "border-green-600", "border-yellow-600"]

export function GDLogoPlacement({
  tipo,
  value,
  onChange,
  cantidadLogos,
  disabled,
}: GDLogoPlacementProps) {
  const [vista, setVista] = useState<"frontal" | "trasera">("frontal")
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)

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
      const newPos: LogoPosition = { logo: logoNum, x: pos.x, y: pos.y, vista }
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

  return (
    <div className="space-y-3">
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
        {/* Logos panel */}
        <div className="w-24 shrink-0 space-y-2">
          <p className="text-xs font-medium text-slate-500">Logos disponibles</p>
          {unplacedLogos.map((logoNum) => (
            <div
              key={logoNum}
              draggable={!disabled}
              onDragStart={() => setDragging(logoNum)}
              className={cn(
                "flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-sm active:cursor-grabbing",
                LOGO_COLORS[(logoNum - 1) % 4],
                LOGO_COLORS_BORDER[(logoNum - 1) % 4],
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {logoNum}
            </div>
          ))}
          {unplacedLogos.length === 0 && (
            <p className="text-xs text-slate-400">Todos colocados</p>
          )}
        </div>

        {/* Garment drop zone */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden"
          style={{ minHeight: 200 }}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            if (dragging !== null) {
              const alreadyPlaced = logosForVista.find((p) => p.logo === dragging)
              if (alreadyPlaced) handleMovePlaced(e, dragging)
              else handleDropNew(e, dragging)
            }
          }}
        >
          <GDGarmentDiagram tipo={tipo} vista={vista} className="h-48 w-full" />

          {logosForVista.map((pos) => (
            <div
              key={pos.logo}
              draggable={!disabled}
              onDragStart={() => setDragging(pos.logo)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)" }}
              className="absolute z-10 cursor-grab active:cursor-grabbing"
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-md",
                  LOGO_COLORS[(pos.logo - 1) % 4],
                  LOGO_COLORS_BORDER[(pos.logo - 1) % 4]
                )}
              >
                {pos.logo}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeLogo(pos.logo)}
                  className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-700 text-[8px] text-white hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <p className="absolute bottom-1 right-2 text-[10px] text-slate-400">
            Arrastra los logos sobre la prenda
          </p>
        </div>
      </div>
    </div>
  )
}
