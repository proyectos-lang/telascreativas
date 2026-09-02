"use client"

/**
 * Detalle de adherencia de un periodo, orden por orden.
 *
 * Muestra las DOS adherencias sobre el mismo universo (las órdenes empacadas
 * en el periodo), para poder ver dónde se pierde el compromiso:
 *   - Operativa: planta terminó a tiempo (empaque <= compromiso).
 *   - Final: el cliente recibió a tiempo (entrega <= compromiso).
 * Ver lib/indicadores/adherencia.ts para las definiciones.
 */

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  X,
  Truck,
  Factory,
} from "lucide-react"
import { fmtInt, fmtPct, num } from "./shared"
import {
  cargarOrdenesEmpacadas,
  clasificar,
  dayNum,
  mesDeEmpaque,
  resumir,
  type OrdenAdherencia,
} from "@/lib/indicadores/adherencia"

interface Props {
  ano: number
  mes: number // 1-12
  label: string
  onClose: () => void
}

/** Formatea "YYYY-MM-DD" -> "DD/MM/YYYY"; "—" si es nula. */
function fmtDate(value: string | null): string {
  if (!value) return "—"
  const [y, m, d] = String(value).slice(0, 10).split("-")
  if (!y || !m || !d) return "—"
  return `${d}/${m}/${y}`
}

function EstadoBadge({
  aTiempo,
  pendiente,
}: {
  aTiempo: boolean
  pendiente?: boolean
}) {
  if (pendiente)
    return (
      <Badge variant="outline" className="border-slate-300 text-slate-500">
        Sin entregar
      </Badge>
    )
  return aTiempo ? (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-50 text-emerald-700"
    >
      <CheckCircle2 className="mr-1 size-3" />A tiempo
    </Badge>
  ) : (
    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700">
      <Clock className="mr-1 size-3" />
      Tarde
    </Badge>
  )
}

export function AdherenciaDetallePanel({ ano, mes, label, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ordenes, setOrdenes] = useState<OrdenAdherencia[]>([])

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await cargarOrdenesEmpacadas(ano)
      if (cancelado) return
      if (err) {
        setError(err)
        setOrdenes([])
      } else {
        setOrdenes(data.filter((o) => mesDeEmpaque(o) === mes))
      }
      setLoading(false)
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [ano, mes])

  // Ordenadas por fecha de empaque.
  const filas = useMemo(
    () =>
      ordenes
        .map((o) => ({ ...o, c: clasificar(o) }))
        .sort(
          (a, b) =>
            (dayNum(a.efecha_de_empaque) ?? 0) -
            (dayNum(b.efecha_de_empaque) ?? 0)
        ),
    [ordenes]
  )

  const r = useMemo(() => resumir(ordenes), [ordenes])

  const exportar = () => {
    const headers = [
      "# Orden",
      "Cliente",
      "Estilo",
      "Pcs",
      "Fecha compromiso",
      "Fin de empaque",
      "Entrega al cliente",
      "Adherencia operativa",
      "Adherencia final",
    ]
    const data = filas.map((f) => [
      f.pedido ?? "",
      f.cliente ?? "",
      f.estilo_de_la_prenda ?? "",
      num(f.pcs),
      fmtDate(f.fecha_de_entrega),
      fmtDate(f.efecha_de_empaque),
      fmtDate(f.fecha_entrega_cliente),
      f.c.operativaATiempo ? "A tiempo" : "Tarde",
      !f.c.entregada ? "Sin entregar" : f.c.finalATiempo ? "A tiempo" : "Tarde",
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Detalle adherencia")
    const limpio = label.toLowerCase().replace(/\s+/g, "-")
    XLSX.writeFile(wb, `detalle-adherencia-${limpio}-${ano}.xlsx`)
  }

  return (
    <Card className="border-slate-200 p-4 lg:p-6">
      {/* Encabezado con acciones */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Detalle de adherencia — {label}
          </h3>
          <p className="text-xs text-muted-foreground">
            Órdenes empacadas en el periodo. Operativa = empaque dentro del
            compromiso; final = entrega al cliente dentro del compromiso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportar}
            disabled={loading || filas.length === 0}
          >
            <Download className="mr-1.5 size-4" />
            Excel
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 size-4" />
            Cerrar
          </Button>
        </div>
      </div>

      {/* Resumen: las dos adherencias sobre el mismo universo */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Factory className="size-3.5" />
            Operativa (planta)
          </p>
          <p className="text-3xl font-bold text-slate-800">
            {fmtPct(r.operativa)}
          </p>
          <p className="text-xs text-slate-500">
            {fmtInt(r.operativaATiempo)} a tiempo de {fmtInt(r.total)} empacadas
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Truck className="size-3.5" />
            Final (cliente)
          </p>
          <p className="text-3xl font-bold text-slate-800">{fmtPct(r.final)}</p>
          <p className="text-xs text-slate-500">
            {fmtInt(r.finalATiempo)} a tiempo de {fmtInt(r.entregadas)} entregadas
            {r.total > r.entregadas && (
              <> · {fmtInt(r.total - r.entregadas)} aún sin entregar</>
            )}
          </p>
        </div>
      </div>

      {r.perdidasEnEntrega > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>{fmtInt(r.perdidasEnEntrega)}</strong> órdenes salieron de
          planta dentro del compromiso pero llegaron tarde al cliente. Esa brecha
          no es de producción: se pierde después de empacar.
        </p>
      )}

      {/* Tabla de ordenes */}
      <div className="max-h-[60vh] overflow-auto">
        {loading ? (
          <div className="space-y-2 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-8 text-sm text-rose-600">
            <AlertCircle className="size-4" />
            Error al cargar el detalle: {error}
          </div>
        ) : filas.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No hay órdenes empacadas en este periodo.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead># Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estilo</TableHead>
                <TableHead className="text-right">Pcs</TableHead>
                <TableHead className="text-right">Compromiso</TableHead>
                <TableHead className="text-right">Fin empaque</TableHead>
                <TableHead className="text-center">Operativa</TableHead>
                <TableHead className="text-right">Entrega cliente</TableHead>
                <TableHead className="text-center">Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, i) => (
                <TableRow key={`${f.pedido}-${i}`} className="hover:bg-slate-50/60">
                  <TableCell className="font-medium text-slate-800">
                    {f.pedido ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {f.cliente ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {f.estilo_de_la_prenda ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-slate-700">
                    {fmtInt(num(f.pcs))}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {fmtDate(f.fecha_de_entrega)}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {fmtDate(f.efecha_de_empaque)}
                  </TableCell>
                  <TableCell className="text-center">
                    <EstadoBadge aTiempo={f.c.operativaATiempo} />
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {fmtDate(f.fecha_entrega_cliente)}
                  </TableCell>
                  <TableCell className="text-center">
                    <EstadoBadge
                      aTiempo={f.c.finalATiempo}
                      pendiente={!f.c.entregada}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  )
}
