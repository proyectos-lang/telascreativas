"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Search,
  PackageCheck,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  AlertTriangle,
} from "lucide-react"

// ─── Supabase ──────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const supabase = createClient(supabaseUrl, supabaseKey)

// Factor estandar de conversion: 1 metro = 1.09361 yardas
const METROS_A_YARDAS = 1.09361

const metrosAYardas = (metros: number) =>
  Math.round(metros * METROS_A_YARDAS * 100) / 100

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InventarioTela {
  id: number
  codigo: string | null
  tipo: string
  nombre: string
  color: string | null
  proveedor: string | null
  referencia_cliente: string | null
  ancho_pulgadas: number | null
  stock_metros: number
  stock_yardas: number
}

const TIPOS_TELA = [
  "Poliéster",
  "Licra",
  "Algodón",
  "Microfibra",
  "Nylon",
  "Lino",
  "Seda",
  "Denim",
  "Otro",
]

// ─── Hook de datos ─────────────────────────────────────────────────────────────

function useInventario() {
  const [telas, setTelas] = useState<InventarioTela[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTelas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .schema("telas")
      .from("inventario_telas")
      .select("*")
      .order("tipo", { ascending: true })
      .order("nombre", { ascending: true })
    if (error) {
      toast.error("Error al cargar inventario: " + error.message)
    } else {
      setTelas(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTelas()
  }, [])

  return { telas, loading, refetch: fetchTelas }
}

// ─── Tab 1: Stock Actual ───────────────────────────────────────────────────────

function StockActualTab({
  telas,
  loading,
}: {
  telas: InventarioTela[]
  loading: boolean
}) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return telas
    return telas.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.tipo.toLowerCase().includes(q) ||
        (t.codigo ?? "").toLowerCase().includes(q) ||
        (t.color ?? "").toLowerCase().includes(q) ||
        (t.proveedor ?? "").toLowerCase().includes(q) ||
        (t.referencia_cliente ?? "").toLowerCase().includes(q)
    )
  }, [telas, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Cargando inventario...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, nombre, color, proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Ancho (Pulg.)</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Ref. Cliente</TableHead>
              <TableHead className="text-right">Stock Metros</TableHead>
              <TableHead className="text-right">Stock Yardas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-10 text-muted-foreground"
                >
                  No se encontraron telas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tela) => {
                const sinStockM = tela.stock_metros <= 0
                const sinStockY = tela.stock_yardas <= 0
                return (
                  <TableRow key={tela.id}>
                    <TableCell className="font-mono text-xs">
                      {tela.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{tela.tipo}</TableCell>
                    <TableCell>{tela.nombre}</TableCell>
                    <TableCell>{tela.color || "—"}</TableCell>
                    <TableCell className="text-right">
                      {tela.ancho_pulgadas != null
                        ? Number(tela.ancho_pulgadas).toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell>{tela.proveedor || "—"}</TableCell>
                    <TableCell>{tela.referencia_cliente || "—"}</TableCell>
                    <TableCell className="text-right">
                      {sinStockM ? (
                        <Badge variant="destructive" className="font-mono">
                          0.00
                        </Badge>
                      ) : (
                        <span className="font-mono">
                          {Number(tela.stock_metros).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {sinStockY ? (
                        <Badge variant="destructive" className="font-mono">
                          0.00
                        </Badge>
                      ) : (
                        <span className="font-mono">
                          {Number(tela.stock_yardas).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} referencia{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

// ─── Tab 2: Crear Referencia ───────────────────────────────────────────────────

function CrearReferenciaTab({ onSuccess }: { onSuccess: () => void }) {
  const [codigo, setCodigo] = useState("")
  const [tipo, setTipo] = useState("")
  const [tipoCustom, setTipoCustom] = useState("")
  const [nombre, setNombre] = useState("")
  const [color, setColor] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [referenciaCliente, setReferenciaCliente] = useState("")
  const [anchoPulgadas, setAnchoPulgadas] = useState("")
  const [saving, setSaving] = useState(false)

  const tipoFinal = tipo === "__otro__" ? tipoCustom.trim() : tipo

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !codigo.trim() ||
      !tipoFinal ||
      !nombre.trim() ||
      !color.trim() ||
      !proveedor.trim() ||
      !referenciaCliente.trim() ||
      !anchoPulgadas
    ) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }
    const anchoNum = parseFloat(anchoPulgadas)
    if (isNaN(anchoNum) || anchoNum <= 0) {
      toast.error("El ancho (pulgadas) debe ser un número mayor a 0.")
      return
    }

    setSaving(true)
    const { error } = await supabase
      .schema("telas")
      .from("inventario_telas")
      .insert({
        codigo: codigo.trim(),
        tipo: tipoFinal,
        nombre: nombre.trim(),
        color: color.trim(),
        proveedor: proveedor.trim(),
        referencia_cliente: referenciaCliente.trim(),
        ancho_pulgadas: anchoNum,
        stock_metros: 0,
        stock_yardas: 0,
      })
    setSaving(false)

    if (error) {
      toast.error("Error al guardar: " + error.message)
    } else {
      toast.success("Referencia creada correctamente.")
      setCodigo("")
      setTipo("")
      setTipoCustom("")
      setNombre("")
      setColor("")
      setProveedor("")
      setReferenciaCliente("")
      setAnchoPulgadas("")
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Código *</label>
          <Input
            placeholder="Ej: TEL-001"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de Tela *</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo..." />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_TELA.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value="__otro__">Otro (escribir)</SelectItem>
            </SelectContent>
          </Select>
          {tipo === "__otro__" && (
            <Input
              placeholder="Escribe el tipo de tela..."
              value={tipoCustom}
              onChange={(e) => setTipoCustom(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre de la Tela *</label>
          <Input
            placeholder="Ej: Win Fresh, Dry Fit..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Color *</label>
          <Input
            placeholder="Ej: Azul Rey, Blanco Liso..."
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Proveedor *</label>
          <Input
            placeholder="Ej: Textiles del Norte"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Referencia Cliente *</label>
          <Input
            placeholder="Ej: REF-CLI-2024"
            value={referenciaCliente}
            onChange={(e) => setReferenciaCliente(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Ancho (Pulgadas) *</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Ej: 60.00"
            value={anchoPulgadas}
            onChange={(e) => setAnchoPulgadas(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
        El stock inicial se registrará en 0 metros y 0 yardas. Usa la pestaña
        &quot;Ingreso&quot; para sumar inventario.
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Plus className="size-4 mr-2" />
        )}
        Crear Referencia
      </Button>
    </form>
  )
}

// ─── Tab 3 & 4: Movimiento (Ingreso / Descuento) ───────────────────────────────

function MovimientoTab({
  telas,
  tipo,
  onSuccess,
}: {
  telas: InventarioTela[]
  tipo: "INGRESO" | "DESCUENTO"
  onSuccess: () => void
}) {
  const [telaId, setTelaId] = useState<string>("")
  const [metros, setMetros] = useState("")
  const [motivo, setMotivo] = useState("")
  const [saving, setSaving] = useState(false)

  const telaSeleccionada = telas.find((t) => String(t.id) === telaId)
  const stockMetros = telaSeleccionada?.stock_metros ?? 0
  const stockYardas = telaSeleccionada?.stock_yardas ?? 0

  const esDescuento = tipo === "DESCUENTO"
  const metrosNum = parseFloat(metros) || 0
  // Conversion automatica en tiempo real
  const yardasCalculadas = metrosAYardas(metrosNum)

  const stockInsuficiente =
    esDescuento && metrosNum > 0 && metrosNum > stockMetros

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telaId || !metros || !motivo.trim()) {
      toast.error("Completa todos los campos.")
      return
    }
    if (isNaN(metrosNum) || metrosNum <= 0) {
      toast.error("La cantidad en metros debe ser mayor a 0.")
      return
    }
    if (stockInsuficiente) {
      toast.error(
        `Stock insuficiente. Disponible: ${stockMetros.toFixed(2)} metros.`
      )
      return
    }

    setSaving(true)

    const signo = esDescuento ? -1 : 1
    const deltaMetros = signo * metrosNum
    const deltaYardas = signo * yardasCalculadas

    // 1. Insertar movimiento con ambas unidades
    const { error: errMov } = await supabase
      .schema("telas")
      .from("inventario_movimientos")
      .insert({
        tela_id: parseInt(telaId),
        tipo_movimiento: tipo,
        cantidad_metros: metrosNum,
        cantidad_yardas: yardasCalculadas,
        motivo: motivo.trim(),
      })

    if (errMov) {
      toast.error("Error al registrar movimiento: " + errMov.message)
      setSaving(false)
      return
    }

    // 2. Actualizar ambos stocks
    const nuevoStockMetros =
      Math.round((stockMetros + deltaMetros) * 100) / 100
    const nuevoStockYardas =
      Math.round((stockYardas + deltaYardas) * 100) / 100
    const { error: errUpd } = await supabase
      .schema("telas")
      .from("inventario_telas")
      .update({
        stock_metros: nuevoStockMetros,
        stock_yardas: nuevoStockYardas,
      })
      .eq("id", parseInt(telaId))

    setSaving(false)

    if (errUpd) {
      toast.error("Error al actualizar stock: " + errUpd.message)
    } else {
      toast.success(
        tipo === "INGRESO"
          ? "Ingreso registrado correctamente."
          : "Descuento registrado correctamente."
      )
      setTelaId("")
      setMetros("")
      setMotivo("")
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      <div className="space-y-2">
        <label className="text-sm font-medium">Seleccionar Tela *</label>
        <Select value={telaId} onValueChange={setTelaId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tela..." />
          </SelectTrigger>
          <SelectContent>
            {telas.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.codigo ? `${t.codigo} — ` : ""}
                {t.tipo} — {t.nombre}
                {t.color ? ` (${t.color})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {telaSeleccionada && (
          <p className="text-xs text-muted-foreground">
            Stock actual:{" "}
            <span className="font-medium">
              {Number(stockMetros).toFixed(2)} m
            </span>{" "}
            /{" "}
            <span className="font-medium">
              {Number(stockYardas).toFixed(2)} yd
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Cantidad en Metros *</label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Ej: 170.00"
          value={metros}
          onChange={(e) => setMetros(e.target.value)}
          className={stockInsuficiente ? "border-destructive" : ""}
        />
        <p className="text-xs text-muted-foreground">
          El proveedor entrega en metros. La equivalencia en yardas se calcula
          automáticamente.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Equivale a (Yardas)
        </label>
        <Input
          type="text"
          readOnly
          tabIndex={-1}
          value={
            metrosNum > 0 ? `${yardasCalculadas.toFixed(2)} Yds` : "—"
          }
          className="bg-muted/50 font-mono"
        />
      </div>

      {stockInsuficiente && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          Stock insuficiente. Disponible:{" "}
          <strong>{stockMetros.toFixed(2)} metros</strong>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {esDescuento ? "Motivo del descuento *" : "Motivo / Detalle *"}
        </label>
        <Input
          placeholder={
            esDescuento
              ? "Ej: Consumo Orden #1024"
              : "Ej: Ingreso por proveedor X"
          }
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={saving || stockInsuficiente}>
        {saving ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : esDescuento ? (
          <ArrowUpFromLine className="size-4 mr-2" />
        ) : (
          <ArrowDownToLine className="size-4 mr-2" />
        )}
        {esDescuento ? "Registrar Descuento" : "Registrar Ingreso"}
      </Button>
    </form>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function InventarioTelasContent() {
  const { telas, loading, refetch } = useInventario()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Inventario de Telas
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las referencias, el stock y los movimientos de telas.
        </p>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="stock" className="flex items-center gap-1.5">
            <PackageCheck className="size-3.5" />
            Stock Actual
          </TabsTrigger>
          <TabsTrigger value="crear" className="flex items-center gap-1.5">
            <Plus className="size-3.5" />
            Crear Referencia
          </TabsTrigger>
          <TabsTrigger value="ingreso" className="flex items-center gap-1.5">
            <ArrowDownToLine className="size-3.5" />
            Ingreso
          </TabsTrigger>
          <TabsTrigger value="descuento" className="flex items-center gap-1.5">
            <ArrowUpFromLine className="size-3.5" />
            Descuento
          </TabsTrigger>
        </TabsList>

        {/* ── Stock Actual ── */}
        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stock Actual</CardTitle>
              <CardDescription>
                Vista general del inventario de telas registradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockActualTab telas={telas} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Crear Referencia ── */}
        <TabsContent value="crear" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Crear Referencia</CardTitle>
              <CardDescription>
                Registra una nueva referencia de tela. El stock inicial será 0.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CrearReferenciaTab onSuccess={refetch} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ingreso ── */}
        <TabsContent value="ingreso" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ingreso de Tela</CardTitle>
              <CardDescription>
                Suma metros al stock. Las yardas se calculan automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MovimientoTab telas={telas} tipo="INGRESO" onSuccess={refetch} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Descuento ── */}
        <TabsContent value="descuento" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Descuento de Tela</CardTitle>
              <CardDescription>
                Resta metros del stock. No se permite descontar más del stock
                disponible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MovimientoTab
                telas={telas}
                tipo="DESCUENTO"
                onSuccess={refetch}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
