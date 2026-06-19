"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarClock, Truck, TrendingUp, TrendingDown } from "lucide-react"
import {
  type IndicadoresFiltro,
  MES_TODOS,
  fmtDec,
  fmtInt,
  supabase,
} from "./shared"

interface Props {
  filtro: IndicadoresFiltro
}

interface CabeceraFila {
  fecha_de_ingreso: string | null
  fecha_de_entrega: string | null
  fecha_entrega_cliente: string | null
  entregado_cliente_si_no: boolean | null
}

const truthy = (v: unknown) =>
  v === true || String(v ?? "").trim().toLowerCase() === "true"

/** Fecha UTC a medianoche desde "YYYY-MM-DD..."; null si es invalida. */
function toUTCDate(value: string | null): Date | null {
  if (!value) return null
  const s = value.slice(0, 10)
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

/** Numero de semana ISO 8601 (1-53). */
function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Dias entre dos fechas (fin - inicio). null si falta alguna. */
function diffDias(inicio: Date | null, fin: Date | null): number | null {
  if (!inicio || !fin) return null
  return Math.round((fin.getTime() - inicio.getTime()) / 86400000)
}

export function AdherenciaTiempos({ filtro }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filas, setFilas] = useState<CabeceraFila[]>([])

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .schema("telas")
        .from("cabecera")
        .select(
          "fecha_de_ingreso, fecha_de_entrega, fecha_entrega_cliente, entregado_cliente_si_no"
        )
      if (cancelado) return
      if (err) {
        setError(err.message)
        setFilas([])
      } else {
        setFilas((data as CabeceraFila[]) ?? [])
      }
      setLoading(false)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  const { prometido, real, gap, conteo } = useMemo(() => {
    let sumProm = 0
    let nProm = 0
    let sumReal = 0
    let nReal = 0
    let conteo = 0

    for (const f of filas) {
      // Solo ordenes entregadas al cliente.
      if (!truthy(f.entregado_cliente_si_no)) continue
      const ingreso = toUTCDate(f.fecha_de_ingreso)
      const comprometida = toUTCDate(f.fecha_de_entrega)
      const realFecha = toUTCDate(f.fecha_entrega_cliente)
      if (!realFecha) continue

      // El periodo de la orden se define por su fecha REAL de entrega.
      if (realFecha.getUTCFullYear() !== filtro.ano) continue
      if (filtro.mes !== MES_TODOS && realFecha.getUTCMonth() + 1 !== filtro.mes)
        continue
      if (
        filtro.semanas.length > 0 &&
        !filtro.semanas.includes(getISOWeek(realFecha))
      )
        continue

      conteo += 1

      // Tiempo prometido = fecha comprometida - ingreso (sin negativos).
      const dProm = diffDias(ingreso, comprometida)
      if (dProm !== null && dProm >= 0) {
        sumProm += dProm
        nProm += 1
      }
      // Tiempo real = entrega al cliente - ingreso (sin negativos).
      const dReal = diffDias(ingreso, realFecha)
      if (dReal !== null && dReal >= 0) {
        sumReal += dReal
        nReal += 1
      }
    }

    const prometido = nProm > 0 ? sumProm / nProm : 0
    const real = nReal > 0 ? sumReal / nReal : 0
    return { prometido, real, gap: real - prometido, conteo }
  }, [filas, filtro])

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Tiempo promedio prometido al cliente */}
      <Card className="flex items-center gap-4 p-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tiempo prometido al cliente
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className="text-2xl font-bold text-slate-800">
              {fmtDec(prometido)}{" "}
              <span className="text-sm font-medium text-slate-500">dias</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Promedio desde ingreso a fecha comprometida
          </p>
        </div>
      </Card>

      {/* Tiempo real de entrega + brecha contra la meta */}
      <Card className="flex items-center gap-4 p-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
          <Truck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tiempo real de entrega
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className="text-2xl font-bold text-slate-800">
              {fmtDec(real)}{" "}
              <span className="text-sm font-medium text-slate-500">dias</span>
            </p>
          )}
          {loading ? null : (
            <p
              className={`flex items-center gap-1 text-xs font-medium ${
                gap > 0
                  ? "text-rose-600"
                  : gap < 0
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {gap > 0 ? (
                <TrendingUp className="size-3.5" />
              ) : gap < 0 ? (
                <TrendingDown className="size-3.5" />
              ) : null}
              {gap > 0
                ? `${fmtDec(gap)} dias por encima de lo prometido`
                : gap < 0
                  ? `${fmtDec(Math.abs(gap))} dias bajo lo prometido`
                  : "En linea con lo prometido"}
            </p>
          )}
        </div>
      </Card>

      {error && (
        <p className="text-xs text-rose-600 sm:col-span-2">
          Error al cargar tiempos: {error}
        </p>
      )}
      {!loading && !error && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Basado en {fmtInt(conteo)} ordenes entregadas al cliente en el periodo
          seleccionado.
        </p>
      )}
    </div>
  )
}
