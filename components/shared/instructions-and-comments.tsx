"use client"

/**
 * InstructionsAndComments
 * --------------------------------------------------------------------------
 * Componente reutilizable que se usa en TODOS los modulos de detalle
 * (Diseno, Corte, Impresion, Sublimacion, Costura, Empaque, Entregas)
 * para unificar la visibilidad de instrucciones del planner y los
 * comentarios de entrega de las areas anteriores en el flujo.
 *
 * Reglas de visibilidad (segun la prop `area`):
 *   - Planner / Ventas: SIEMPRE visible en la parte superior, resaltado.
 *   - Diseno:      ve solo Planner.
 *   - Corte:       ve solo Planner.
 *   - Impresion:   ve Planner + Diseno.
 *   - Sublimacion: ve Planner + Diseno + Corte + Impresion.
 *   - Costura:     ve Planner + Diseno + Corte + Impresion + Sublimacion.
 *   - Empaque:     ve Planner + Diseno + Corte + Impresion + Sublimacion + Costura.
 *   - Entregas:    ve TODO el historial (incluyendo Empaque).
 *
 * Si un campo esta vacio, su fila no se renderiza.
 *
 * Adicionalmente, el componente consulta `telas.incidencias` para detectar
 * si la orden actual tiene reposiciones pendientes; si es asi, renderiza
 * un badge rojo "REPOSICION - Procesos activos: [...]" para que el operario
 * entienda por que le llego la orden directamente.
 */

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertCircle,
  AlertOctagon,
  ClipboardList,
  Flame,
  Package,
  PackageCheck,
  Paintbrush,
  Printer,
  Scissors,
  Shirt,
  Truck,
  type LucideIcon,
} from "lucide-react"
import type { Orden } from "@/lib/types"

// Cliente local de Supabase para consultar incidencias. Si el proyecto no
// tiene credenciales configuradas el componente degrada graciosamente
// (no muestra badge, pero sigue rindiendo el resto del contenido).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export type ModuloArea =
  | "diseno"
  | "corte"
  | "impresion"
  | "sublimacion"
  | "costura"
  | "empaque"
  | "entregas"

interface InstructionsAndCommentsProps {
  orden: Orden
  /** Area actual donde se renderiza el componente. */
  area: ModuloArea
  /** Permite ocultar el titulo si se monta dentro de otra Card. */
  hideHeader?: boolean
}

/**
 * Orden cronologico del flujo. El indice de cada area determina que tan
 * "atras" esta en el pipeline; solo se muestran areas con indice ESTRICTO
 * menor que el del area actual.
 */
const FLOW_ORDER: ModuloArea[] = [
  "diseno",
  "corte",
  "impresion",
  "sublimacion",
  "costura",
  "empaque",
  "entregas",
]

interface AreaCommentConfig {
  key: ModuloArea
  label: string
  icon: LucideIcon
  /** Color del icono (clases tailwind del proyecto). */
  iconColor: string
  /** Acento de borde izquierdo de la tarjeta. */
  borderColor: string
  /** Lee el comentario desde la orden. */
  getComment: (o: Orden) => string | undefined
  /** Lee la fecha asociada al comentario, si existe. */
  getDate: (o: Orden) => string | undefined
}

/**
 * Mapa estatico de cada area a sus campos de comentario y fecha.
 * - "diseno":      dnota_terminado_d  + seta_diseno (no existe; usamos dfecha_cambio_3 como mejor proxy si no hay otra)
 * - "corte":       ccomentario_corte  + cfecha_de_corte
 * - "impresion":   icomentario_entrega_i + ifecha_de_ingreso_imp
 * - "sublimacion": scomentario_entrega_s + seta_sublimacion
 * - "costura":     coscomentario_entrega_cs + coseta_costura
 * - "empaque":     ecomentario_entrega_e + (no hay fecha terminada genérica)
 *
 * Si en el futuro se agregan campos de fecha de terminado por area, aqui
 * se actualizan sin tocar el resto del componente.
 */
const AREA_CONFIGS: Record<
  Exclude<ModuloArea, "entregas">,
  AreaCommentConfig
> = {
  diseno: {
    key: "diseno",
    label: "DISEÑO",
    icon: Paintbrush,
    iconColor: "text-icon-magenta",
    borderColor: "border-l-icon-magenta",
    getComment: (o) => o.dnota_terminado_d || o.dcomentario_diseno,
    getDate: (o) => o.dfecha_cambio_3 || o.dfecha_cambio_2 || o.dfecha_cambio_1,
  },
  corte: {
    key: "corte",
    label: "CORTE",
    icon: Scissors,
    iconColor: "text-icon-magenta",
    borderColor: "border-l-icon-magenta",
    getComment: (o) => o.ccomentario_corte,
    getDate: (o) => o.cfecha_de_corte,
  },
  impresion: {
    key: "impresion",
    label: "IMPRESION",
    icon: Printer,
    iconColor: "text-icon-cyan",
    borderColor: "border-l-icon-cyan",
    getComment: (o) => o.icomentario_entrega_i,
    getDate: (o) => o.ifecha_de_ingreso_imp,
  },
  sublimacion: {
    key: "sublimacion",
    label: "SUBLIMACION",
    icon: Flame,
    iconColor: "text-icon-coral",
    borderColor: "border-l-icon-coral",
    getComment: (o) => o.scomentario_entrega_s,
    getDate: (o) => o.seta_sublimacion,
  },
  costura: {
    key: "costura",
    label: "COSTURA",
    icon: Shirt,
    iconColor: "text-icon-purple",
    borderColor: "border-l-icon-purple",
    getComment: (o) => o.coscomentario_entrega_cs,
    getDate: (o) => o.coseta_costura,
  },
  empaque: {
    key: "empaque",
    label: "EMPAQUE",
    icon: PackageCheck,
    iconColor: "text-icon-coral",
    borderColor: "border-l-icon-coral",
    getComment: (o) => o.ecomentario_entrega_e,
    // Empaque no tiene un campo de fecha de terminado consistente.
    getDate: () => undefined,
  },
}

/**
 * Formato corto y consistente para fechas (YYYY-MM-DD o ISO).
 * Devuelve null si la fecha no se puede parsear, para que el caller
 * decida si renderiza o no la metadata.
 */
function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null
  // Si ya viene en formato YYYY-MM-DD, lo formateamos sin pasar por
  // new Date para evitar shifts de timezone.
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    const [, y, m, d] = ymd
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Consulta el set de reposiciones activas (genera_reposicion = true y
 * estado distinto a "Procesado") para la orden indicada y devuelve el
 * conjunto unico de procesos involucrados, mas el flag general.
 *
 * Si el cliente Supabase no esta disponible (o hay error de red), el
 * hook devuelve `{ activa: false, procesos: [] }` para no romper la UI.
 */
function useReposicionActiva(pedido: string | undefined) {
  const [state, setState] = useState<{
    activa: boolean
    procesos: string[]
  }>({ activa: false, procesos: [] })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase || !pedido) {
        if (!cancelled) setState({ activa: false, procesos: [] })
        return
      }

      const { data, error } = await supabase
        .schema("telas")
        .from("incidencias")
        .select("genera_reposicion,estado_reposicion,procesos_reposicion")
        .eq("pedido", pedido)
        .eq("genera_reposicion", true)

      if (cancelled) return

      if (error) {
        console.log("[v0] InstructionsAndComments - error reposicion:", error)
        setState({ activa: false, procesos: [] })
        return
      }

      // Solo nos interesan reposiciones activas (no procesadas todavia).
      const activos = (data ?? []).filter((row: any) => {
        const estado = (row.estado_reposicion ?? "").toString().toLowerCase()
        return estado !== "procesado"
      })

      if (activos.length === 0) {
        setState({ activa: false, procesos: [] })
        return
      }

      // Union de todos los procesos. Mantenemos el orden de aparicion
      // para que la lista sea estable entre renders.
      const seen = new Set<string>()
      const ordered: string[] = []
      for (const row of activos) {
        const arr = (row as any).procesos_reposicion
        if (Array.isArray(arr)) {
          for (const p of arr) {
            if (typeof p === "string" && !seen.has(p)) {
              seen.add(p)
              ordered.push(p)
            }
          }
        }
      }

      setState({ activa: true, procesos: ordered })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [pedido])

  return state
}

export function InstructionsAndComments({
  orden,
  area,
  hideHeader = false,
}: InstructionsAndCommentsProps) {
  const currentIndex = FLOW_ORDER.indexOf(area)
  const { activa: reposicionActiva, procesos: procesosReposicion } =
    useReposicionActiva(orden.pedido)

  // Comentarios de areas previas (solo aquellas con indice estricto < currentIndex
  // y que tengan comentario no vacio).
  const previousComments = (
    Object.keys(AREA_CONFIGS) as Array<keyof typeof AREA_CONFIGS>
  )
    .map((k) => AREA_CONFIGS[k])
    .filter((cfg) => {
      const idx = FLOW_ORDER.indexOf(cfg.key)
      if (idx === -1 || idx >= currentIndex) return false
      const comment = cfg.getComment(orden)
      return Boolean(comment && comment.trim())
    })

  const planner = (orden.observaciones_planner || "").trim()
  const motivoReversion = (orden.motivo_reversion || "").trim()
  const hasPlanner = Boolean(planner || motivoReversion)
  const hasAnyContent =
    hasPlanner || previousComments.length > 0 || reposicionActiva

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      {!hideHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-icon-purple" />
            Instrucciones y Comentarios de Areas
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={hideHeader ? "pt-6" : "pt-0"}>
        {!hasAnyContent ? (
          <p className="text-sm text-muted-foreground italic py-2">
            No hay instrucciones del planner ni comentarios de areas previas.
          </p>
        ) : (
          <ScrollArea className="max-h-[420px] pr-3">
            <div className="space-y-3">
              {/* Banner de REPOSICION activa. Va arriba de TODO porque
                  cambia la naturaleza de la orden: el operario debe saber
                  inmediatamente que esta llegando una orden por ruteo
                  selectivo y no por flujo normal. */}
              {reposicionActiva && (
                <div className="rounded-md border-2 border-rose-500 bg-rose-50 p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertOctagon className="size-5 text-rose-700 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="text-sm font-bold uppercase tracking-wide text-rose-900">
                        REPOSICION
                      </p>
                      {procesosReposicion.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-rose-900">
                            Procesos activos:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {procesosReposicion.map((proc) => (
                              <Badge
                                key={proc}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs border-transparent"
                              >
                                {proc}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-rose-800/80 pt-1">
                            Esta orden llego a este modulo porque esta en la
                            ruta de la reposicion. Otros modulos pueden
                            haberse omitido.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-800/80">
                          Reposicion legacy sin ruteo definido.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bloque resaltado de instrucciones del Planner / Ventas.
                  Siempre va arriba para que la operacion lo vea primero. */}
              {hasPlanner && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-700 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                        Instrucciones de Planner / Ventas
                      </p>
                      {planner && (
                        <p className="text-sm leading-relaxed text-amber-950 whitespace-pre-wrap break-words">
                          {planner}
                        </p>
                      )}
                      {motivoReversion && (
                        <div className="rounded border border-amber-200 bg-amber-100/60 p-2">
                          <p className="text-xs font-semibold text-amber-900">
                            Motivo de reversion
                          </p>
                          <p className="text-sm text-amber-950 whitespace-pre-wrap break-words">
                            {motivoReversion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comentarios de areas previas en orden cronologico */}
              {previousComments.map((cfg) => {
                const Icon = cfg.icon
                const comment = cfg.getComment(orden)!
                const date = formatDate(cfg.getDate(orden))
                return (
                  <div
                    key={cfg.key}
                    className={`rounded-md border bg-card p-3 border-l-4 ${cfg.borderColor}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        className={`size-4 ${cfg.iconColor} mt-0.5 shrink-0`}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                            {cfg.label}
                          </p>
                          {date && (
                            <span className="text-xs text-muted-foreground">
                              {date}
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                          {comment}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// Iconos exportados como ayuda por si otros componentes quieren reusar el
// mismo lookup visual (no obligatorio para el funcionamiento del modulo).
export const AREA_ICONS: Record<
  Exclude<ModuloArea, "entregas">,
  LucideIcon
> = {
  diseno: Paintbrush,
  corte: Scissors,
  impresion: Printer,
  sublimacion: Flame,
  costura: Shirt,
  empaque: PackageCheck,
}

export const ENTREGAS_ICON = Truck
export const PLACEHOLDER_ICON = Package
