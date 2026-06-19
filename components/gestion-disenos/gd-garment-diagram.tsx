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
        <path d="M70 10 Q100 5 130 10 L155 40 L175 35 L185 70 L165 75 L165 220 L35 220 L35 75 L15 70 L25 35 L45 40 Z"
          stroke="#94a3b8" strokeWidth="2" fill="#f8fafc" />
        <path d="M70 10 Q85 25 100 28 Q115 25 130 10" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
        <circle cx="60" cy="100" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="60" y="103.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">C</text>
        <circle cx="80" cy="90" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="80" y="93.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">B</text>
        <circle cx="100" cy="88" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="100" y="91.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">A</text>
        <circle cx="120" cy="90" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="120" y="93.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">D</text>
        <text x="100" y="15" textAnchor="middle" fontSize="8" fill="#94a3b8">FRONTAL</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M70 10 Q100 5 130 10 L155 40 L175 35 L185 70 L165 75 L165 220 L35 220 L35 75 L15 70 L25 35 L45 40 Z"
        stroke="#94a3b8" strokeWidth="2" fill="#f8fafc" />
      <path d="M70 10 Q85 25 100 28 Q115 25 130 10" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="140" r="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <text x="100" y="144" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="700">F</text>
      <circle cx="80" cy="100" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <text x="80" y="103.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">E</text>
      <text x="100" y="15" textAnchor="middle" fontSize="8" fill="#94a3b8">DETRAS</text>
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
        <circle cx="65" cy="80" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="65" y="83.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">A</text>
        <circle cx="135" cy="80" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <text x="135" y="83.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">B</text>
        <text x="100" y="15" textAnchor="middle" fontSize="8" fill="#94a3b8">FRONTAL</text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M30 20 L170 20 L170 30 L155 160 L110 160 L100 100 L90 160 L45 160 L30 30 Z"
        stroke="#94a3b8" strokeWidth="2" fill="#f8fafc" />
      <path d="M100 20 L100 100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
      <circle cx="65" cy="80" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <text x="65" y="83.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">C</text>
      <circle cx="135" cy="80" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <text x="135" y="83.5" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">D</text>
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
