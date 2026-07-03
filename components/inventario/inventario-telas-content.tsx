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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import * as XLSX from "xlsx"
import {
  Search,
  PackageCheck,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ChevronsUpDown,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

// ─── Modal de Edición ─────────────────────────────────────────────────────────

function EditTelaModal({
  tela,
  open,
  onClose,
  onSuccess,
}: {
  tela: InventarioTela | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [codigo, setCodigo] = useState("")
  const [tipo, setTipo] = useState("")
  const [tipoCustom, setTipoCustom] = useState("")
  const [nombre, setNombre] = useState("")
  const [color, setColor] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [referenciaCliente, setReferenciaCliente] = useState("")
  const [anchoPulgadas, setAnchoPulgadas] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tela) return
    setCodigo(tela.codigo ?? "")
    const esTipoLista = TIPOS_TELA.includes(tela.tipo)
    setTipo(esTipoLista ? tela.tipo : "__otro__")
    setTipoCustom(esTipoLista ? "" : tela.tipo)
    setNombre(tela.nombre)
    setColor(tela.color ?? "")
    setProveedor(tela.proveedor ?? "")
    setReferenciaCliente(tela.referencia_cliente ?? "")
    setAnchoPulgadas(tela.ancho_pulgadas != null ? String(tela.ancho_pulgadas) : "")
  }, [tela])

  const tipoFinal = tipo === "__otro__" ? tipoCustom.trim() : tipo

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tela) return
    if (!tipoFinal || !nombre.trim()) {
      toast.error("Tipo y nombre son obligatorios.")
      return
    }
    const anchoNum = anchoPulgadas ? parseFloat(anchoPulgadas) : null
    if (anchoPulgadas && (isNaN(anchoNum!) || anchoNum! <= 0)) {
      toast.error("El ancho debe ser un número mayor a 0.")
      return
    }
    setSaving(true)
    const { error } = await supabase
      .schema("telas")
      .from("inventario_telas")
      .update({
        codigo: codigo.trim() || null,
        tipo: tipoFinal,
        nombre: nombre.trim(),
        color: color.trim() || null,
        proveedor: proveedor.trim() || null,
        referencia_cliente: referenciaCliente.trim() || null,
        ancho_pulgadas: anchoNum,
      })
      .eq("id", tela.id)
    setSaving(false)
    if (error) {
      toast.error("Error al guardar: " + error.message)
    } else {
      toast.success("Referencia actualizada correctamente.")
      onSuccess()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Referencia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                placeholder="Ej: TEL-001"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Tela *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_TELA.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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

            <div className="space-y-1.5">
              <Label>Nombre de la Tela *</Label>
              <Input
                placeholder="Ej: Win Fresh, Dry Fit..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input
                placeholder="Ej: Azul Rey, Blanco Liso..."
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Input
                placeholder="Ej: Textiles del Norte"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Referencia Cliente</Label>
              <Input
                placeholder="Ej: REF-CLI-2024"
                value={referenciaCliente}
                onChange={(e) => setReferenciaCliente(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ancho (Pulgadas)</Label>
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

          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
            El stock (metros / yardas) no se modifica aquí — usa las pestañas
            Ingreso y Descuento.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal de Eliminación ─────────────────────────────────────────────────────

function DeleteTelaModal({
  tela,
  open,
  onClose,
  onSuccess,
}: {
  tela: InventarioTela | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!tela) return
    setDeleting(true)
    const { error } = await supabase
      .schema("telas")
      .from("inventario_telas")
      .delete()
      .eq("id", tela.id)
    setDeleting(false)
    if (error) {
      toast.error("Error al eliminar: " + error.message)
    } else {
      toast.success("Referencia eliminada.")
      onSuccess()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !deleting && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar referencia</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente la
            referencia y no afectará los movimientos históricos.
          </DialogDescription>
        </DialogHeader>
        {tela && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Código:</span> {tela.codigo || "—"}</p>
            <p><span className="text-muted-foreground">Nombre:</span> {tela.nombre}</p>
            <p><span className="text-muted-foreground">Tipo:</span> {tela.tipo}</p>
            <p><span className="text-muted-foreground">Stock actual:</span> {Number(tela.stock_metros).toFixed(2)} m</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab 1: Stock Actual ───────────────────────────────────────────────────────

function exportToExcel(telas: InventarioTela[]) {
  const rows = telas.map((t) => ({
    Código: t.codigo || "",
    Tipo: t.tipo,
    Nombre: t.nombre,
    Color: t.color || "",
    "Ancho (Pulg.)": t.ancho_pulgadas ?? "",
    Proveedor: t.proveedor || "",
    "Ref. Cliente": t.referencia_cliente || "",
    "Stock Metros": t.stock_metros,
    "Stock Yardas": t.stock_yardas,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Inventario")
  XLSX.writeFile(wb, `inventario-telas-${new Date().toISOString().split("T")[0]}.xlsx`)
}

function StockActualTab({
  telas,
  loading,
  onEdit,
  onDelete,
}: {
  telas: InventarioTela[]
  loading: boolean
  onEdit: (tela: InventarioTela) => void
  onDelete: (tela: InventarioTela) => void
}) {
  const [search, setSearch] = useState("")
  const [filterTipo, setFilterTipo] = useState("__todos__")
  const [filterColor, setFilterColor] = useState("__todos__")

  const tiposUnicos = useMemo(
    () => Array.from(new Set(telas.map((t) => t.tipo))).sort(),
    [telas]
  )
  const coloresUnicos = useMemo(
    () =>
      Array.from(new Set(telas.map((t) => t.color).filter(Boolean) as string[])).sort(),
    [telas]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return telas.filter((t) => {
      if (filterTipo !== "__todos__" && t.tipo !== filterTipo) return false
      if (filterColor !== "__todos__" && t.color !== filterColor) return false
      if (!q) return true
      return (
        t.nombre.toLowerCase().includes(q) ||
        t.tipo.toLowerCase().includes(q) ||
        (t.codigo ?? "").toLowerCase().includes(q) ||
        (t.color ?? "").toLowerCase().includes(q) ||
        (t.proveedor ?? "").toLowerCase().includes(q) ||
        (t.referencia_cliente ?? "").toLowerCase().includes(q)
      )
    })
  }, [telas, search, filterTipo, filterColor])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Cargando inventario...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Barra de filtros y acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los tipos</SelectItem>
            {tiposUnicos.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los colores</SelectItem>
            {coloresUnicos.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToExcel(filtered)}
          className="gap-1.5 ml-auto"
          disabled={filtered.length === 0}
        >
          <FileSpreadsheet className="size-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Tabla con scroll vertical */}
      <div className="rounded-md border overflow-x-auto">
        <div className="overflow-y-auto max-h-[420px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
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
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
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
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onEdit(tela)}
                            title="Editar referencia"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(tela)}
                            title="Eliminar referencia"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} referencia{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== telas.length && ` de ${telas.length}`}
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
  const [comboOpen, setComboOpen] = useState(false)
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

  const telaLabel = (t: InventarioTela) =>
    `${t.codigo ? t.codigo + " — " : ""}${t.tipo} — ${t.nombre}${t.color ? ` (${t.color})` : ""}`

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      <div className="space-y-2">
        <label className="text-sm font-medium">Seleccionar Tela *</label>
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {telaSeleccionada ? telaLabel(telaSeleccionada) : "Buscar tela..."}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar por código, nombre, color..." />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {telas.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={telaLabel(t)}
                      onSelect={() => {
                        setTelaId(String(t.id))
                        setComboOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          telaId === String(t.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {telaLabel(t)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
  const [editTela, setEditTela] = useState<InventarioTela | null>(null)
  const [deleteTela, setDeleteTela] = useState<InventarioTela | null>(null)

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
              <StockActualTab telas={telas} loading={loading} onEdit={setEditTela} onDelete={setDeleteTela} />
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

      <EditTelaModal
        tela={editTela}
        open={!!editTela}
        onClose={() => setEditTela(null)}
        onSuccess={refetch}
      />
      <DeleteTelaModal
        tela={deleteTela}
        open={!!deleteTela}
        onClose={() => setDeleteTela(null)}
        onSuccess={refetch}
      />
    </div>
  )
}
