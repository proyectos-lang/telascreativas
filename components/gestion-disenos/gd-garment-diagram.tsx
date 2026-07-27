"use client"

import { cn } from "@/lib/utils"

interface GarmentDiagramProps {
  tipo: string
  vista: "frontal" | "trasera"
  className?: string
  children?: React.ReactNode
}

function CamisetaSVG({ vista }: { vista: "frontal" | "trasera" }) {
  // Bocetos de camisa (manga larga) subidos a public/images/. La colocación de
  // logos usa coordenadas en porcentaje del contenedor, así que el arte de fondo
  // es intercambiable sin afectar las posiciones guardadas.
  return (
    <img
      src={vista === "frontal" ? "/images/camisa-frontal.png" : "/images/camisa-detras.png"}
      alt={`Camisa ${vista}`}
      className="w-full h-full object-contain select-none pointer-events-none"
      draggable={false}
    />
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
