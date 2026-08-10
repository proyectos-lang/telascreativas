"use client"

/**
 * Estado "Pendiente por Reposición" (cuarto estado transversal).
 *
 * Una orden está pendiente por reposición si:
 *   - MANUAL: cabecera.pendiente_reposicion = true (con area_reposicion), o
 *   - DERIVADO: tiene una reposición abierta en telas.incidencias
 *     (genera_reposicion = true AND estado_reposicion = 'Pendiente').
 *
 * El área "que se espera" = area_reposicion (manual) ∪ area_genera de las
 * reposiciones abiertas (derivado).
 */

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import type { Orden } from "@/lib/types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ReposicionEstado {
  pendiente: boolean
  areas: string[]
  manual: boolean
}

/** Mapa pedido → áreas con reposición abierta (derivado de incidencias). */
export type ReposicionesMapa = Map<string, string[]>

// Cache a nivel módulo: se lee incidencias una vez y se comparte entre
// todas las superficies (tablas, detalles, plan semanal, dashboard, etc.).
let cachePromise: Promise<ReposicionesMapa> | null = null

async function loadReposicionesPendientes(): Promise<ReposicionesMapa> {
  if (cachePromise) return cachePromise
  cachePromise = (async () => {
    const mapa: ReposicionesMapa = new Map()
    const { data, error } = await supabase
      .schema("telas")
      .from("incidencias")
      .select("pedido, area_genera, genera_reposicion, estado_reposicion")
      .eq("genera_reposicion", true)
      .ilike("estado_reposicion", "pendiente")
    if (error || !data) {
      cachePromise = null // permitir reintento
      return mapa
    }
    for (const row of data as { pedido: string; area_genera: string | null }[]) {
      const pedido = String(row.pedido ?? "")
      if (!pedido) continue
      const area = (row.area_genera ?? "").toString().trim()
      const arr = mapa.get(pedido) ?? []
      if (area && !arr.includes(area)) arr.push(area)
      mapa.set(pedido, arr)
    }
    return mapa
  })()
  return cachePromise
}

/** Invalida el cache (llamar tras crear/procesar una reposición o marcar manual). */
export function invalidateReposicionesCache() {
  cachePromise = null
}

/**
 * Hook: devuelve el mapa de reposiciones abiertas por pedido (cacheado).
 * `refresh` fuerza una recarga.
 */
export function useReposicionesPendientes() {
  const [mapa, setMapa] = useState<ReposicionesMapa>(new Map())
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    loadReposicionesPendientes().then((m) => {
      setMapa(m)
      setLoading(false)
    })
  }

  useEffect(() => {
    let cancelled = false
    loadReposicionesPendientes().then((m) => {
      if (!cancelled) {
        setMapa(m)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = () => {
    invalidateReposicionesCache()
    load()
  }

  return { mapa, loading, refresh }
}

// ---------------------------------------------------------------------------
// Variante "full" por PEDIDO: combina derivado (incidencias) + manual
// (cabecera.pendiente_reposicion). Útil en superficies que NO tienen la
// bandera manual en su fila (plan semanal, dashboard leen vistas curadas).
// ---------------------------------------------------------------------------

let fullCachePromise: Promise<Map<string, ReposicionEstado>> | null = null

async function loadReposicionesFull(): Promise<Map<string, ReposicionEstado>> {
  if (fullCachePromise) return fullCachePromise
  fullCachePromise = (async () => {
    const derivado = await loadReposicionesPendientes()
    const combinado = new Map<string, ReposicionEstado>()

    // Manual: cabecera con pendiente_reposicion = true.
    const { data, error } = await supabase
      .schema("telas")
      .from("cabecera")
      .select("pedido, area_reposicion")
      .eq("pendiente_reposicion", true)

    if (error) {
      fullCachePromise = null
    }

    const manualByPedido = new Map<string, string>()
    for (const r of (data as { pedido: string; area_reposicion: string | null }[]) ?? []) {
      const p = String(r.pedido ?? "")
      if (p) manualByPedido.set(p, (r.area_reposicion ?? "").toString().trim())
    }

    const pedidos = new Set<string>([...derivado.keys(), ...manualByPedido.keys()])
    for (const pedido of pedidos) {
      const areas: string[] = []
      const manualArea = manualByPedido.get(pedido)
      const manual = manualByPedido.has(pedido)
      if (manual && manualArea) areas.push(manualArea)
      for (const a of derivado.get(pedido) ?? []) if (a && !areas.includes(a)) areas.push(a)
      combinado.set(pedido, { pendiente: true, areas, manual })
    }
    return combinado
  })()
  return fullCachePromise
}

/** Hook combinado por pedido (derivado + manual). */
export function useReposicionesFull() {
  const [mapa, setMapa] = useState<Map<string, ReposicionEstado>>(new Map())
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    loadReposicionesFull().then((m) => {
      if (!cancelled) {
        setMapa(m)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
  const refresh = () => {
    fullCachePromise = null
    invalidateReposicionesCache()
    loadReposicionesFull().then(setMapa)
  }
  return { mapa, loading, refresh }
}

const SIN_REPOSICION: ReposicionEstado = { pendiente: false, areas: [], manual: false }

/** Lookup por pedido en el mapa combinado. */
export function reposicionDePedido(
  pedido: string | null | undefined,
  mapa?: Map<string, ReposicionEstado> | null
): ReposicionEstado {
  return mapa?.get(String(pedido ?? "")) ?? SIN_REPOSICION
}

/**
 * Combina la marca manual (en la orden) con las reposiciones derivadas
 * (mapa por pedido) para decidir si la orden está pendiente por reposición.
 */
export function getReposicionEstado(
  orden: Pick<Orden, "pedido" | "pendiente_reposicion" | "area_reposicion">,
  mapa?: ReposicionesMapa | null
): ReposicionEstado {
  const manual = orden.pendiente_reposicion === true
  const manualArea = (orden.area_reposicion ?? "").toString().trim()
  const derivadas = mapa?.get(String(orden.pedido ?? "")) ?? []

  const areas: string[] = []
  if (manual && manualArea) areas.push(manualArea)
  for (const a of derivadas) if (a && !areas.includes(a)) areas.push(a)

  return { pendiente: manual || derivadas.length > 0, areas, manual }
}

/**
 * Cancela la(s) reposición(es) pendiente(s) de un pedido (acción protegida con
 * clave desde la UI). Conserva el histórico: marca las incidencias derivadas
 * abiertas como 'Cancelado' (dejan de contar como pendientes porque el loader
 * filtra por `ilike 'pendiente'`) y limpia la marca manual de la cabecera.
 * Invalida ambos caches para que producción recalcule el bloqueo sin recargar.
 */
export async function cancelarReposicionDePedido(
  pedido: string
): Promise<{ success: boolean; error?: string }> {
  const p = String(pedido ?? "").trim()
  if (!p) return { success: false, error: "Pedido inválido" }
  const nowIso = new Date().toISOString()

  // 1) Incidencias derivadas pendientes → Cancelado (conserva el registro).
  const { error: incErr } = await supabase
    .schema("telas")
    .from("incidencias")
    .update({ estado_reposicion: "Cancelado", fecha_procesado: nowIso })
    .eq("pedido", p)
    .eq("genera_reposicion", true)
    .ilike("estado_reposicion", "pendiente")
  if (incErr) return { success: false, error: incErr.message }

  // 2) Marca manual en cabecera → limpiar.
  const { error: cabErr } = await supabase
    .schema("telas")
    .from("cabecera")
    .update({ pendiente_reposicion: false, area_reposicion: null })
    .eq("pedido", p)
  if (cabErr) return { success: false, error: cabErr.message }

  // 3) Invalidar ambos caches a nivel módulo.
  cachePromise = null
  fullCachePromise = null
  return { success: true }
}
