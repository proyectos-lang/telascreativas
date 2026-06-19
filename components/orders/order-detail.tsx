"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ApprovalModal } from "./approval-modal"
import { ReprogramModal, type ReprogramPayload } from "./reprogram-modal"
import { RejectModal } from "./reject-modal"
import { ReversionModal } from "./reversion-modal"
import { CancelModal } from "./cancel-modal"
import { EditModeModal } from "./edit-mode-modal"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addDaysSkippingSundays, getTodayISO } from "@/lib/date-utils"
import {
  ArrowLeft,
  Check,
  X,
  CalendarClock,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Ban,
  User,
  MapPin,
  Calendar,
  ShirtIcon,
  FileText,
  Tag,
  Package,
  Gem,
  Sparkles,
  MessageSquare,
  Hash,
  ClipboardList,
  Scissors,
  Pencil,
  Save,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface OrderDetailProps {
  orden: Orden
  onBack: () => void
  onUpdateOrden: (pedido: string, updates: Partial<Orden>) => Promise<{ success: boolean; error?: string }>
  isLoading: boolean
}

// Helper component for info rows with icons
function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor = "text-icon-cyan",
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined | null
  iconColor?: string
}) {
  const displayValue = value === undefined || value === null || value === "" ? "-" : value
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="rounded-md bg-muted p-1.5 shrink-0">
        <Icon className={`size-3 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{displayValue}</p>
      </div>
    </div>
  )
}

/**
 * Variante de InfoRow que envuelve un control de edicion (Input) en el area
 * derecha, manteniendo el mismo esqueleto visual (icono + label).
 */
function EditableRow({
  icon: Icon,
  label,
  iconColor = "text-icon-cyan",
  children,
}: {
  icon: React.ElementType
  label: string
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="rounded-md bg-muted p-1.5 shrink-0">
        <Icon className={`size-3 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  )
}

export function OrderDetail({
  orden,
  onBack,
  onUpdateOrden,
  isLoading,
}: OrderDetailProps) {
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showReprogramModal, setShowReprogramModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showReversionModal, setShowReversionModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)

  // Modo edicion avanzada (protegido por contrasena).
  // - isEditMode: true cuando la contrasena fue validada y el usuario puede
  //   modificar campos.
  // - showEditPasswordModal: abre el dialogo que pide la password.
  // - editHeader / editDetalles: buffers locales con los cambios; se hacen
  //   commit al DB cuando el usuario da clic en "Guardar cambios".
  // - isSavingEdit: bloquea el UI mientras se persiste a Supabase.
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editHeader, setEditHeader] = useState<{
    fecha_de_ingreso: string
    fecha_de_entrega: string
    pcs: string
    ciudad: string
  }>({
    fecha_de_ingreso: "",
    fecha_de_entrega: "",
    pcs: "",
    ciudad: "",
  })
  const [editDetalles, setEditDetalles] = useState<DetalleOrden[]>([])

  useEffect(() => {
    async function fetchDetalles() {
      if (!supabase) {
        setDetallesError("Cliente de Supabase no configurado")
        setDetallesLoading(false)
        return
      }

      setDetallesLoading(true)
      setDetallesError(null)

      const { data, error } = await supabase
        .schema("telas")
        .from("detalleorden")
        .select("*")
        .eq("pedido", orden.pedido)

      if (error) {
        setDetallesError(error.message)
      } else {
        setDetalles(data || [])
      }
      setDetallesLoading(false)
    }

    fetchDetalles()
  }, [orden.pedido])

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  /**
   * Convierte un timestamp/date de la BD al formato YYYY-MM-DD que espera un
   * <input type="date">. Si el valor es nulo/invalido devuelve cadena vacia.
   */
  const toDateInput = (dateStr: string | undefined | null): string => {
    if (!dateStr) return ""
    // Admite valores tipo "2026-01-15" o "2026-01-15T00:00:00Z".
    const s = String(dateStr)
    // Si ya viene en formato YYYY-MM-DD, usarlo tal cual para evitar
    // desplazamientos por timezone cuando Date() lo interpreta como UTC.
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const d = new Date(s)
    if (isNaN(d.getTime())) return ""
    return d.toISOString().slice(0, 10)
  }

  /**
   * Carga el buffer de edicion con los valores actuales de la orden y de
   * sus detalles. Se dispara cuando se activa isEditMode.
   */
  const enterEditMode = () => {
    setEditHeader({
      fecha_de_ingreso: toDateInput(orden.fecha_de_ingreso),
      fecha_de_entrega: toDateInput(orden.fecha_de_entrega),
      pcs: orden.pcs != null ? String(orden.pcs) : "",
      ciudad: orden.ciudad || "",
    })
    // Copia shallow de los detalles para permitir edicion inmutable por fila.
    setEditDetalles(detalles.map((d) => ({ ...d })))
    setIsEditMode(true)
  }

  const cancelEditMode = () => {
    setIsEditMode(false)
    setEditDetalles([])
  }

  const handleEditHeaderChange = (
    field: keyof typeof editHeader,
    value: string
  ) => {
    setEditHeader((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditDetalleChange = (
    id2: string,
    field: keyof DetalleOrden,
    value: string
  ) => {
    setEditDetalles((prev) => {
      const updated = prev.map((d) => {
        if (d.id2 !== id2) return d
        // `pcs` es numerico en la tabla: convertimos manteniendo "" -> 0
        if (field === "pcs") {
          const n = parseInt(value, 10)
          return { ...d, pcs: Number.isNaN(n) ? 0 : n }
        }
        return { ...d, [field]: value } as DetalleOrden
      })

      // Cuando se edita la cantidad de pcs de cualquier producto, recalcular
      // la sumatoria y sincronizarla en el campo pcs de la cabecera para
      // mantener la coherencia entre detalle y encabezado de la orden.
      if (field === "pcs") {
        const newTotal = updated.reduce((sum, d) => sum + (d.pcs ?? 0), 0)
        setEditHeader((prev) => ({ ...prev, pcs: String(newTotal) }))
      }

      return updated
    })
  }

  /**
   * Persiste los cambios del modo edicion.
   * - cabecera: UPDATE con los 4 campos editables via onUpdateOrden.
   * - detalleorden: UPDATE individual por cada fila modificada (match por id2).
   * Solo se envian filas que realmente cambiaron para reducir trafico.
   */
  const handleSaveEdit = async () => {
    if (!supabase) {
      toast.error("Supabase no configurado", {
        description: "No se pueden guardar los cambios sin credenciales.",
      })
      return
    }

    // Validacion basica
    const pcsNum = parseInt(editHeader.pcs, 10)
    if (editHeader.pcs !== "" && Number.isNaN(pcsNum)) {
      toast.error("Total PCS invalido", {
        description: "El total de piezas debe ser un numero entero.",
      })
      return
    }

    setIsSavingEdit(true)

    // 1. UPDATE cabecera solo con los 4 campos editables.
    const headerUpdates: Partial<Orden> = {
      fecha_de_ingreso: editHeader.fecha_de_ingreso || undefined,
      fecha_de_entrega: editHeader.fecha_de_entrega || undefined,
      pcs: editHeader.pcs === "" ? undefined : pcsNum,
      ciudad: editHeader.ciudad || undefined,
    }

    const headerResult = await onUpdateOrden(orden.pedido, headerUpdates)
    if (!headerResult.success) {
      toast.error("Error al guardar cabecera", {
        description: headerResult.error || "No se pudo actualizar la orden.",
      })
      setIsSavingEdit(false)
      return
    }

    // 2. UPDATE detalleorden solo para filas que cambiaron.
    const originalById = new Map(detalles.map((d) => [d.id2, d]))
    const dirtyRows = editDetalles.filter((row) => {
      const orig = originalById.get(row.id2)
      if (!orig) return false
      return (
        orig.nombre !== row.nombre ||
        orig.tela !== row.tela ||
        orig.genero !== row.genero ||
        orig.estilo !== row.estilo ||
        orig.talla !== row.talla ||
        orig.pcs !== row.pcs ||
        (orig.comentarios || "") !== (row.comentarios || "")
      )
    })

    for (const row of dirtyRows) {
      const { error: detErr } = await supabase
        .schema("telas")
        .from("detalleorden")
        .update({
          nombre: row.nombre,
          tela: row.tela,
          genero: row.genero,
          estilo: row.estilo,
          talla: row.talla,
          pcs: row.pcs,
          comentarios: row.comentarios,
        })
        .eq("id2", row.id2)

      if (detErr) {
        toast.error("Error al guardar detalle", {
          description: `Fila ${row.nombre}: ${detErr.message}`,
        })
        setIsSavingEdit(false)
        return
      }
    }

    // 3. Refrescar la lista local de detalles para que la vista "read-only"
    // muestre los valores nuevos al salir del modo edicion.
    setDetalles(editDetalles.map((d) => ({ ...d })))

    setIsSavingEdit(false)
    setIsEditMode(false)
    toast.success("Cambios guardados", {
      description: `La orden ${orden.pedido} se actualizo correctamente${
        dirtyRows.length > 0 ? ` (${dirtyRows.length} producto(s) modificado(s))` : ""
      }.`,
    })
  }

  const handleReject = async (motivo: string) => {
    setActionLoading("reject")
    const wasApproved = orden.estado_aprobado_rechazado === "Aprobado"
    const result = await onUpdateOrden(orden.pedido, {
      estado_aprobado_rechazado: "Rechazado",
      motivo_rechazo: motivo,
    })
    setActionLoading(null)

    if (result.success) {
      toast.success("Orden rechazada", {
        description: `La orden ${orden.pedido} ha sido rechazada exitosamente.`,
      })
      setShowRejectModal(false)
      // Si la orden estaba Pendiente, regresa a la lista para que el Planner
      // vea el cambio reflejado. Si estaba Aprobada, permanece en el detalle
      // donde el badge ya mostrara "Rechazado" y el boton "Volver a Aprobar"
      // aparecera disponible.
      if (!wasApproved) {
        onBack()
      }
    } else {
      toast.error("Error al rechazar", {
        description: result.error || "No se pudo rechazar la orden.",
      })
    }
  }

  const handleReprogram = async (data: ReprogramPayload) => {
    setActionLoading("reprogram")
    const result = await onUpdateOrden(orden.pedido, data)
    setActionLoading(null)

    if (result.success) {
      toast.success("Orden reprogramada", {
        description: `Fechas objetivo recalculadas desde ${data.fecha_programacion}.`,
      })
    } else {
      toast.error("Error al reprogramar", {
        description: result.error || "No se pudo reprogramar la orden.",
      })
    }
  }

  /**
   * Revierte una orden previamente "Rechazada" a "Aprobada".
   * Calcula las fechas objetivo a partir de HOY (getTodayISO) porque
   * la fecha_programacion original puede estar desactualizada luego
   * del rechazo.
   */
  const handleReversion = async (motivo: string) => {
    setActionLoading("reversion")

    const fechaBase = orden.fecha_programacion || getTodayISO()
    const skip = orden.solo_corte_costura
    const targetCorte = addDaysSkippingSundays(fechaBase, 3)
    const targetCostura = addDaysSkippingSundays(fechaBase, 6)
    const targetEmpaque = addDaysSkippingSundays(fechaBase, 8)

    const payload: Partial<Orden> = {
      estado_aprobado_rechazado: "Aprobado",
      motivo_reversion: motivo,
      fecha_programacion: fechaBase,
      dfecha_objetivo_d: skip ? undefined : addDaysSkippingSundays(fechaBase, 3),
      cfecha_objetivo_c: targetCorte,
      ifecha_objetivo_i: skip ? undefined : addDaysSkippingSundays(fechaBase, 4),
      sfecha_objetivo_s: skip ? undefined : addDaysSkippingSundays(fechaBase, 5),
      cosfecha_objetivo_cs: targetCostura,
      efecha_objetivo_e: targetEmpaque,
    }

    const result = await onUpdateOrden(orden.pedido, payload)
    setActionLoading(null)

    if (result.success) {
      toast.success("Orden reactivada", {
        description: `La orden ${orden.pedido} ha vuelto a estado Aprobado.`,
      })
      setShowReversionModal(false)
    } else {
      toast.error("Error al reactivar", {
        description: result.error || "No se pudo revertir la orden.",
      })
    }
  }

  const handleCancel = async () => {
    setActionLoading("cancel")
    const result = await onUpdateOrden(orden.pedido, {
      estado_aprobado_rechazado: "cancelado",
    })
    setActionLoading(null)

    if (result.success) {
      toast.success("Orden cancelada", {
        description: `La orden ${orden.pedido} ha sido cancelada y no aparecera en ningun modulo.`,
      })
      setShowCancelModal(false)
      onBack()
    } else {
      toast.error("Error al cancelar", {
        description: result.error || "No se pudo cancelar la orden.",
      })
    }
  }

  const handleApprove = async (data: Partial<Orden>) => {
    const result = await onUpdateOrden(orden.pedido, data)
    
    if (result.success) {
      toast.success("Orden aprobada", {
        description: `La orden ${orden.pedido} ha sido aprobada exitosamente.`,
      })
      onBack()
    } else {
      toast.error("Error al aprobar", {
        description: result.error || "No se pudo aprobar la orden.",
      })
    }
  }

  const getEstadoBadge = (estado: Orden["estado_aprobado_rechazado"] | null | undefined) => {
    if (estado === "Aprobado") {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          Aprobado
        </Badge>
      )
    }
    if (estado === "Rechazado") {
      return (
        <Badge variant="destructive" className="text-xs">
          Rechazado
        </Badge>
      )
    }
    if (estado === "cancelado") {
      return (
        <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-xs">
          <Ban className="mr-1 size-3" />
          Cancelado
        </Badge>
      )
    }
    // Default: Pendiente, null, or undefined
    return (
      <Badge variant="secondary" className="text-xs">
        Pendiente
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with back button and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit text-sm">
            <ArrowLeft className="mr-1.5 size-3.5" />
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{orden.pedido}</h1>
            {orden.es_urgente && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                <AlertTriangle className="mr-1 size-3" />
                Urgente
              </Badge>
            )}
            {getEstadoBadge(orden.estado_aprobado_rechazado)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Modo edicion: boton para activar (pide contrasena) o guardar/cancelar */}
          {!isEditMode ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditPasswordModal(true)}
              disabled={isLoading || actionLoading !== null}
              className="text-sm border-icon-cyan/40 text-icon-cyan hover:bg-icon-cyan/10 hover:text-icon-cyan"
              title="Activar edicion (requiere contrasena)"
            >
              <Pencil className="mr-1 size-3.5" />
              Editar informacion
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="bg-icon-cyan hover:bg-icon-cyan/90 text-white text-sm"
              >
                {isSavingEdit ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 size-3.5" />
                )}
                Guardar cambios
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditMode}
                disabled={isSavingEdit}
                className="text-sm"
              >
                <X className="mr-1 size-3.5" />
                Cancelar
              </Button>
            </>
          )}

          {/* Orden Pendiente: Aprobar + Rechazar + Cancelar */}
          {(orden.estado_aprobado_rechazado === "Pendiente" ||
            orden.estado_aprobado_rechazado === null ||
            orden.estado_aprobado_rechazado === undefined) && (
            <>
              <Button
                size="sm"
                onClick={() => setShowApprovalModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                {actionLoading === "approve" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1 size-3.5" />
                )}
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="text-sm"
              >
                {actionLoading === "reject" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <X className="mr-1 size-3.5" />
                )}
                Rechazar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCancelModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="text-sm border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Ban className="mr-1 size-3.5" />
                )}
                Cancelar Orden
              </Button>
            </>
          )}

          {/* Orden Aprobada: Reprogramar + Rechazar + Cancelar */}
          {orden.estado_aprobado_rechazado === "Aprobado" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReprogramModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="text-sm border-icon-cyan/40 text-icon-cyan hover:bg-icon-cyan/10 hover:text-icon-cyan"
              >
                {actionLoading === "reprogram" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1 size-3.5" />
                )}
                Reprogramar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="text-sm"
              >
                {actionLoading === "reject" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <X className="mr-1 size-3.5" />
                )}
                Rechazar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCancelModal(true)}
                disabled={isLoading || actionLoading !== null}
                className="text-sm border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Ban className="mr-1 size-3.5" />
                )}
                Cancelar Orden
              </Button>
            </>
          )}

          {/* Orden Rechazada: Volver a Aprobar (reversion) */}
          {orden.estado_aprobado_rechazado === "Rechazado" && (
            <Button
              size="sm"
              onClick={() => setShowReversionModal(true)}
              disabled={isLoading || actionLoading !== null}
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm"
            >
              {actionLoading === "reversion" ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 size-3.5" />
              )}
              Volver a Aprobar
            </Button>
          )}
        </div>
      </div>

      {/* Main content grid - 1/3 info panel + 2/3 products table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel - Información General (1/3 width) */}
        <Card className="lg:col-span-1 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-icon-cyan" />
              Informacion General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow icon={User} label="Cliente" value={orden.cliente} iconColor="text-icon-cyan" />
            <Separator />
            <InfoRow icon={FileText} label="Origen" value={orden.origen} iconColor="text-icon-teal" />
            <Separator />
            <InfoRow icon={User} label="Vendedora" value={orden.vendedora} iconColor="text-icon-purple" />
            <Separator />
            {isEditMode ? (
              <EditableRow
                icon={MapPin}
                label="Ciudad"
                iconColor="text-icon-coral"
              >
                <Input
                  value={editHeader.ciudad}
                  onChange={(e) =>
                    handleEditHeaderChange("ciudad", e.target.value)
                  }
                  className="h-8 text-sm"
                />
              </EditableRow>
            ) : (
              <InfoRow icon={MapPin} label="Ciudad" value={orden.ciudad} iconColor="text-icon-coral" />
            )}
            <Separator />
            <InfoRow icon={ShirtIcon} label="Estilo de Prenda" value={orden.estilo_de_la_prenda} iconColor="text-icon-magenta" />
            <Separator />
            <InfoRow icon={Tag} label="Etiqueta" value={orden.etiqueta} iconColor="text-icon-yellow" />
            <Separator />
            <InfoRow icon={Package} label="Empaque" value={orden.empaque} iconColor="text-icon-teal" />
            <Separator />
            <InfoRow icon={Gem} label="Accesorios" value={orden.accesorios} iconColor="text-icon-purple" />
            <Separator />
            {isEditMode ? (
              <EditableRow
                icon={Hash}
                label="Total PCS"
                iconColor="text-icon-cyan"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={editHeader.pcs}
                  onChange={(e) =>
                    handleEditHeaderChange("pcs", e.target.value)
                  }
                  className="h-8 text-sm"
                />
              </EditableRow>
            ) : (
              <InfoRow icon={Hash} label="Total PCS" value={orden.pcs?.toLocaleString()} iconColor="text-icon-cyan" />
            )}
            <Separator />
            {isEditMode ? (
              <EditableRow
                icon={Calendar}
                label="Fecha de Ingreso"
                iconColor="text-icon-green"
              >
                <Input
                  type="date"
                  value={editHeader.fecha_de_ingreso}
                  onChange={(e) =>
                    handleEditHeaderChange("fecha_de_ingreso", e.target.value)
                  }
                  className="h-8 text-sm"
                />
              </EditableRow>
            ) : (
              <InfoRow icon={Calendar} label="Fecha de Ingreso" value={formatDate(orden.fecha_de_ingreso)} iconColor="text-icon-green" />
            )}
            <Separator />
            {isEditMode ? (
              <EditableRow
                icon={Calendar}
                label="Fecha de Entrega"
                iconColor="text-icon-coral"
              >
                <Input
                  type="date"
                  value={editHeader.fecha_de_entrega}
                  onChange={(e) =>
                    handleEditHeaderChange("fecha_de_entrega", e.target.value)
                  }
                  className="h-8 text-sm"
                />
              </EditableRow>
            ) : (
              <InfoRow icon={Calendar} label="Fecha de Entrega" value={formatDate(orden.fecha_de_entrega)} iconColor="text-icon-coral" />
            )}
            <Separator />
            <InfoRow icon={MessageSquare} label="Comentario Ventas" value={orden.comentario_ventas} iconColor="text-icon-yellow" />
            <Separator />
            <InfoRow icon={Sparkles} label="Embellecimiento" value={orden.embellecimiento} iconColor="text-icon-magenta" />
            <Separator />
            <InfoRow icon={MessageSquare} label="Observaciones Planner" value={orden.observaciones_planner} iconColor="text-icon-teal" />
          </CardContent>
        </Card>

        {/* Right panel - Desglose de Producción / Productos (2/3 width) */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShirtIcon className="size-4 text-icon-magenta" />
              Desglose de Produccion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detallesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 mr-3" />
                <span className="text-muted-foreground">
                  Cargando detalles...
                </span>
              </div>
            ) : detallesError ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Error al cargar detalles: {detallesError}
                </AlertDescription>
              </Alert>
            ) : detalles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay productos registrados para esta orden
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto text-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Tela</TableHead>
                      <TableHead className="text-xs">Genero</TableHead>
                      <TableHead className="text-xs">Estilo</TableHead>
                      <TableHead className="text-xs">Talla</TableHead>
                      <TableHead className="text-xs text-right">Pcs</TableHead>
                      <TableHead className="text-xs">Comentarios</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(isEditMode ? editDetalles : detalles).map(
                      (detalle, index) => (
                        <TableRow key={detalle.id2 || `detalle-${index}`}>
                          <TableCell className="text-xs font-medium py-2">
                            {isEditMode ? (
                              <Input
                                value={detalle.nombre || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "nombre",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              detalle.nombre || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {isEditMode ? (
                              <Input
                                value={detalle.tela || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "tela",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              detalle.tela || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {isEditMode ? (
                              <Input
                                value={detalle.genero || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "genero",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              detalle.genero || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {isEditMode ? (
                              <Input
                                value={detalle.estilo || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "estilo",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              detalle.estilo || "-"
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            {isEditMode ? (
                              <Input
                                value={detalle.talla || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "talla",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs w-20"
                              />
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {detalle.talla || "-"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium py-2">
                            {isEditMode ? (
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={detalle.pcs ?? 0}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "pcs",
                                    e.target.value
                                  )
                                }
                                className="h-7 text-xs w-24 text-right ml-auto"
                              />
                            ) : (
                              detalle.pcs?.toLocaleString() || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2 whitespace-pre-wrap">
                            {isEditMode ? (
                              <Textarea
                                value={detalle.comentarios || ""}
                                onChange={(e) =>
                                  handleEditDetalleChange(
                                    detalle.id2,
                                    "comentarios",
                                    e.target.value
                                  )
                                }
                                className="min-h-[56px] text-xs"
                              />
                            ) : (
                              detalle.comentarios || "-"
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Options card (only show if order is approved) */}
      {orden.estado_aprobado_rechazado === "Aprobado" && (
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Opciones de Produccion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2">
                <div
                  className={`size-2.5 rounded-full ${
                    orden.es_marker_digital_si_no ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-sm ${
                    orden.es_marker_digital_si_no
                      ? "font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  Marker Digital
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`size-2.5 rounded-full ${
                    orden.personalizado_si_no ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-sm ${
                    orden.personalizado_si_no
                      ? "font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  Personalizado
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`size-2.5 rounded-full ${
                    orden.costura_si_no ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-sm ${
                    orden.costura_si_no ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  Costura {orden.maquina_costura && `(${orden.maquina_costura})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`size-2.5 rounded-full ${
                    orden.es_urgente ? "bg-amber-500" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-sm ${
                    orden.es_urgente ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  Urgente
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-4 items-center justify-center rounded-full ${
                    orden.solo_corte_costura
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Scissors className="size-2.5" />
                </div>
                <span
                  className={`text-sm ${
                    orden.solo_corte_costura
                      ? "font-medium text-amber-900"
                      : "text-muted-foreground"
                  }`}
                >
                  Solo Corte / Costura
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Modal */}
      <ApprovalModal
        orden={orden}
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onApprove={handleApprove}
      />

      {/* Reprogram Modal */}
      <ReprogramModal
        orden={orden}
        open={showReprogramModal}
        onClose={() => setShowReprogramModal(false)}
        onReprogram={handleReprogram}
      />

      {/* Reject Modal - pide motivo obligatorio antes de rechazar.
          El prop wasApproved ajusta el titulo y la descripcion del modal
          para diferenciar un rechazo inicial de una revocacion posterior. */}
      <RejectModal
        orden={orden}
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        wasApproved={orden.estado_aprobado_rechazado === "Aprobado"}
      />

      {/* Reversion Modal - reactiva una orden rechazada */}
      <ReversionModal
        orden={orden}
        open={showReversionModal}
        onClose={() => setShowReversionModal(false)}
        onConfirm={handleReversion}
      />

      {/* Cancel Modal - confirma la cancelacion de la orden */}
      <CancelModal
        orden={orden}
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
      />

      {/* Edit Mode Modal - pide la contrasena antes de activar edicion */}
      <EditModeModal
        open={showEditPasswordModal}
        onClose={() => setShowEditPasswordModal(false)}
        onUnlock={enterEditMode}
      />
    </div>
  )
}
