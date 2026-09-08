"use client"

/**
 * Inventario de piezas extra, dentro del módulo de Marker Digital.
 *
 * Acumula lo que registran Marker y Corte. Las dos fuentes se muestran por
 * separado a propósito: las de Marker son una cantidad proyectada sin talla
 * —al trazar aún no se sabe qué va a sobrar—, mientras que las de Corte ya
 * están identificadas por pedido, talla y referencia. Mezclarlas en un solo
 * total daría una cifra que no se puede usar para buscar una pieza concreta.
 */

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Boxes,
  Layers,
  PackageSearch,
  RefreshCw,
  Ruler,
  Scissors,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  cambiarEstadoPieza,
  cargarPiezasExtra,
  resumir,
  type PiezaExtra,
} from "@/lib/marker/piezas-extra"

function fmt(v: string | null): string {
  if (!v) return "—"
  const [y, m, d] = String(v).slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

export function MarkerPiezasExtraTab() {
  const [piezas, setPiezas] = useState<PiezaExtra[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState("")
  const [dandoBaja, setDandoBaja] = useState<number | null>(null)

  const cargar = async () => {
    setCargando(true)
    setPiezas(await cargarPiezasExtra())
    setCargando(false)
  }
  useEffect(() => {
    void cargar()
  }, [])

  const resumen = useMemo(() => resumir(piezas), [piezas])

  const disponibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return piezas
      .filter((p) => p.estado === "disponible")
      .filter(
        (p) =>
          !q ||
          [p.pedido, p.talla, p.referencia, p.tela]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      )
  }, [piezas, filtro])

  const darDeBaja = async (p: PiezaExtra) => {
    setDandoBaja(p.id)
    const r = await cambiarEstadoPieza(p.id, "usada")
    setDandoBaja(null)
    if (r.success) {
      toast.success("Pieza marcada como usada")
      await cargar()
    } else {
      toast.error("No se pudo actualizar", { description: r.error })
    }
  }

  if (cargando)
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-32 w-full" />
      </Card>
    )

  return (
    <div className="space-y-4">
      {/* Totales: las dos fuentes por separado */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
            <Layers className="size-3.5" />
            Disponibles
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {resumen.disponibles}
          </p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
            <Ruler className="size-3.5" />
            Desde Marker
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {resumen.desdeMarker}
          </p>
          <p className="text-[10px] text-slate-400">sin talla asignada</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
            <Scissors className="size-3.5" />
            Desde Corte
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {resumen.desdeCorte}
          </p>
          <p className="text-[10px] text-slate-400">identificadas</p>
        </Card>
      </div>

      {/* Acumulado por referencia y talla: lo que sirve para buscar */}
      {resumen.porTipo.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <PackageSearch className="size-4 text-icon-cyan" />
            Disponible por referencia y talla
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {resumen.porTipo.map((t) => (
              <Badge
                key={`${t.referencia}-${t.talla}`}
                variant="outline"
                className="gap-1 text-[11px]"
              >
                {t.referencia}
                <span className="text-slate-400">·</span>
                {t.talla}
                <strong className="ml-0.5 font-semibold">×{t.cantidad}</strong>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Detalle */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Boxes className="size-4 text-icon-cyan" />
          <span className="font-semibold text-slate-800">
            Piezas disponibles
          </span>
          <Badge variant="outline" className="text-[11px]">
            {disponibles.length}
          </Badge>
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por pedido, talla o referencia…"
            className="ml-auto h-8 w-64 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void cargar()}
            className="h-8"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Actualizar
          </Button>
        </div>

        {disponibles.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {piezas.length === 0
              ? "Aún no se han registrado piezas extra."
              : "Ninguna pieza coincide con la búsqueda."}
          </p>
        ) : (
          <div className="max-h-[60dvh] overflow-auto">
            <Table className="min-w-[46rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead className="text-right">Pcs</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disponibles.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/60">
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {fmt(p.fecha)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          p.origen === "marker"
                            ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                            : "border-emerald-300 bg-emerald-50 text-emerald-800"
                        )}
                      >
                        {p.origen === "marker" ? "Marker" : "Corte"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {p.pedido ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {p.referencia ?? (
                        <span className="text-xs italic text-slate-400">
                          sin identificar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      {p.talla ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {p.tela ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-800">
                      {p.cantidad}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={dandoBaja === p.id}
                        onClick={() => void darDeBaja(p)}
                        className="h-7 text-xs text-slate-500 hover:text-rose-600"
                        title="Marcar como usada"
                      >
                        <X className="mr-1 size-3.5" />
                        Usar
                      </Button>
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
