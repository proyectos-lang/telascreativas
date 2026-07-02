"use client"

import { createClient } from "@supabase/supabase-js"
import type { CatalogoPrenda } from "./gestion-disenos-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let _cache: CatalogoPrenda[] | null = null
let _promise: Promise<CatalogoPrenda[]> | null = null

export async function getCatalogoPrendas(): Promise<CatalogoPrenda[]> {
  if (_cache) return _cache
  if (_promise) return _promise
  _promise = new Promise((resolve) => {
    supabase
      .schema("telas")
      .from("catalogo_tipos_prenda")
      .select("*")
      .eq("activo", true)
      .order("orden")
      .then(({ data }) => {
        _cache = (data as CatalogoPrenda[]) ?? []
        resolve(_cache)
      })
  })
  return _promise
}

export const CATEGORIAS_PRENDA = [
  "ATP",
  "Conjunto ATP",
  "TC",
  "Conjunto TC",
  "Promocionales",
] as const

export type CategoriaPrenda = (typeof CATEGORIAS_PRENDA)[number]

export function prendaLabel(p: CatalogoPrenda): string {
  const parts: string[] = [p.nombre]
  if (p.genero) parts.push(p.genero)
  if (p.mangas) parts.push(p.mangas)
  if (p.medidas) parts.push(p.medidas)
  return parts.join(" · ")
}
