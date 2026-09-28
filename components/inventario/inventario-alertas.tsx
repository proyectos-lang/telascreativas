"use client"

/**
 * Alertas de compra de tela.
 *
 * Para cada referencia: existencia, comprometido con órdenes ya
 * programadas, ritmo de consumo, días de cobertura, fecha estimada de
 * agotamiento y cuánto pedir.
 *
 * Las tres limitaciones del cálculo se dicen en pantalla —la conversión
 * de piezas a yardas, las telas que no concilian y las que no tienen
 * ritmo calculable— porque un número de compra que parezca exacto
 * cuando es una estimación lleva a pedir de más o de menos.
 */

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  Download,
  Info,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  cargarAlertas,
  COBERTURA_CRITICA,
  DIAS_OBJETIVO,
  DIAS_VENTANA,
  type AlertaTela,
  type ResumenAlertas,
} from "@/lib/inventario/alertas"

const yd = (n: number, dec = 1) =>
  n.toLocaleString("es-CO", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })

function fmtFecha(v: string | null) {
  if (!v) return "—"
  const [y, m, d] = v.split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

const COLOR: Record<string, string> = {
  critico: "border-rose-300 bg-rose-50 text-rose-800",
  atencion: "border-amber-300 bg-amber-50 text-amber-800",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
  "sin-datos": "border-slate-200 bg-slate-50 text-slate-500",
}

const ETIQUETA: Record<string, string> = {
  critico: "Comprar ya",
  atencion: "Vigilar",
  ok: "Suficiente",
  "sin-datos": "Sin consumo",
}

export function InventarioAlertas() {
  const [alertas, setAlertas] = useState<AlertaTela[]>([])
  const [resumen, setResumen] = useState<ResumenAlertas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [soloAlertas, setSoloAlertas] = useState(true)

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await cargarAlertas()
      setAlertas(r.alertas)
      setResumen(r.resumen)
    } catch (e) {
      toast.error("No se pudieron calcular las alertas", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    void cargar()
  }, [])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return alertas
      .filter((a) => !soloAlertas || a.nivel === "critico" || a.nivel === "atencion")
      .filter(
        (a) =>
          !q ||
          `${a.tela} ${a.colores.join(" ")}`.toLowerCase().includes(q)
      )
  }, [alertas, busqueda, soloAlertas])

  const totalSugerido = useMemo(
    () =>
      Math.round(
        alertas
          .filter((a) => a.nivel === "critico")
          .reduce((s, a) => s + a.sugerido, 0) * 100
      ) / 100,
    [alertas]
  )

  const exportar = () => {
    if (visibles.length === 0) {
      toast.error("No hay filas que exportar")
      return
    }
    const hoja = XLSX.utils.json_to_sheet(
      visibles.map((a) => ({
        Tela: a.tela,
        Colores: a.colores.join(", "),
        "Inventario (yd)": a.stock,
        "Comprometido (yd)": a.comprometido,
        "Piezas comprometidas": a.piezasComprometidas,
        "Disponible (yd)": a.disponible,
        "Consumo/día (yd)": a.consumoDia,
        "Cobertura (días)": a.coberturaDias ?? "",
        "Se agota": a.fechaAgotamiento ?? "",
        "Sugerido pedir (yd)": a.sugerido,
        Estado: ETIQUETA[a.nivel],
      }))
    )
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, "Alertas")
    XLSX.writeFile(
      libro,
      `alertas-compra-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
    toast.success(`${visibles.length} referencias exportadas`)
  }

  if (cargando)
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          icono={<AlertTriangle className="size-3.5 text-rose-600" />}
          titulo="Comprar ya"
          valor={String(resumen?.criticas ?? 0)}
          pie={`menos de ${COBERTURA_CRITICA} días`}
          clase="text-rose-700"
        />
        <Tarjeta
          icono={<TrendingDown className="size-3.5 text-amber-600" />}
          titulo="Vigilar"
          valor={String(resumen?.atencion ?? 0)}
          pie={`${COBERTURA_CRITICA}–${COBERTURA_CRITICA * 2} días`}
        />
        <Tarjeta
          icono={<ShoppingCart className="size-3.5 text-cyan-600" />}
          titulo="Sugerido a pedir"
          valor={yd(totalSugerido)}
          pie="yardas de las críticas"
        />
        <Tarjeta
          icono={<Package className="size-3.5" />}
          titulo="Sin consumo"
          valor={String(resumen?.sinDatos ?? 0)}
          pie="sin ritmo calculable"
        />
      </div>

      {/* Los supuestos del calculo, dichos antes de la tabla: un numero
          de compra que parezca exacto cuando es estimacion lleva a pedir
          de mas o de menos. */}
      <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          <span>
            El <strong>comprometido</strong> sale del detalle de las órdenes
            aprobadas sin cortar, que está en piezas; se convierte a yardas con
            el rendimiento real de lo ya cortado (
            <strong>{resumen?.rendimiento} yd/pieza</strong>, sobre{" "}
            {resumen?.ordenesRendimiento} órdenes). Es una estimación.
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          <span>
            El <strong>consumo por día</strong> es el promedio de las salidas
            de los últimos {DIAS_VENTANA} días. El{" "}
            <strong>sugerido</strong> es lo que falta para tener{" "}
            {DIAS_OBJETIVO} días de cobertura.
          </span>
        </p>
        {resumen && resumen.sinConciliar.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <span>
              <strong>{resumen.sinConciliar.length} telas</strong> de las
              órdenes no encuentran su referencia en inventario, así que su
              compromiso no está contado en ninguna fila:{" "}
              {resumen.sinConciliar.slice(0, 6).join(", ")}
              {resumen.sinConciliar.length > 6 ? "…" : ""}
            </span>
          </p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <Label className="text-xs">Buscar tela</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o color…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            variant={soloAlertas ? "default" : "outline"}
            onClick={() => setSoloAlertas((v) => !v)}
            className="h-8"
          >
            <AlertTriangle className="mr-1.5 size-3.5" />
            Solo con alerta
          </Button>
          <Button size="sm" variant="outline" onClick={exportar} className="h-8">
            <Download className="mr-1.5 size-3.5" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void cargar()}
            className="h-8"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {visibles.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {soloAlertas
              ? "Ninguna tela está por debajo del umbral. Quita el filtro para ver todas."
              : "Ninguna tela coincide con la búsqueda."}
          </p>
        ) : (
          <div className="max-h-[60dvh] overflow-auto">
            <Table className="min-w-[74rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Tela</TableHead>
                  <TableHead className="text-right">Inventario</TableHead>
                  <TableHead className="text-right">Comprometido</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Consumo/día</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead>Se agota</TableHead>
                  <TableHead className="text-right">Sugerido</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((a) => (
                  <TableRow key={a.clave} className="hover:bg-slate-50/60">
                    <TableCell className="max-w-[18rem] font-medium text-slate-800">
                      <span className="block truncate">{a.tela}</span>
                      {/* Los colores se agrupan: el detalle del pedido no
                          dice cual, asi que el compromiso se compara
                          contra el stock de todos juntos. */}
                      {a.colores.length > 1 && (
                        <span className="text-[10px] font-normal text-slate-400">
                          {a.colores.length} colores · {a.colores.slice(0, 3).join(", ")}
                          {a.colores.length > 3 ? "…" : ""}
                        </span>
                      )}
                      {a.colores.length === 1 && (
                        <span className="text-[10px] font-normal text-slate-400">
                          {a.colores[0]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {yd(a.stock)}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums text-slate-600"
                      title={
                        a.piezasComprometidas > 0
                          ? `${a.piezasComprometidas} piezas de órdenes sin cortar`
                          : undefined
                      }
                    >
                      {a.comprometido > 0 ? yd(a.comprometido) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        a.disponible < 0 ? "text-rose-700" : "text-slate-800"
                      )}
                    >
                      {yd(a.disponible)}
                      {a.enDeficit && (
                        <span
                          className="ml-1 text-[10px] font-normal text-rose-500"
                          title="Comprometido mayor que el stock: puede ser que el nombre del pedido no concilie con el del inventario."
                        >
                          déficit
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {a.consumoDia > 0 ? yd(a.consumoDia, 2) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        a.nivel === "critico"
                          ? "text-rose-700"
                          : a.nivel === "atencion"
                            ? "text-amber-700"
                            : "text-slate-600"
                      )}
                    >
                      {a.coberturaDias !== null ? (
                        a.enDeficit ? (
                          <span title="El comprometido ya supera al stock. Revisa si el nombre de la tela concilia con el del pedido.">
                            0 d
                          </span>
                        ) : (
                          `${a.coberturaDias} d`
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600">
                      {a.fechaAgotamiento ? (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3 text-slate-400" />
                          {fmtFecha(a.fechaAgotamiento)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-cyan-700">
                      {a.sugerido > 0 ? yd(a.sugerido) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", COLOR[a.nivel])}
                      >
                        {ETIQUETA[a.nivel]}
                      </Badge>
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

function Tarjeta({
  icono,
  titulo,
  valor,
  pie,
  clase,
}: {
  icono?: React.ReactNode
  titulo: string
  valor: string
  pie?: string
  clase?: string
}) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
        {icono}
        {titulo}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums text-slate-800", clase)}>
        {valor}
      </p>
      {pie && <p className="text-[10px] text-slate-400">{pie}</p>}
    </Card>
  )
}
