"use client"

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
} from "lucide-react"
import { supabase, fmtInt, fmtPct, num } from "./shared"

interface Props {
  ano: number
  mes: number // 1-12
  label: string
  onClose: () => void
}

interface OrdenDetalle {
  pedido: string | null
  cliente: string | null
  estilo_de_la_prenda: string | null
  pcs: number | null
  fecha_de_entrega: string | null
  fecha_entrega_cliente: string | null
  entregado_cliente_si_no: boolean | null
}

/** Extrae {y,m,d} de una fecha "YYYY-MM-DD..." de forma tolerante. */
function ymd(value: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null
  const s = value.slice(0, 10)
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

/** Numero comparable (YYYYMMDD) a partir de una fecha. */
function dayNum(value: string | null): number | null {
  const p = ymd(value)
  return p ? p.y * 10000 + p.m * 100 + p.d : null
}

/** Formatea "YYYY-MM-DD" -> "DD/MM/YYYY"; "—" si es nula. */
function fmtDate(value: string | null): string {
  const p = ymd(value)
  if (!p) return "—"
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`
}

const truthy = (v: unknown) =>
  v === true || String(v ?? "").trim().toLowerCase() === "true"

export function AdherenciaDetallePanel({ ano, mes, label, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ordenes, setOrdenes] = useState<OrdenDetalle[]>([])

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .schema("telas")
        .from("cabecera")
        .select(
          "pedido, cliente, estilo_de_la_prenda, pcs, fecha_de_entrega, fecha_entrega_cliente, entregado_cliente_si_no"
        )
      if (cancelado) return
      if (err) {
        setError(err.message)
        setOrdenes([])
      } else {
        // El periodo de una orden se define por su fecha REAL de entrega al
        // cliente (fecha_entrega_cliente). Solo se incluyen las entregadas.
        const filtradas = ((data as OrdenDetalle[]) ?? []).filter((o) => {
          if (!truthy(o.entregado_cliente_si_no)) return false
          const p = ymd(o.fecha_entrega_cliente)
          return !!p && p.y === ano && p.m === mes
        })
        setOrdenes(filtradas)
      }
      setLoading(false)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [ano, mes])

  // Clasifica cada orden y ordena por fecha real de entrega.
  const filas = useMemo(() => {
    return ordenes
      .map((o) => {
        const comprometida = dayNum(o.fecha_de_entrega)
        const real = dayNum(o.fecha_entrega_cliente)
        // A tiempo: entregada en o antes de la fecha comprometida.
        const aTiempo =
          comprometida !== null && real !== null && real <= comprometida
        return { ...o, aTiempo, orden: real ?? 0 }
      })
      .sort((a, b) => a.orden - b.orden)
  }, [ordenes])

  const total = filas.length
  const aTiempo = filas.filter((f) => f.aTiempo).length
  const adherencia = total > 0 ? (aTiempo / total) * 100 : 0

  const exportar = () => {
    const headers = [
      "# Orden",
      "Cliente",
      "Estilo",
      "Pcs",
      "Fecha compromiso",
      "Entrega real",
      "Estado",
    ]
    const data = filas.map((f) => [
      f.pedido ?? "",
      f.cliente ?? "",
      f.estilo_de_la_prenda ?? "",
      num(f.pcs),
      fmtDate(f.fecha_de_entrega),
      fmtDate(f.fecha_entrega_cliente),
      f.aTiempo ? "A tiempo" : "Tarde",
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
            Ordenes entregadas al cliente en el periodo. A tiempo = entrega real
            menor o igual a la fecha comprometida.
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

      {/* Resumen del calculo */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
          <span className="text-slate-500">Entregadas: </span>
          <span className="font-semibold text-slate-800">{fmtInt(total)}</span>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm">
          <span className="text-emerald-600">A tiempo: </span>
          <span className="font-semibold text-emerald-700">
            {fmtInt(aTiempo)}
          </span>
        </div>
        <div className="rounded-lg bg-rose-50 px-3 py-1.5 text-sm">
          <span className="text-rose-600">Tarde: </span>
          <span className="font-semibold text-rose-700">
            {fmtInt(total - aTiempo)}
          </span>
        </div>
        <div className="ml-auto rounded-lg bg-slate-900 px-3 py-1.5 text-sm">
          <span className="text-white/60">Adherencia: </span>
          <span className="font-semibold text-white">{fmtPct(adherencia)}</span>
        </div>
      </div>

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
            No hay ordenes entregadas al cliente en este periodo.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead># Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estilo</TableHead>
                <TableHead className="text-right">Pcs</TableHead>
                <TableHead className="text-right">Fecha compromiso</TableHead>
                <TableHead className="text-right">Entrega real</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, i) => (
                <TableRow
                  key={`${f.pedido}-${i}`}
                  className="hover:bg-slate-50/60"
                >
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
                    {fmtDate(f.fecha_entrega_cliente)}
                  </TableCell>
                  <TableCell className="text-center">
                    {f.aTiempo ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle2 className="mr-1 size-3" />A tiempo
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-rose-300 bg-rose-50 text-rose-700"
                      >
                        <Clock className="mr-1 size-3" />
                        Tarde
                      </Badge>
                    )}
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
