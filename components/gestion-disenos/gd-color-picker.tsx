"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface GDColorPickerProps {
  label: string
  value: string | null
  onChange: (value: string) => void
  required?: boolean
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "")
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return { r, g, b }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function isValidHex(val: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)
}

export function GDColorPicker({ label, value, onChange, required }: GDColorPickerProps) {
  const [mode, setMode] = useState<"hex" | "rgb">("hex")
  const [hexInput, setHexInput] = useState(value || "")

  const rgb = value && isValidHex(value) ? hexToRgb(value) : null
  const [rVal, setRVal] = useState(rgb?.r ?? 0)
  const [gVal, setGVal] = useState(rgb?.g ?? 0)
  const [bVal, setBVal] = useState(rgb?.b ?? 0)

  const handleHexChange = useCallback(
    (raw: string) => {
      const val = raw.startsWith("#") ? raw : `#${raw}`
      setHexInput(raw)
      if (isValidHex(val)) {
        const parsed = hexToRgb(val)
        if (parsed) {
          setRVal(parsed.r)
          setGVal(parsed.g)
          setBVal(parsed.b)
        }
        onChange(val.toUpperCase())
      }
    },
    [onChange]
  )

  const handleRgbChange = useCallback(
    (r: number, g: number, b: number) => {
      setRVal(r)
      setGVal(g)
      setBVal(b)
      const hex = rgbToHex(r, g, b)
      setHexInput(hex)
      onChange(hex.toUpperCase())
    },
    [onChange]
  )

  const previewColor = value && isValidHex(value) ? value : "#e2e8f0"

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="flex items-center gap-2">
        <div
          className="size-8 shrink-0 rounded-md border border-slate-200 shadow-inner"
          style={{ backgroundColor: previewColor }}
        />
        <div className="flex-1 space-y-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("hex")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                mode === "hex"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              HEX
            </button>
            <button
              type="button"
              onClick={() => setMode("rgb")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                mode === "rgb"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              RGB
            </button>
          </div>

          {mode === "hex" ? (
            <Input
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#RRGGBB"
              className="h-8 font-mono text-sm uppercase"
              maxLength={7}
            />
          ) : (
            <div className="flex gap-1">
              {(
                [
                  { label: "R", val: rVal, setter: (v: number) => handleRgbChange(v, gVal, bVal) },
                  { label: "G", val: gVal, setter: (v: number) => handleRgbChange(rVal, v, bVal) },
                  { label: "B", val: bVal, setter: (v: number) => handleRgbChange(rVal, gVal, v) },
                ] as const
              ).map(({ label: l, val, setter }) => (
                <div key={l} className="flex-1">
                  <p className="mb-0.5 text-center text-[10px] text-slate-500">{l}</p>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={val}
                    onChange={(e) => setter(parseInt(e.target.value) || 0)}
                    className="h-8 text-center text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
