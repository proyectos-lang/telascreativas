"use client"

/**
 * Consumo de tela: lo proyectado por Marker Digital contra lo gastado en
 * Corte.
 *
 * Dos vistas del mismo dato porque responden a preguntas distintas: la
 * auditoría busca la orden concreta que se desvió, el panel mira el
 * consumo agregado por tela y por semana.
 *
 * Una nota que atraviesa toda la pantalla: solo se puede comparar lo que
 * tiene AMBAS cifras. `cyardas` lleva tiempo registrándose pero
 * `mdyardas_teoricas` solo existe desde Marker Digital, así que la
 * cobertura es todavía parcial y se dice en pantalla en vez de presentar
 * un total que aparente cubrirlo todo.
 */

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Download,
  Info,
  Loader2,
  Package,
  RefreshCw,
  Ruler,
  Search,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { InventarioConsumoReal } from "./inventario-consumo-real"
import {
  cargarAuditoria,
  consumoPorSemana,
  consumoPorTela,
  resumir,
  TOLERANCIA_POR_DEFECTO,
  type FilaAuditoria,
} from "@/lib/inventario/auditoria-consumo"

const yd = (n: number | null | undefined, dec = 1) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("es-CO", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`

function fmtFecha(v: string | null) {
  if (!v) return "—"
  const [y, m, d] = v.split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

/** Color según qué tan lejos está del trazo. */
function colorDesvio(desvio: number | null, tolerancia: number) {
  if (desvio === null) return "text-slate-400"
  if (Math.abs(desvio) <= tolerancia) return "text-emerald-700"
  return desvio > 0 ? "text-rose-700" : "text-amber-700"
}

export function InventarioAuditoriaConsumo() {
  const [filas, setFilas] = useState<FilaAuditoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [tela, setTela] = useState("todas")
  const [soloDesviadas, setSoloDesviadas] = useState(false)
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_POR_DEFECTO)
  const [vista, setVista] = useState("real")

  const cargar = async () => {
    setCargando(true)
    try {
      setFilas(await cargarAuditoria())
    } catch (e) {
      toast.error("No se pudo cargar el consumo", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const telas = useMemo(
    () => [...new Set(filas.map((f) => f.tela))].sort(),
    [filas]
  )

  /** Comparables filtradas: es sobre lo que trabaja la auditoría. */
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas
      .filter((f) => f.diferencia !== null)
      .filter((f) => tela === "todas" || f.tela === tela)
      .filter(
        (f) =>
          !soloDesviadas || Math.abs(f.desvio ?? 0) > tolerancia
      )
      .filter(
        (f) =>
          !q ||
          [f.pedido, f.cliente, f.tela, f.coreNombre]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      )
      .sort((a, b) => Math.abs(b.desvio ?? 0) - Math.abs(a.desvio ?? 0))
  }, [filas, busqueda, tela, soloDesviadas, tolerancia])

  const resumen = useMemo(() => resumir(filas, tolerancia), [filas, tolerancia])
  const porTela = useMemo(() => consumoPorTela(filas), [filas])
  const porSemana = useMemo(() => consumoPorSemana(filas), [filas])

  const exportar = () => {
    if (visibles.length === 0) {
      toast.error("No hay filas que exportar")
      return
    }
    const hoja = XLSX.utils.json_to_sheet(
      visibles.map((f) => ({
        Pedido: f.pedido,
        Cliente: f.cliente ?? "",
        Marker: f.coreNombre ?? "",
        Tela: f.tela,
        "Fecha corte": f.fechaCorte ?? "",
        Semana: f.semana ?? "",
        "Piezas cortadas": f.piezasCortadas ?? "",
        "Yardas teóricas": f.teoricas ?? "",
        "Yardas reales": f.reales ?? "",
        Diferencia: f.diferencia ?? "",
        "Desvío %": f.desvio !== null ? Number(f.desvio.toFixed(2)) : "",
      }))
    )
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, "Consumo")
    XLSX.writeFile(
      libro,
      `consumo-tela-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
    toast.success(`${visibles.length} filas exportadas`)
  }

  if (cargando)
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const cobertura =
    resumen.conReal > 0
      ? (resumen.comparables / resumen.conReal) * 100
      : 0

  return (
    <div className="space-y-4">
      {/* La cobertura solo advierte sobre las vistas COMPARATIVAS. En
          "Consumo real" no hay nada parcial: estan todas las ordenes con
          yardas registradas. */}
      {vista !== "real" && resumen.comparables < resumen.conReal && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">
            Se pueden comparar{" "}
            <strong>{resumen.comparables} de {resumen.conReal}</strong> órdenes
            con consumo registrado ({cobertura.toFixed(0)}%). El resto no tiene
            yardas teóricas porque se cortó antes de Marker Digital o no pasó
            por él; esas órdenes sí cuentan en el consumo real del panel, pero
            no en las comparaciones.
          </p>
        </div>
      )}

      <Tabs value={vista} onValueChange={setVista}>
        <TabsList>
          <TabsTrigger value="real">
            <Package className="mr-1.5 size-3.5" />
            Consumo real
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <Search className="mr-1.5 size-3.5" />
            Auditoría vs marker
          </TabsTrigger>
          <TabsTrigger value="panel">
            <BarChart3 className="mr-1.5 size-3.5" />
            Panel comparativo
          </TabsTrigger>
        </TabsList>

        {/* Consumo real: TODAS las ordenes con yardas registradas, sin
            exigir que exista un teorico con el que compararlas. Va
            primero porque cubre la mayor parte del gasto de tela. */}
        <TabsContent value="real" className="mt-4">
          <InventarioConsumoReal
            filas={filas}
            onRecargar={() => void cargar()}
          />
        </TabsContent>

        {/* ───────────────── Auditoría ───────────────── */}
        <TabsContent value="auditoria" className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta
              titulo="Comparables"
              valor={String(resumen.comparables)}
              pie={`de ${resumen.cortadas} cortadas`}
            />
            <Tarjeta
              titulo="Teórico (marker)"
              valor={yd(resumen.totalTeorico)}
              pie="yardas"
            />
            <Tarjeta
              titulo="Real (corte)"
              valor={yd(resumen.totalReal)}
              pie="yardas"
            />
            <Tarjeta
              titulo="Desvío global"
              valor={pct(resumen.desvioGlobal)}
              pie={
                resumen.desvioGlobal === null
                  ? "sin datos"
                  : resumen.desvioGlobal > 0
                    ? "se gastó de más"
                    : "se gastó de menos"
              }
              clase={colorDesvio(resumen.desvioGlobal, tolerancia)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Semaforo
              icono={<ArrowUp className="size-3.5" />}
              etiqueta={`Sobre consumo (>${tolerancia}%)`}
              n={resumen.porEncima}
              clase="border-rose-200 bg-rose-50 text-rose-800"
            />
            <Semaforo
              icono={<Check className="size-3.5" />}
              etiqueta={`En rango (±${tolerancia}%)`}
              n={resumen.enRango}
              clase="border-emerald-200 bg-emerald-50 text-emerald-800"
            />
            <Semaforo
              icono={<ArrowDown className="size-3.5" />}
              etiqueta={`Bajo consumo (<-${tolerancia}%)`}
              n={resumen.porDebajo}
              clase="border-amber-200 bg-amber-50 text-amber-800"
            />
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-3">
              <div className="min-w-[14rem] flex-1 space-y-1">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Pedido, cliente, marker o tela…"
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tela</Label>
                <Select value={tela} onValueChange={setTela}>
                  <SelectTrigger className="h-8 w-52 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {telas.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tolerancia %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={tolerancia}
                  onChange={(e) =>
                    setTolerancia(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-8 w-24 text-sm"
                  title="Margen que se considera normal por orillos y empates"
                />
              </div>
              <Button
                size="sm"
                variant={soloDesviadas ? "default" : "outline"}
                onClick={() => setSoloDesviadas((v) => !v)}
                className="h-8"
              >
                <AlertTriangle className="mr-1.5 size-3.5" />
                Solo desviadas
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
                {resumen.comparables === 0
                  ? "Todavía no hay órdenes con yardas teóricas y reales para comparar."
                  : "Ninguna orden coincide con los filtros."}
              </p>
            ) : (
              <div className="max-h-[60dvh] overflow-auto">
                <Table className="min-w-[62rem]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Marker</TableHead>
                      <TableHead>Tela</TableHead>
                      <TableHead>Corte</TableHead>
                      <TableHead className="text-right">Pcs</TableHead>
                      <TableHead className="text-right">Teórico</TableHead>
                      <TableHead className="text-right">Real</TableHead>
                      <TableHead className="text-right">Dif.</TableHead>
                      <TableHead className="text-right">Desvío</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((f) => (
                      <TableRow key={f.pedido} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-800">
                          {f.pedido}
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate text-slate-600">
                          {f.cliente ?? "—"}
                        </TableCell>
                        <TableCell>
                          {f.coreNombre ? (
                            <Badge variant="outline" className="text-[10px]">
                              {f.coreNombre}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">{f.tela}</TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {fmtFecha(f.fechaCorte)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {f.piezasCortadas ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {yd(f.teoricas, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-slate-800">
                          {yd(f.reales, 2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            colorDesvio(f.desvio, tolerancia)
                          )}
                        >
                          {f.diferencia !== null && f.diferencia > 0 ? "+" : ""}
                          {yd(f.diferencia, 2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            colorDesvio(f.desvio, tolerancia)
                          )}
                        >
                          {pct(f.desvio)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ───────────────── Panel ───────────────── */}
        <TabsContent value="panel" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Ruler className="size-4 text-icon-cyan" />
                Consumo real por tela
              </CardTitle>
            </CardHeader>
            <CardContent>
              {porTela.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay consumo registrado.
                </p>
              ) : (
                <BarrasTela datos={porTela} tolerancia={tolerancia} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <BarChart3 className="size-4 text-icon-cyan" />
                Consumo por semana de corte
              </CardTitle>
            </CardHeader>
            <CardContent>
              {porSemana.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin semanas con consumo registrado.
                </p>
              ) : (
                <div className="max-h-[40dvh] overflow-auto">
                  <Table className="min-w-[34rem]">
                    <TableHeader>
                      <TableRow className="bg-slate-50/60">
                        <TableHead>Semana</TableHead>
                        <TableHead className="text-right">Órdenes</TableHead>
                        <TableHead className="text-right">Real</TableHead>
                        <TableHead className="text-right">Teórico</TableHead>
                        <TableHead className="text-right">Desvío</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porSemana.map((s) => {
                        const d =
                          s.teorico > 0
                            ? ((s.real - s.teorico) / s.teorico) * 100
                            : null
                        return (
                          <TableRow key={s.semana}>
                            <TableCell className="font-medium text-slate-800">
                              Semana {s.semana}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-600">
                              {s.ordenes}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-slate-800">
                              {yd(s.real)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-slate-600">
                              {s.comparables > 0 ? yd(s.teorico) : "—"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-semibold tabular-nums",
                                colorDesvio(d, tolerancia)
                              )}
                              title={
                                s.comparables > 0
                                  ? `Comparando ${s.comparables} de ${s.ordenes} órdenes`
                                  : "Ninguna orden de esta semana tiene yardas teóricas"
                              }
                            >
                              {pct(d)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Tarjeta({
  titulo,
  valor,
  pie,
  clase,
}: {
  titulo: string
  valor: string
  pie?: string
  clase?: string
}) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums text-slate-800", clase)}>
        {valor}
      </p>
      {pie && <p className="text-[10px] text-slate-400">{pie}</p>}
    </Card>
  )
}

function Semaforo({
  icono,
  etiqueta,
  n,
  clase,
}: {
  icono: React.ReactNode
  etiqueta: string
  n: number
  clase: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
        clase
      )}
    >
      {icono}
      <span className="flex-1">{etiqueta}</span>
      <span className="text-base font-bold tabular-nums">{n}</span>
    </div>
  )
}

/**
 * Barras de consumo por tela.
 *
 * Se dibuja con divs en vez de una librería de gráficas: son barras
 * proporcionales simples y traer una dependencia entera para esto
 * pesaría más de lo que aporta.
 */
function BarrasTela({
  datos,
  tolerancia,
}: {
  datos: ReturnType<typeof consumoPorTela>
  tolerancia: number
}) {
  const max = Math.max(...datos.map((d) => d.real), 1)
  return (
    <div className="space-y-2">
      {datos.map((d) => (
        <div key={d.tela} className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
              {d.tela}
            </span>
            <span className="tabular-nums text-slate-500">
              {d.ordenes} órd.
            </span>
            <span className="tabular-nums font-semibold text-slate-800">
              {yd(d.real)} yd
            </span>
            {d.comparables > 0 ? (
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  colorDesvio(d.desvio, tolerancia)
                )}
                title={`Comparando ${d.comparables} de ${d.ordenes} órdenes contra ${yd(d.teorico)} yd teóricas`}
              >
                {pct(d.desvio)}
              </span>
            ) : (
              <span
                className="text-slate-400"
                title="Ninguna orden de esta tela tiene yardas teóricas del marker"
              >
                sin comparar
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-cyan-500"
              style={{ width: `${(d.real / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
