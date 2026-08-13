"use client"

/**
 * Bloque de ayuda desplegable ("¿Cómo leer esta pestaña?") del módulo
 * Capacidad. Cada pestaña lo usa para explicar sus conceptos y valores en
 * lenguaje de planta, de modo que cualquier usuario entienda qué significa
 * cada número sin conocer el motor por dentro.
 */

import type { ReactNode } from "react"
import { HelpCircle } from "lucide-react"

export function AyudaCapacidad({ children }: { children: ReactNode }) {
  return (
    <details className="rounded-lg border border-sky-200 bg-sky-50/60">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 hover:text-sky-900">
        <HelpCircle className="size-3.5 shrink-0" />
        ¿Cómo leer esta pestaña? (guía rápida)
      </summary>
      <div className="space-y-1.5 border-t border-sky-100 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        {children}
      </div>
    </details>
  )
}

/** Término + definición, para las listas de la guía. */
export function Termino({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <p>
      <strong className="text-slate-800">{nombre}:</strong> {children}
    </p>
  )
}
