"use client"

/**
 * Incidencias que NO generan reposición: los errores que un área detecta y
 * reporta ANTES de trabajar la orden, para que el área responsable corrija.
 *
 * Ejemplo del flujo real: Impresión recibe una orden de Diseño, la revisa,
 * encuentra un error y lo reporta sin marcar reposición; Diseño corrige y
 * recién ahí se imprime. Lo mismo hace Sublimación antes de sublimar.
 *
 * No son reprocesos: son reprocesos EVITADOS. Por eso viven aparte del resto
 * de la pestaña, que mide las incidencias que sí obligaron a reponer.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle, ShieldCheck, Search, Wrench } from "lucide-react"
import { fetchAll } from "@/lib/fetch-all"
import {
  supabase,
  fmtInt,
  fmtPct,
  MES_TODOS,
  MESES,
  PALETA,
  type IndicadoresFiltro,
} from "./shared"

interface IncidenciaSinRepo {
  id: number | string
  pedido: string | null
  /** Área que detectó y reportó el problema. */
  area_reporta: string | null
  /** Área responsable del error. */
  area_genera: string | null
  motivo_especifico: string | null
  descripcion: string | null
  fecha_reporte: string | null
  genera_reposicion: boolean | null
}

const COLUMNAS =
  "id, pedido, area_reporta, area_genera, motivo_especifico, descripcion, " +
  "fecha_reporte, genera_reposicion"

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const [y, m, d] = String(v).slice(0, 10).split("-")
  if (!y || !m || !d) return "—"
  return `${d}/${m}/${y}`
}

/** Cuenta ocurrencias de un campo y devuelve el top N ordenado. */
function ranking(
  filas: IncidenciaSinRepo[],
  campo: keyof IncidenciaSinRepo,
  limite = 10
): { name: string; count: number }[] {
  const c = new Map<string, number>()
  for (const f of filas) {
    const k = String(f[campo] ?? "").trim() || "Sin especificar"
    c.set(k, (c.get(k) ?? 0) + 1)
  }
  return Array.from(c.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limite)
}

function MiniRanking({
  titulo,
  ayuda,
  icono: Icono,
  datos,
  color,
}: {
  titulo: string
  ayuda: string
  icono: typeof Search
  datos: { name: string; count: number }[]
  color: string
}) {
  return (
    <Card className="p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Icono className="size-4" style={{ color }} />
        {titulo}
      </h4>
      <p className="mb-3 text-xs text-muted-foreground">{ayuda}</p>
      {datos.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Sin datos en el periodo.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, datos.length * 32)}>
          <BarChart
            data={datos}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: "#475569" }}
            />
            <Tooltip
              formatter={(v: number) => [fmtInt(v), "Incidencias"]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Bar dataKey="count" fill={color} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export function ReprocesosSinReposicion({ filtro }: { filtro: IndicadoresFiltro }) {
  const [todas, setTodas] = useState<IncidenciaSinRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      setError(null)
      // Paginado: `incidencias` puede pasar de 1000 filas y truncarla
      // falsearia el conteo en silencio.
      const { data, error: err } = await fetchAll<IncidenciaSinRepo>((from, to) =>
        supabase
          .schema("telas")
          .from("incidencias")
          .select(COLUMNAS)
          .gte("fecha_reporte", `${filtro.ano}-01-01`)
          .lte("fecha_reporte", `${filtro.ano}-12-31`)
          .range(from, to) as unknown as PromiseLike<{
          data: IncidenciaSinRepo[] | null
          error: { message: string } | null
        }>
      )
      if (cancelado) return
      if (err) {
        setError(err.message)
        setTodas([])
      } else {
        setTodas(data ?? [])
      }
      setLoading(false)
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [filtro.ano])

  /** Recorte por mes y separación entre las que reponen y las que no. */
  const { sinRepo, conRepo } = useMemo(() => {
    const delPeriodo = todas.filter((i) => {
      if (filtro.mes === MES_TODOS) return true
      const m = Number(String(i.fecha_reporte ?? "").slice(5, 7))
      return m === filtro.mes
    })
    return {
      sinRepo: delPeriodo.filter((i) => !i.genera_reposicion),
      conRepo: delPeriodo.filter((i) => i.genera_reposicion),
    }
  }, [todas, filtro])

  const total = sinRepo.length + conRepo.length
  const pctEvitado = total > 0 ? (sinRepo.length / total) * 100 : 0

  const porDetecta = useMemo(() => ranking(sinRepo, "area_reporta"), [sinRepo])
  const porGenera = useMemo(() => ranking(sinRepo, "area_genera"), [sinRepo])
  const porMotivo = useMemo(() => ranking(sinRepo, "motivo_especifico", 8), [sinRepo])

  const filas = useMemo(
    () =>
      [...sinRepo].sort((a, b) =>
        String(b.fecha_reporte ?? "").localeCompare(String(a.fecha_reporte ?? ""))
      ),
    [sinRepo]
  )

  const periodo =
    filtro.mes === MES_TODOS
      ? `${filtro.ano}`
      : `${MESES[filtro.mes - 1]} ${filtro.ano}`

  if (loading)
    return (
      <Card className="space-y-2 p-4">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )

  if (error)
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-rose-600">
        <AlertCircle className="size-4" />
        No se pudieron cargar las incidencias: {error}
      </Card>
    )

  return (
    <div className="space-y-4">
      {/* Encabezado con la lectura del indicador */}
      <Card className="flex flex-col items-start justify-between gap-4 border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10">
            <ShieldCheck className="size-6 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Incidencias sin reposición — {periodo}
            </p>
            <p className="max-w-2xl text-xs text-emerald-800/80">
              Errores que un área detectó y reportó antes de trabajar la orden,
              para que el responsable corrigiera. No obligaron a reponer: son
              reprocesos evitados.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold text-emerald-700">
            {fmtInt(sinRepo.length)}
          </p>
          <p className="text-xs text-emerald-800/80">
            {fmtPct(pctEvitado)} de {fmtInt(total)} incidencias del periodo
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <MiniRanking
          titulo="Quién lo detecta"
          ayuda="Área que revisó y reportó el problema antes de continuar."
          icono={Search}
          datos={porDetecta}
          color={PALETA.teal}
        />
        <MiniRanking
          titulo="Quién lo origina"
          ayuda="Área responsable del error que hubo que corregir."
          icono={Wrench}
          datos={porGenera}
          color={PALETA.amber}
        />
      </div>

      <MiniRanking
        titulo="Motivos más frecuentes"
        ayuda="Qué se está encontrando en esos filtros previos."
        icono={AlertCircle}
        datos={porMotivo}
        color={PALETA.indigo}
      />

      {/* Detalle */}
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold text-slate-800">
          Detalle de incidencias sin reposición
        </h4>
        <p className="mb-3 text-xs text-muted-foreground">
          {fmtInt(filas.length)} reporte{filas.length !== 1 ? "s" : ""} en{" "}
          {periodo}, del más reciente al más antiguo.
        </p>
        {filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay incidencias sin reposición en el periodo.
          </p>
        ) : (
          <div className="max-h-[60dvh] overflow-auto">
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Detecta</TableHead>
                  <TableHead>Origina</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.id} className="hover:bg-slate-50/60">
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {fmtDate(f.fecha_reporte)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {f.pedido ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-teal-300 bg-teal-50 text-[11px] text-teal-800"
                      >
                        {f.area_reporta ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-[11px] text-amber-800"
                      >
                        {f.area_genera ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {f.motivo_especifico || "—"}
                    </TableCell>
                    <TableCell className="max-w-[24rem] text-slate-600">
                      <span className="line-clamp-2">{f.descripcion || "—"}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
