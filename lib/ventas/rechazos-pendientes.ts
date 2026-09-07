"use client"

/**
 * Rechazos de Programación pendientes de revisar por Ventas.
 *
 * Cuando el Planner rechaza una orden, el motivo se guarda en
 * `cabecera.motivo_rechazo` pero Ventas no se enteraba: había que entrar a
 * mirar orden por orden. Este módulo alimenta la campana global con esos
 * rechazos y permite marcarlos como vistos.
 *
 * Destinatarios (ver lib/ventas/destinatarios.ts): la vendedora de la orden
 * y siempre la Jefa de Ventas. Si el nombre escrito a mano no se puede
 * resolver, se avisa a todo el equipo antes que perder el rechazo.
 *
 * Caché a nivel de módulo con invalidación, igual que
 * lib/reposiciones-pendientes.ts: la campana consulta seguido y no tiene
 * sentido repetir la lectura en cada render.
 */

import { createClient } from "@supabase/supabase-js"
import { fetchAll } from "@/lib/fetch-all"
import {
  destinatariosRechazo,
  type UsuarioDestino,
} from "@/lib/ventas/destinatarios"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface RechazoPendiente {
  pedido: string
  cliente: string | null
  vendedora: string | null
  motivo: string | null
  fechaEntrega: string | null
  pcs: number | null
  /** Emails que deben ver este rechazo. */
  destinatarios: string[]
  /** True si no se pudo identificar a la vendedora y se avisó al equipo. */
  usoRespaldo: boolean
}

interface FilaRechazo {
  pedido: string
  cliente: string | null
  vendedora: string | null
  motivo_rechazo: string | null
  fecha_de_entrega: string | null
  pcs: number | null
  rechazo_visto_en: string | null
}

const COLUMNAS =
  "pedido, cliente, vendedora, motivo_rechazo, fecha_de_entrega, pcs, rechazo_visto_en"

let cache: Promise<RechazoPendiente[]> | null = null

/** Fuerza la siguiente lectura a ir a la base. */
export function invalidarRechazos() {
  cache = null
}

async function cargar(): Promise<RechazoPendiente[]> {
  const { data: usuarios } = await supabase
    .schema("telas")
    .from("usuarios")
    .select("nombre, email, cargo, area")

  const { data, error } = await fetchAll<FilaRechazo>((from, to) =>
    supabase
      .schema("telas")
      .from("cabecera")
      .select(COLUMNAS)
      .eq("estado_aprobado_rechazado", "Rechazado")
      .is("rechazo_visto_en", null)
      .range(from, to) as unknown as PromiseLike<{
      data: FilaRechazo[] | null
      error: { message: string } | null
    }>
  )
  if (error) return []

  const lista = (usuarios as UsuarioDestino[]) ?? []
  return (data ?? []).map((r) => {
    const d = destinatariosRechazo(r.vendedora, lista)
    return {
      pedido: r.pedido,
      cliente: r.cliente,
      vendedora: r.vendedora,
      motivo: r.motivo_rechazo,
      fechaEntrega: r.fecha_de_entrega,
      pcs: r.pcs,
      destinatarios: d.emails,
      usoRespaldo: d.usoRespaldo,
    }
  })
}

export function cargarRechazosPendientes(): Promise<RechazoPendiente[]> {
  if (!cache) cache = cargar()
  return cache
}

/** Rechazos que debe ver un usuario concreto. */
export function rechazosDe(
  lista: RechazoPendiente[],
  email: string | null | undefined
): RechazoPendiente[] {
  const e = String(email ?? "").trim().toLowerCase()
  if (!e) return []
  return lista.filter((r) => r.destinatarios.includes(e))
}

/** Marca un rechazo como revisado por Ventas. */
export async function marcarRechazoVisto(
  pedido: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .schema("telas")
    .from("cabecera")
    .update({
      rechazo_visto_por: email,
      rechazo_visto_en: new Date().toISOString(),
    })
    .eq("pedido", pedido)
  if (error) return { success: false, error: error.message }
  invalidarRechazos()
  return { success: true }
}
