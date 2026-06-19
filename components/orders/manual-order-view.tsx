"use client"

import { useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

// ─── Supabase client ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Constants ───────────────────────────────────────────────────────────────
const CODE_ACCESO = "Telas2026@"

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Sub-component: Access gate ──────────────────────────────────────────────
function AccessGate({
  onUnlock,
  onBack,
}: {
  onUnlock: () => void
  onBack: () => void
}) {
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
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary p-2">
              <ClipboardList className="size-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle>Ingreso Manual de Orden</CardTitle>
              <CardDescription>
                Funcion protegida. Ingresa el codigo de acceso para continuar.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-5 py-8"
          >
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="rounded-full bg-muted p-5">
                <Lock className="size-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Esta funcion esta protegida. Ingresa el codigo de acceso para
                habilitar el formulario de registro manual.
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
        </div>
      </CardContent>
    </Card>
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
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b last:border-0">
      {/* # */}
      <div className="col-span-1 flex items-center pt-1">
        <span className="text-xs font-medium text-muted-foreground w-5 text-center">
          {index + 1}
        </span>
      </div>
      {/* Nombre */}
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
          className="text-sm h-8"
        />
      </div>
      {/* Tela */}
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Tela</Label>
        )}
        <Input
          value={row.tela}
          onChange={(e) => onChange(row._key, "tela", e.target.value)}
          placeholder="Jersey"
          className="text-sm h-8"
        />
      </div>
      {/* Genero */}
      <div className="col-span-1">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Genero</Label>
        )}
        <Input
          value={row.genero}
          onChange={(e) => onChange(row._key, "genero", e.target.value)}
          placeholder="M"
          className="text-sm h-8"
        />
      </div>
      {/* Estilo */}
      <div className="col-span-2">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Estilo</Label>
        )}
        <Input
          value={row.estilo}
          onChange={(e) => onChange(row._key, "estilo", e.target.value)}
          placeholder="Cuello V"
          className="text-sm h-8"
        />
      </div>
      {/* Talla */}
      <div className="col-span-1">
        {index === 0 && (
          <Label className="text-xs text-muted-foreground mb-1 block">Talla</Label>
        )}
        <Input
          value={row.talla}
          onChange={(e) => onChange(row._key, "talla", e.target.value)}
          placeholder="S"
          className="text-sm h-8"
        />
      </div>
      {/* Pcs */}
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
          className="text-sm h-8"
        />
      </div>
      {/* Comentarios */}
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
          className="text-sm h-8"
        />
      </div>
      {/* Remove */}
      <div className="col-span-1 flex items-center justify-center pt-[2px]">
        {index === 0 && <div className="mb-1 h-4" />}
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

// ─── Main view ────────────────────────────────────────────────────────────────
interface ManualOrderViewProps {
  onBack: () => void
  onSuccess: () => void
}

export function ManualOrderView({ onBack, onSuccess }: ManualOrderViewProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [cabecera, setCabecera] = useState<CabeceraForm>(INITIAL_CABECERA)
  const [detalles, setDetalles] = useState<DetalleRow[]>([emptyDetalle()])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  // ── Derived ─────────────────────────────────────────────────────────────
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

  // ── Reset form ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setCabecera(INITIAL_CABECERA)
    setDetalles([emptyDetalle()])
    setSaveError(null)
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid) return
    setIsSaving(true)
    setSaveError(null)

    try {
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

      const validRows = detalles.filter(
        (r) => r.nombre.trim() && parseInt(r.pcs) > 0
      )
      if (validRows.length > 0) {
        // id  → numeric NOT NULL. Para ingresos manuales se fija en 1;
        //       la unicidad real la garantiza id2 (uuid PK de la tabla).
        // id2 → uuid, auto-generado con gen_random_uuid() → no enviar.
        // pcs → text en detalleorden → enviar string.
        const detallePayload = validRows.map((r) => ({
          id: 1,
          pedido: cabecera.pedido.trim(),
          nombre: r.nombre.trim(),
          tela: r.tela.trim() || null,
          genero: r.genero.trim() || null,
          estilo: r.estilo.trim() || null,
          talla: r.talla.trim() || null,
          pcs: r.pcs.trim() || null,
          comentarios: r.comentarios.trim() || null,
          cliente: cabecera.cliente.trim(),
          origen: cabecera.origen.trim() || null,
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
      onBack()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setSaveError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Gate ─────────────────────────────────────────────────────────────────
  if (!unlocked) {
    return <AccessGate onUnlock={() => setUnlocked(true)} onBack={onBack} />
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary p-2">
                  <ClipboardList className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle>Ingreso Manual de Orden</CardTitle>
                  <CardDescription>
                    Registra manualmente la cabecera y el detalle de una nueva orden de produccion.
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                Limpiar formulario
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isValid || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                Guardar orden
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error global */}
      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* CABECERA */}
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Cabecera</Badge>
            <span className="text-xs text-muted-foreground">
              Informacion principal de la orden
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: identificacion */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pedido" className="text-sm">
                # Pedido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pedido"
                value={cabecera.pedido}
                onChange={(e) => setCab("pedido", e.target.value)}
                placeholder="VT-000001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente" className="text-sm">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cliente"
                value={cabecera.cliente}
                onChange={(e) => setCab("cliente", e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendedora" className="text-sm">
                Vendedora <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vendedora"
                value={cabecera.vendedora}
                onChange={(e) => setCab("vendedora", e.target.value)}
                placeholder="Nombre vendedora"
              />
            </div>
          </div>

          {/* Row 2: datos adicionales */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="origen" className="text-sm">Origen</Label>
              <Input
                id="origen"
                value={cabecera.origen}
                onChange={(e) => setCab("origen", e.target.value)}
                placeholder="Canal de venta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciudad" className="text-sm">Ciudad</Label>
              <Input
                id="ciudad"
                value={cabecera.ciudad}
                onChange={(e) => setCab("ciudad", e.target.value)}
                placeholder="Bogota"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcs" className="text-sm">
                Pcs totales
                <span className="text-muted-foreground text-xs ml-1">
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
            <div className="space-y-1.5">
              <Label className="text-sm">Es urgente</Label>
              <div className="flex items-center gap-2 h-10 pl-1">
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

          {/* Row 3: fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fecha_ingreso" className="text-sm">
                Fecha de ingreso <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha_ingreso"
                type="date"
                value={cabecera.fecha_de_ingreso}
                onChange={(e) => setCab("fecha_de_ingreso", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha_entrega" className="text-sm">
                Fecha de entrega <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fecha_entrega"
                type="date"
                value={cabecera.fecha_de_entrega}
                onChange={(e) => setCab("fecha_de_entrega", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Row 4: informacion general */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="estilo_prenda" className="text-sm">
                Estilo de la prenda
              </Label>
              <Input
                id="estilo_prenda"
                value={cabecera.estilo_de_la_prenda}
                onChange={(e) => setCab("estilo_de_la_prenda", e.target.value)}
                placeholder="Camiseta, Sudadera..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etiqueta" className="text-sm">Etiqueta</Label>
              <Input
                id="etiqueta"
                value={cabecera.etiqueta}
                onChange={(e) => setCab("etiqueta", e.target.value)}
                placeholder="Tipo de etiqueta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empaque_cab" className="text-sm">Empaque</Label>
              <Input
                id="empaque_cab"
                value={cabecera.empaque}
                onChange={(e) => setCab("empaque", e.target.value)}
                placeholder="Tipo de empaque"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accesorios" className="text-sm">Accesorios</Label>
              <Input
                id="accesorios"
                value={cabecera.accesorios}
                onChange={(e) => setCab("accesorios", e.target.value)}
                placeholder="Accesorios incluidos"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comentario_ventas" className="text-sm">
              Comentario ventas
            </Label>
            <Textarea
              id="comentario_ventas"
              rows={3}
              value={cabecera.comentario_ventas}
              onChange={(e) => setCab("comentario_ventas", e.target.value)}
              placeholder="Instrucciones o comentarios adicionales..."
            />
          </div>
        </CardContent>
      </Card>

      {/* DETALLE */}
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Detalle de orden</Badge>
              <span className="text-xs text-muted-foreground">
                {detalles.length} fila(s) &mdash; {totalPcsFromDetalles} pcs en total
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="size-4 mr-2" />
              Agregar fila
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 pb-1">
              <div className="col-span-1" />
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Nombre / Ref.</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Tela</span>
              </div>
              <div className="col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Genero</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Estilo</span>
              </div>
              <div className="col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Talla</span>
              </div>
              <div className="col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Pcs</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Comentarios</span>
              </div>
            </div>
            <Separator className="mb-2" />
            {detalles.map((row, index) => (
              <DetalleRowInput
                key={row._key}
                row={row}
                index={index}
                onChange={updateRow}
                onRemove={removeRow}
                canRemove={detalles.length > 1}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="size-4 mr-2" />
              Agregar fila
            </Button>
            <div className="text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-semibold text-foreground">
                {totalPcsFromDetalles} pcs
              </span>{" "}
              en {detalles.filter((r) => parseInt(r.pcs) > 0).length} fila(s) valida(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save bar */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Guardar orden
        </Button>
      </div>
    </div>
  )
}
