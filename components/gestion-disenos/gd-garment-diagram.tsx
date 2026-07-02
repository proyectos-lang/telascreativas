"use client"

import { cn } from "@/lib/utils"

interface GarmentDiagramProps {
  tipo: string
  vista: "frontal" | "trasera"
  className?: string
  children?: React.ReactNode
}

function CamisetaSVG({ vista }: { vista: "frontal" | "trasera" }) {
  if (vista === "frontal") {
    return (
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Manga larga: cross-shaped silhouette */}
        <path
          d="M10 42 L10 185 L52 185 L52 225 L148 225 L148 185 L190 185 L190 42 L152 42 L126 14 Q100 8 74 14 L48 42 Z"
          stroke="#94a3b8" strokeWidth="2" fill="#f8fafc"
        />
        {/* Collar neckline */}
        <path d="M74 14 Q87 30 100 34 Q113 30 126 14" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
        {/* Armhole seam (sleeve ↔ body) */}
        <line x1="52" y1="52" x2="52" y2="180" stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3,2" />
        <line x1="148" y1="52" x2="148" y2="180" stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3,2" />
        {/* Wrist cuffs */}
        <line x1="10" y1="175" x2="52" y2="175" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="148" y1="175" x2="190" y2="175" stroke="#94a3b8" strokeWidth="1.5" />
        <text x="100" y="236" textAnchor="middle" fontSize="8" fill="#94a3b8">FRONTAL</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Manga larga: back view */}
      <path
        d="M10 42 L10 185 L52 185 L52 225 L148 225 L148 185 L190 185 L190 42 L152 42 L126 14 L74 14 L48 42 Z"
        stroke="#94a3b8" strokeWidth="2" fill="#f8fafc"
      />
      {/* Back collar */}
      <line x1="74" y1="14" x2="126" y2="14" stroke="#94a3b8" strokeWidth="1.5" />
      {/* Center back seam */}
      <line x1="100" y1="14" x2="100" y2="225" stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3,2" />
      {/* Armhole seam */}
      <line x1="52" y1="52" x2="52" y2="180" stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3,2" />
      <line x1="148" y1="52" x2="148" y2="180" stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3,2" />
      {/* Wrist cuffs */}
      <line x1="10" y1="175" x2="52" y2="175" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="148" y1="175" x2="190" y2="175" stroke="#94a3b8" strokeWidth="1.5" />
      <text x="100" y="236" textAnchor="middle" fontSize="8" fill="#94a3b8">DETRAS</text>
    </svg>
  )
}

function ShortSVG({ vista }: { vista: "frontal" | "trasera" }) {
  if (vista === "frontal") {
    return (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M30 20 L170 20 L170 30 L155 160 L110 160 L100 100 L90 160 L45 160 L30 30 Z"
          stroke="#94a3b8" strokeWidth="2" fill="#f8fafc" />
        <path d="M100 20 L100 100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
        <text x="100" y="15" textAnchor="middle" fontSize="8" fill="#94a3b8">FRONTAL</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M30 20 L170 20 L170 30 L155 160 L110 160 L100 100 L90 160 L45 160 L30 30 Z"
        stroke="#94a3b8" strokeWidth="2" fill="#f8fafc" />
      <path d="M100 20 L100 100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
      <text x="100" y="15" textAnchor="middle" fontSize="8" fill="#94a3b8">DETRAS</text>
    </svg>
  )
}

export function GDGarmentDiagram({ tipo, vista, className, children }: GarmentDiagramProps) {
  const isShort = ["Short", "Pantaloneta"].includes(tipo)

  return (
    <div className={cn("relative", className)}>
      {isShort ? (
        <ShortSVG vista={vista} />
      ) : (
        <CamisetaSVG vista={vista} />
      )}
      {children}
    </div>
  )
}
