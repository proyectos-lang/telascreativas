"use client"

import { useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Lock,
  Plus,
  Trash2,
  AlertCircle,
  ClipboardList,
  Package,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"

// ─── Supabase client ────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Constants ──────────────────────────────────────────────────────────────
const CODE_ACCESO = "Telas2026@"

// ─── Types ───────────────────────────────────────────────────────────────────
interface DetalleRow {
  _key: string
  nombre: string
  tela: string
  genero: string
  estilo: string
  talla: string
  pcs: string
  comentarios: string
}

interface CabeceraForm {
  pedido: string
  cliente: string
  origen: string
  vendedora: string
  fecha_de_ingreso: string
  fecha_de_entrega: string
  pcs: string
  ciudad: string
  es_urgente: boolean
  // Informacion general
  estilo_de_la_prenda: string
  etiqueta: string
  empaque: string
  accesorios: string
  comentario_ventas: string
}

function emptyDetalle(): DetalleRow {
  return {
    _key: `row-${Date.now()}-${Math.random()}`,
    nombre: "",
    tela: "",
    genero: "",
    estilo: "",
    talla: "",
    pcs: "",
    comentarios: "",
  }
}

const INITIAL_CABECERA: CabeceraForm = {
  pedido: "",
  cliente: "",
  origen: "",
  vendedora: "",
  fecha_de_ingreso: new Date().toISOString().split("T")[0],
  fecha_de_entrega: "",
  pcs: "",
  ciudad: "",
  es_urgente: false,
  estilo_de_la_prenda: "",
  etiqueta: "",
  empaque: "",
  accesorios: "",
  comentario_ventas: "",
}

// ─── Sub-component: Access gate ───────────────────────────────────────────────
function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code === CODE_ACCESO) {
      onUnlock()
    } else {
      setError(true)
      setCode("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="rounded-full bg-muted p-4">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Esta funcion esta protegida. Ingresa el codigo de acceso para continuar.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="access-code">Codigo de acceso</Label>
        <Input
          id="access-code"
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(false)
          }}
          placeholder="••••••••••"
          autoFocus
        />
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="size-3" />
            Codigo incorrecto. Intentalo de nuevo.
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={!code}>
        Ingresar
      </Button>
    </form>
  )
}

// ─── Sub-component: Detalle row ───────────────────────────────────────────────
function DetalleRowInput({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: DetalleRow
  index: number
  onChange: (key: string, field: keyof DetalleRow, value: string) => void
  onRemove: (key: string) => void
  canRemove: boolean
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-1 flex items-center justify-center pt-8">
        <span className="text-xs font-medium text-muted-foreground">
          {index + 1}
        </span>
      </div>
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">
            Nombre / Referencia
          </Label>
        )}
        <Input
          value={row.nombre}
          onChange={(e) => onChange(row._key, "nombre", e.target.value)}
          placeholder="Camiseta ref. X"
          className="text-sm"
        />
      </div>
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Tela</Label>
        )}
        <Input
          value={row.tela}
          onChange={(e) => onChange(row._key, "tela", e.target.value)}
          placeholder="Jersey"
          className="text-sm"
        />
      </div>
      <div className="col-span-1">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Genero</Label>
        )}
        <Input
          value={row.genero}
          onChange={(e) => onChange(row._key, "genero", e.target.value)}
          placeholder="M"
          className="text-sm"
        />
      </div>
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Estilo</Label>
        )}
        <Input
          value={row.estilo}
          onChange={(e) => onChange(row._key, "estilo", e.target.value)}
          placeholder="Cuello V"
          className="text-sm"
        />
      </div>
      <div className="col-span-1">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Talla</Label>
        )}
        <Input
          value={row.talla}
          onChange={(e) => onChange(row._key, "talla", e.target.value)}
          placeholder="S/M/L"
          className="text-sm"
        />
      </div>
      <div className="col-span-1">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Pcs</Label>
        )}
        <Input
          type="number"
          min="0"
          value={row.pcs}
          onChange={(e) => onChange(row._key, "pcs", e.target.value)}
          placeholder="0"
          className="text-sm"
        />
      </div>
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">
            Comentarios
          </Label>
        )}
        <Input
          value={row.comentarios}
          onChange={(e) => onChange(row._key, "comentarios", e.target.value)}
          placeholder="Opcional"
          className="text-sm"
        />
      </div>
      <div className="col-span-1 flex items-center justify-center pt-[22px]">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => onRemove(row._key)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface ManualOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ManualOrderModal({
  open,
  onOpenChange,
  onSuccess,
}: ManualOrderModalProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [cabecera, setCabecera] = useState<CabeceraForm>(INITIAL_CABECERA)
  const [detalles, setDetalles] = useState<DetalleRow[]>([emptyDetalle()])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Reset on close ──────────────────────────────────────────────────────
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setUnlocked(false)
      setCabecera(INITIAL_CABECERA)
      setDetalles([emptyDetalle()])
      setSaveError(null)
    }
    onOpenChange(value)
  }

  // ── Cabecera helpers ────────────────────────────────────────────────────
  const setCab = useCallback(
    (field: keyof CabeceraForm, value: string | boolean) => {
      setCabecera((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  // ── Detalle helpers ─────────────────────────────────────────────────────
  const addRow = () => setDetalles((prev) => [...prev, emptyDetalle()])

  const removeRow = (key: string) =>
    setDetalles((prev) => prev.filter((r) => r._key !== key))

  const updateRow = (key: string, field: keyof DetalleRow, value: string) =>
    setDetalles((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    )

  // ── Validation ──────────────────────────────────────────────────────────
  const totalPcsFromDetalles = detalles.reduce(
    (s, r) => s + (parseInt(r.pcs) || 0),
    0
  )

  const isValid =
    cabecera.pedido.trim() &&
    cabecera.cliente.trim() &&
    cabecera.vendedora.trim() &&
    cabecera.fecha_de_ingreso &&
    cabecera.fecha_de_entrega &&
    detalles.some((r) => r.nombre.trim() && r.pcs && parseInt(r.pcs) > 0)

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid) return
    setIsSaving(true)
    setSaveError(null)

    try {
      // 1. Insert cabecera
      const { error: cabError } = await supabase
        .schema("telas")
        .from("cabecera")
        .insert({
          pedido: cabecera.pedido.trim(),
          cliente: cabecera.cliente.trim(),
          origen: cabecera.origen.trim() || null,
          vendedora: cabecera.vendedora.trim(),
          fecha_de_ingreso: cabecera.fecha_de_ingreso,
          fecha_de_entrega: cabecera.fecha_de_entrega,
          pcs: parseInt(cabecera.pcs) || totalPcsFromDetalles,
          ciudad: cabecera.ciudad.trim() || null,
          es_urgente: cabecera.es_urgente,
          estado_aprobado_rechazado: "Pendiente",
          estilo_de_la_prenda: cabecera.estilo_de_la_prenda.trim() || null,
          etiqueta: cabecera.etiqueta.trim() || null,
          empaque: cabecera.empaque.trim() || null,
          accesorios: cabecera.accesorios.trim() || null,
          comentario_ventas: cabecera.comentario_ventas.trim() || null,
        })

      if (cabError) throw new Error(`Cabecera: ${cabError.message}`)

      // 2. Insert detalles (only rows with nombre + pcs)
      const validRows = detalles.filter(
        (r) => r.nombre.trim() && parseInt(r.pcs) > 0
      )
      if (validRows.length > 0) {
        const detallePayload = validRows.map((r, i) => ({
          id2: `${cabecera.pedido.trim()}-${String(i + 1).padStart(3, "0")}`,
          pedido: cabecera.pedido.trim(),
          nombre: r.nombre.trim(),
          tela: r.tela.trim() || null,
          genero: r.genero.trim() || null,
          estilo: r.estilo.trim() || null,
          talla: r.talla.trim() || null,
          pcs: parseInt(r.pcs) || 0,
          comentarios: r.comentarios.trim() || null,
        }))

        const { error: detError } = await supabase
          .schema("telas")
          .from("detalleorden")
          .insert(detallePayload)

        if (detError) throw new Error(`Detalle: ${detError.message}`)
      }

      toast.success("Orden registrada correctamente", {
        description: `Pedido ${cabecera.pedido.trim()} ingresado con ${validRows.length} linea(s) de detalle.`,
      })
      onSuccess()
      handleOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setSaveError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          unlocked
            ? "max-w-5xl max-h-[90vh] overflow-y-auto"
            : "max-w-sm"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Ingreso Manual de Orden
          </DialogTitle>
          <DialogDescription>
            {unlocked
              ? "Registra manualmente la cabecera y el detalle de una nueva orden."
              : "Funcion protegida. Ingresa el codigo para acceder."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Access gate ─────────────────────────────────────────────── */}
        {!unlocked && <AccessGate onUnlock={() => setUnlocked(true)} />}

        {/* ── Form ────────────────────────────────────────────────────── */}
        {unlocked && (
          <div className="space-y-6 pb-2">
            {/* CABECERA */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Cabecera
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Informacion principal de la orden
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Pedido */}
                <div className="space-y-1">
                  <Label htmlFor="pedido" className="text-xs">
                    # Pedido <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pedido"
                    value={cabecera.pedido}
                    onChange={(e) => setCab("pedido", e.target.value)}
                    placeholder="VT-000001"
                  />
                </div>
                {/* Cliente */}
                <div className="space-y-1">
                  <Label htmlFor="cliente" className="text-xs">
                    Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cliente"
                    value={cabecera.cliente}
                    onChange={(e) => setCab("cliente", e.target.value)}
                    placeholder="Nombre del cliente"
                  />
                </div>
                {/* Vendedora */}
                <div className="space-y-1">
                  <Label htmlFor="vendedora" className="text-xs">
                    Vendedora <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="vendedora"
                    value={cabecera.vendedora}
                    onChange={(e) => setCab("vendedora", e.target.value)}
                    placeholder="Nombre vendedora"
                  />
                </div>
                {/* Origen */}
                <div className="space-y-1">
                  <Label htmlFor="origen" className="text-xs">
                    Origen
                  </Label>
                  <Input
                    id="origen"
                    value={cabecera.origen}
                    onChange={(e) => setCab("origen", e.target.value)}
                    placeholder="Canal de venta"
                  />
                </div>
                {/* Ciudad */}
                <div className="space-y-1">
                  <Label htmlFor="ciudad" className="text-xs">
                    Ciudad
                  </Label>
                  <Input
                    id="ciudad"
                    value={cabecera.ciudad}
                    onChange={(e) => setCab("ciudad", e.target.value)}
                    placeholder="Bogota"
                  />
                </div>
                {/* Pcs */}
                <div className="space-y-1">
                  <Label htmlFor="pcs" className="text-xs">
                    Pcs totales
                    <span className="text-muted-foreground ml-1">
                      (auto: {totalPcsFromDetalles})
                    </span>
                  </Label>
                  <Input
                    id="pcs"
                    type="number"
                    min="0"
                    value={cabecera.pcs}
                    onChange={(e) => setCab("pcs", e.target.value)}
                    placeholder={String(totalPcsFromDetalles)}
                  />
                </div>
                {/* Fecha ingreso */}
                <div className="space-y-1">
                  <Label htmlFor="fecha_ingreso" className="text-xs">
                    Fecha de ingreso <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fecha_ingreso"
                    type="date"
                    value={cabecera.fecha_de_ingreso}
                    onChange={(e) => setCab("fecha_de_ingreso", e.target.value)}
                  />
                </div>
                {/* Fecha entrega */}
                <div className="space-y-1">
                  <Label htmlFor="fecha_entrega" className="text-xs">
                    Fecha de entrega <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fecha_entrega"
                    type="date"
                    value={cabecera.fecha_de_entrega}
                    onChange={(e) => setCab("fecha_de_entrega", e.target.value)}
                  />
                </div>
                {/* Urgente */}
                <div className="flex flex-col justify-end space-y-1">
                  <Label className="text-xs">Es urgente</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      checked={cabecera.es_urgente}
                      onCheckedChange={(v) => setCab("es_urgente", v)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {cabecera.es_urgente ? "Si" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informacion general */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="estilo_prenda" className="text-xs">
                    Estilo de la prenda
                  </Label>
                  <Input
                    id="estilo_prenda"
                    value={cabecera.estilo_de_la_prenda}
                    onChange={(e) => setCab("estilo_de_la_prenda", e.target.value)}
                    placeholder="Camiseta, Sudadera..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="etiqueta" className="text-xs">
                    Etiqueta
                  </Label>
                  <Input
                    id="etiqueta"
                    value={cabecera.etiqueta}
                    onChange={(e) => setCab("etiqueta", e.target.value)}
                    placeholder="Tipo de etiqueta"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="empaque_cab" className="text-xs">
                    Empaque
                  </Label>
                  <Input
                    id="empaque_cab"
                    value={cabecera.empaque}
                    onChange={(e) => setCab("empaque", e.target.value)}
                    placeholder="Tipo de empaque"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="accesorios" className="text-xs">
                    Accesorios
                  </Label>
                  <Input
                    id="accesorios"
                    value={cabecera.accesorios}
                    onChange={(e) => setCab("accesorios", e.target.value)}
                    placeholder="Cremallera, botones..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="comentario_ventas" className="text-xs">
                  Comentario ventas
                </Label>
                <Textarea
                  id="comentario_ventas"
                  value={cabecera.comentario_ventas}
                  onChange={(e) => setCab("comentario_ventas", e.target.value)}
                  placeholder="Notas internas de ventas..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* DETALLE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Package className="size-3 mr-1" />
                    Detalle de productos
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {detalles.length} linea(s) — {totalPcsFromDetalles} pcs total
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                >
                  <Plus className="size-3.5 mr-1" />
                  Agregar linea
                </Button>
              </div>

              <div className="space-y-2">
                {detalles.map((row, idx) => (
                  <DetalleRowInput
                    key={row._key}
                    row={row}
                    index={idx}
                    onChange={updateRow}
                    onRemove={removeRow}
                    canRemove={detalles.length > 1}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {unlocked && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!isValid || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  Registrar orden
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
