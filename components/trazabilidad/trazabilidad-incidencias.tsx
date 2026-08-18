"use client"

/**
 * Incidencias de un pedido (detalle de Mis Pedidos).
 *
 * Lista todo lo reportado contra la orden: quién la reportó, qué área la
 * generó, el motivo, la prenda afectada (talla/género), si generó reposición,
 * por qué procesos debe pasar y en qué estado está, con sus fechas de reporte
 * y de procesado.
 *
 * Cantidades: la tabla no tiene columna de cantidad, pero el formulario de
 * reporte guarda UNA talla y UN género por registro, así que cada incidencia
 * equivale a una prenda. El resumen agrega por género·talla contando filas;
 * no se inventa ningún número.
 */

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Ban,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDateShort, formatDateTimeLong } from "@/lib/date-utils"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface IncidenciaPedido {
  id: number | string
  pedido: string
  area_reporta: string | null
  area_genera: string | null
  descripcion: string | null
  motivo_especifico: string | null
  talla: string | null
  genero: string | null
  genera_reposicion: boolean | null
  partes_reposicion: string | null
  procesos_reposicion: string[] | null
  estado_reposicion: string | null
  fecha_reporte: string | null
  fecha_procesado: string | null
  created_at?: string | null
}

/** Estado de la reposición, normalizado. */
type EstadoRepo = "sin" | "pendiente" | "procesado" | "cancelado"

function estadoRepo(i: IncidenciaPedido): EstadoRepo {
  if (!i.genera_reposicion) return "sin"
  const e = (i.estado_reposicion ?? "pendiente").trim().toLowerCase()
  if (e.startsWith("proces")) return "procesado"
  if (e.startsWith("cancel")) return "cancelado"
  return "pendiente"
}

function EstadoBadge({ i }: { i: IncidenciaPedido }) {
  const e = estadoRepo(i)
  if (e === "sin")
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Sin reposición
      </Badge>
    )
  if (e === "procesado")
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px]">
        <CheckCircle2 className="mr-1 size-3" />
        Repuesta
      </Badge>
    )
  if (e === "cancelado")
    return (
      <Badge className="bg-slate-500 text-white hover:bg-slate-600 text-[10px]">
        <Ban className="mr-1 size-3" />
        Cancelada
      </Badge>
    )
  return (
    <Badge className="bg-rose-600 text-white hover:bg-rose-700 text-[10px]">
      <AlertOctagon className="mr-1 size-3" />
      Pendiente
    </Badge>
  )
}

export function TrazabilidadIncidencias({ pedido }: { pedido: string }) {
  const [rows, setRows] = useState<IncidenciaPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!pedido) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .schema("telas")
      .from("incidencias")
      .select("*")
      .eq("pedido", pedido)
      .order("fecha_reporte", { ascending: false })
    if (err) setError(err.message)
    setRows((data ?? []) as IncidenciaPedido[])
    setLoading(false)
  }, [pedido])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando incidencias…
      </div>
    )

  if (error)
    return (
      <p className="py-4 text-center text-xs text-rose-600">
        No se pudieron cargar las incidencias: {error}
      </p>
    )

  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
        <CheckCircle2 className="size-6 text-emerald-500" />
        <p className="text-sm text-muted-foreground">
          Este pedido no tiene incidencias reportadas.
        </p>
      </div>
    )

  const pendientes = rows.filter((r) => estadoRepo(r) === "pendiente").length
  const repuestas = rows.filter((r) => estadoRepo(r) === "procesado").length
  const conRepo = rows.filter((r) => r.genera_reposicion).length

  // Cantidades por prenda: cada incidencia es una prenda (una talla y un
  // género por registro), así que contar filas da la cantidad afectada.
  const porPrenda = new Map<string, { total: number; pendiente: number }>()
  for (const r of rows) {
    const k = [r.genero, r.talla].filter(Boolean).join(" · ") || "Sin especificar"
    const acc = porPrenda.get(k) ?? { total: 0, pendiente: 0 }
    acc.total += 1
    if (estadoRepo(r) === "pendiente") acc.pendiente += 1
    porPrenda.set(k, acc)
  }
  const prendas = [...porPrenda.entries()].sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-3">
      {/* Cantidades: totales y desglose por prenda afectada. */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Prendas afectadas
          </p>
          <p className="text-xl font-bold leading-tight text-slate-800">
            {rows.length}
          </p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-rose-500">
            Por reponer
          </p>
          <p className="text-xl font-bold leading-tight text-rose-700">
            {pendientes}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600">
            Repuestas
          </p>
          <p className="text-xl font-bold leading-tight text-emerald-700">
            {repuestas}
          </p>
          <p className="text-[10px] text-emerald-600/70">de {conRepo}</p>
        </div>
      </div>

      {prendas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            Por prenda
          </span>
          {prendas.map(([k, v]) => (
            <Badge
              key={k}
              variant="outline"
              className={cn(
                "gap-1 px-1.5 py-0 text-[10px] font-normal",
                v.pendiente > 0 && "border-rose-200 bg-rose-50 text-rose-800"
              )}
              title={
                v.pendiente > 0
                  ? `${v.pendiente} de ${v.total} sin reponer`
                  : "Todo resuelto"
              }
            >
              {k}
              <strong className="font-semibold">×{v.total}</strong>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {rows.length} incidencia{rows.length !== 1 ? "s" : ""}
        </Badge>
        {pendientes > 0 ? (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
            <AlertOctagon className="mr-1 size-3" />
            {pendientes} reposición{pendientes !== 1 ? "es" : ""} pendiente
            {pendientes !== 1 ? "s" : ""}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Sin reposiciones pendientes</span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((i) => {
          const e = estadoRepo(i)
          const partes = (i.partes_reposicion ?? "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
          const fecha = i.fecha_reporte || i.created_at
          return (
            <div
              key={i.id}
              className={cn(
                "rounded-lg border p-2.5",
                e === "pendiente"
                  ? "border-rose-200 bg-rose-50/50"
                  : "border-slate-200 bg-white"
              )}
            >
              {/* Cabecera: estado + fechas */}
              <div className="flex flex-wrap items-center gap-1.5">
                <EstadoBadge i={i} />
                {i.area_genera && (
                  <Badge
                    variant="outline"
                    className="border-orange-300 bg-orange-50 text-[10px] text-orange-800"
                    title="Área responsable del error"
                  >
                    Generó: {i.area_genera}
                  </Badge>
                )}
                {i.area_reporta && (
                  <Badge variant="outline" className="text-[10px]">
                    Reportó: {i.area_reporta}
                  </Badge>
                )}
                <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  {fecha ? formatDateShort(fecha) : "—"}
                </span>
              </div>

              {/* Motivo y prenda afectada */}
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {i.motivo_especifico && (
                  <span className="text-sm font-medium text-slate-800">
                    {i.motivo_especifico}
                  </span>
                )}
                {(i.talla || i.genero) && (
                  <span className="text-[11px] text-slate-500">
                    Prenda: {[i.genero, i.talla].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>

              {i.descripcion && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-slate-600">
                  {i.descripcion}
                </p>
              )}

              {/* Reposición: partes y recorrido */}
              {i.genera_reposicion && (
                <div className="mt-1.5 space-y-1">
                  {partes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        Partes
                      </span>
                      {partes.map((p) => (
                        <Badge key={p} variant="outline" className="px-1 py-0 text-[10px]">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {Array.isArray(i.procesos_reposicion) &&
                    i.procesos_reposicion.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          Rehace
                        </span>
                        {i.procesos_reposicion.map((p) => (
                          <Badge
                            key={p}
                            className="border-transparent bg-slate-100 px-1 py-0 text-[10px] text-slate-700 hover:bg-slate-200"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {/* Cierre */}
              {i.fecha_procesado && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  {e === "cancelado" ? "Cancelada" : "Repuesta"} el{" "}
                  {formatDateTimeLong(i.fecha_procesado)}
                </p>
              )}
              {e === "pendiente" && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-rose-700">
                  <Inbox className="size-3" />
                  Aún sin reponer
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
