"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, PenLine } from "lucide-react"

/**
 * Metodos imperativos que expone el SignaturePad a traves de su ref.
 * Se usan desde el modal padre para validar (isEmpty), limpiar y
 * exportar la firma a PNG antes de subirla a Supabase Storage.
 */
export interface SignaturePadHandle {
  /** true si el usuario aun no ha trazado nada sobre el canvas */
  isEmpty: () => boolean
  /** borra el canvas y lo marca como vacio */
  clear: () => void
  /**
   * Exporta la firma como Blob PNG. Devuelve null si el canvas esta vacio.
   * El Blob se puede subir directamente a Supabase Storage.
   */
  toBlob: () => Promise<Blob | null>
}

interface SignaturePadProps {
  /** callback opcional disparado en cada cambio (empezar/terminar trazo, limpiar) */
  onChange?: (isEmpty: boolean) => void
  /** altura en px del canvas. Default 180 */
  height?: number
  /** etiqueta ARIA del recuadro de firma */
  ariaLabel?: string
}

/**
 * Componente de firma virtual basado en HTML5 Canvas + Pointer Events.
 *
 * - Soporta mouse, touch y stylus en una sola API (`pointerdown/move/up`).
 * - Usa devicePixelRatio para obtener trazos nitidos en pantallas HiDPI.
 * - Reajusta el canvas al redimensionar el contenedor preservando la firma
 *   actual (se vuelve a dibujar desde una copia en memoria).
 * - El recuadro tiene fondo blanco y borde definido segun lo solicitado.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onChange, height = 180, ariaLabel = "Firma del cliente" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDrawingRef = useRef(false)
    const lastPointRef = useRef<{ x: number; y: number } | null>(null)
    const [isEmpty, setIsEmpty] = useState(true)

    // Notifica cambios hacia arriba (habilita/deshabilita el submit del modal)
    useEffect(() => {
      onChange?.(isEmpty)
    }, [isEmpty, onChange])

    /**
     * Ajusta el tamaño interno del canvas a su tamaño CSS multiplicado por
     * devicePixelRatio. Preserva el trazo actual copiandolo antes del resize.
     */
    const resizeCanvas = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()

      // Preservar contenido previo
      const snapshot = document.createElement("canvas")
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      const snapCtx = snapshot.getContext("2d")
      if (snapCtx && canvas.width > 0 && canvas.height > 0) {
        snapCtx.drawImage(canvas, 0, 0)
      }

      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = "#111827" // slate-900 - tinta oscura legible
      ctx.lineWidth = 2

      // Restaurar snapshot (escalado al nuevo tamaño)
      if (snapshot.width > 0 && snapshot.height > 0) {
        ctx.drawImage(
          snapshot,
          0,
          0,
          snapshot.width,
          snapshot.height,
          0,
          0,
          rect.width,
          height
        )
      }
    }

    useEffect(() => {
      resizeCanvas()
      const handler = () => resizeCanvas()
      window.addEventListener("resize", handler)
      return () => window.removeEventListener("resize", handler)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height])

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      // Captura el puntero para seguir recibiendo eventos aunque salga del canvas
      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      const p = getPoint(e)
      lastPointRef.current = p

      // Dibuja un "dot" inicial para permitir firmas de un solo tap
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2)
        ctx.fillStyle = "#111827"
        ctx.fill()
      }
      if (isEmpty) setIsEmpty(false)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const p = getPoint(e)
      const last = lastPointRef.current
      if (last) {
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      lastPointRef.current = p
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId)
      }
      isDrawingRef.current = false
      lastPointRef.current = null
    }

    const clear = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      setIsEmpty(true)
    }

    useImperativeHandle(
      ref,
      () => ({
        isEmpty: () => isEmpty,
        clear,
        toBlob: () =>
          new Promise<Blob | null>((resolve) => {
            const canvas = canvasRef.current
            if (!canvas || isEmpty) {
              resolve(null)
              return
            }
            // Exportar como PNG sobre fondo blanco (el canvas es transparente)
            const exportCanvas = document.createElement("canvas")
            exportCanvas.width = canvas.width
            exportCanvas.height = canvas.height
            const ectx = exportCanvas.getContext("2d")
            if (!ectx) {
              resolve(null)
              return
            }
            ectx.fillStyle = "#ffffff"
            ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
            ectx.drawImage(canvas, 0, 0)
            exportCanvas.toBlob((blob) => resolve(blob), "image/png")
          }),
      }),
      [isEmpty]
    )

    return (
      <div className="space-y-2">
        <div
          ref={containerRef}
          className="relative rounded-md border-2 border-slate-300 bg-white shadow-inner overflow-hidden"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            aria-label={ariaLabel}
            role="img"
            // touch-none evita que el navegador interprete el trazo como scroll
            className="block h-full w-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400 gap-2">
              <PenLine className="size-4" />
              Firma aqui
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clear}
            disabled={isEmpty}
          >
            <Eraser className="mr-1.5 size-3.5" />
            Limpiar Firma
          </Button>
        </div>
      </div>
    )
  }
)
