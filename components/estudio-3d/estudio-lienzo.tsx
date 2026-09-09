"use client"

/**
 * Lienzo de edición: la cara de la prenda vista de frente, en 2D.
 *
 * Es donde se arrastran los logos. Va en paralelo al visor 3D porque
 * posicionar sobre una malla que el usuario puede rotar es mucho más
 * difícil que sobre un plano: aquí se coloca con precisión y al lado se
 * comprueba cómo queda puesto.
 *
 * Las coordenadas son porcentajes 0–100, la misma convención que
 * `LogoPosition` en Gestión de Diseños, para que el documento no dependa
 * del tamaño en pantalla.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  LADO_TEXTURA,
  componerCara,
  precargarDiseno,
} from "@/lib/estudio-3d/compositor"
import type { CapaLogo, DisenoEstudio, Vista } from "@/lib/estudio-3d/tipos"

interface Props {
  diseno: DisenoEstudio
  vista: Vista
  seleccionado: string | null
  onSeleccionar: (id: string | null) => void
  onMoverLogo: (id: string, x: number, y: number) => void
  className?: string
}

export function EstudioLienzo({
  diseno,
  vista,
  seleccionado,
  onSeleccionar,
  onMoverLogo,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)

  // El fondo (color + textura) se pinta en canvas; los logos van encima
  // como elementos del DOM para poder arrastrarlos y seleccionarlos sin
  // tener que hacer hit-testing a mano sobre el canvas.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const soloFondo: DisenoEstudio = { ...diseno, logos: [] }
    void precargarDiseno(soloFondo).then(() =>
      componerCara(c, soloFondo, vista, LADO_TEXTURA)
    )
    componerCara(c, soloFondo, vista, LADO_TEXTURA)
  }, [diseno, vista])

  const posDesdeEvento = useCallback((clientX: number, clientY: number) => {
    const r = contenedorRef.current?.getBoundingClientRect()
    if (!r) return null
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    }
  }, [])

  // El arrastre se escucha en window, no en el logo: si el puntero se
  // mueve rápido y sale del elemento, los eventos dejarían de llegar y el
  // logo se quedaría pegado a medio camino.
  useEffect(() => {
    if (!arrastrando) return

    const mover = (e: PointerEvent) => {
      const p = posDesdeEvento(e.clientX, e.clientY)
      if (p) onMoverLogo(arrastrando, p.x, p.y)
    }
    const soltar = () => setArrastrando(null)

    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", soltar)
    return () => {
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    }
  }, [arrastrando, onMoverLogo, posDesdeEvento])

  const logos = diseno.logos
    .filter((l) => l.vista === vista)
    .sort((a, b) => a.z - b.z)

  return (
    <div
      ref={contenedorRef}
      onPointerDown={(e) => {
        // Clic en el fondo: deselecciona.
        if (e.target === e.currentTarget || e.target === canvasRef.current)
          onSeleccionar(null)
      }}
      className={cn(
        "relative aspect-square w-full touch-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {logos.map((l) => (
        <LogoArrastrable
          key={l.id}
          logo={l}
          activo={seleccionado === l.id}
          arrastrando={arrastrando === l.id}
          onTomar={() => {
            onSeleccionar(l.id)
            setArrastrando(l.id)
          }}
        />
      ))}

      {logos.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-slate-400">
          Agrega logos desde el panel de la derecha y arrástralos aquí
        </p>
      )}
    </div>
  )
}

function LogoArrastrable({
  logo,
  activo,
  arrastrando,
  onTomar,
}: {
  logo: CapaLogo
  activo: boolean
  arrastrando: boolean
  onTomar: () => void
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        onTomar()
      }}
      style={{
        left: `${logo.x}%`,
        top: `${logo.y}%`,
        width: `${logo.ancho}%`,
        transform: `translate(-50%, -50%) rotate(${logo.rotacion}deg)`,
        opacity: logo.opacidad,
        zIndex: logo.z,
      }}
      className={cn(
        "absolute cursor-grab select-none",
        arrastrando && "cursor-grabbing",
        activo && "outline-2 outline-dashed outline-offset-2 outline-cyan-500"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.url}
        alt={logo.nombre}
        draggable={false}
        className="pointer-events-none w-full"
      />
    </div>
  )
}
