"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { usePrint } from "@/lib/print-context"
import { PrintReceiveModal } from "./print-receive-modal"
import { PrintFinishModal } from "./print-finish-modal"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
import { ReversarEntregaModal } from "@/components/shared/reversar-entrega-modal"
import { InstructionsAndComments } from "@/components/shared/instructions-and-comments"
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
import {
  ArrowLeft,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  ShirtIcon,
  Hash,
  ClipboardList,
  Printer,
  Palette,
  Lock,
  FileText,
  Ruler,
  Scissors,
  Sparkles,
  Eye,
  RotateCcw,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface PrintDetailProps {
  orden: Orden
  onBack: () => void
}

function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor = "text-icon-cyan",
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined | null | React.ReactNode
  iconColor?: string
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="rounded-md bg-muted p-1.5 shrink-0">
        <Icon className={`size-3 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{displayValue}</div>
      </div>
    </div>
  )
}

export function PrintDetail({ orden, onBack }: PrintDetailProps) {
  const { updateOrden } = usePrint()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showReversarModal, setShowReversarModal] = useState(false)
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)

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

      console.log("[v0] Print - Detalles de orden:", data)
      console.log("[v0] Print - Error detalles:", error)

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

  const handleReceive = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Orden recibida en Impresion", {
        description: `La orden ${orden.pedido} se registro como recibida en el area de Impresion.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion en Impresion.",
      })
    }
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Impresion entregada", {
        description: `La orden ${orden.pedido} se marco como entregada por Impresion.`,
      })
      setShowFinishModal(false)
      onBack()
    } else {
      toast.error("Error al entregar", {
        description:
          result.error || "No se pudo marcar la impresion como entregada.",
      })
    }
  }

  const handleReversar = async () => {
    const result = await updateOrden(orden.pedido, {
      ientrega_impresion: null,
      icodigo_patron: null,
      iimpresora: null,
      iperfil_de_impresion: null,
      inombre_del_soporte_impresoras: null,
      ipapel: null,
      icantidad_de_la_orden: null,
      iinches: null,
      iyardas_impresion: null,
      imotivo_demora_terminado_i: null,
      icomentario_entrega_i: null,
    } as unknown as Partial<Orden>)
    if (result.success) {
      toast.success("Entrega reversada", {
        description: `La entrega de Impresión de ${orden.pedido} fue reversada.`,
      })
    } else {
      toast.error("Error al reversar", { description: result.error })
    }
  }

  // Gating rule: Receive is ONLY enabled once Design has delivered the order
  const isDesignDelivered = Boolean(orden.dentrega_diseno)
  const isReceivedInPrint = Boolean(orden.ifecha_de_ingreso_imp)
  const isPrintFinished = Boolean(orden.ientrega_impresion)

  // Design status badge (info only)
  const getDesignStatusBadge = () => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Entregado
        </Badge>
      )
    }
    if (orden.dfecha_de_ingreso_diseno) {
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs">
          <Inbox className="mr-1 size-3" />
          En Proceso
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Pendiente
      </Badge>
    )
  }

  // Print state badge (header)
  const getPrintStateBadge = () => {
    if (orden.ientrega_impresion) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.ifecha_de_ingreso_imp) {
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs">
          <Inbox className="mr-1 size-3" />
          Recibido
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Pendiente
      </Badge>
    )
  }

  // Dynamic button text for Recibir - gated by design delivery
  const recibirLabel = !isDesignDelivered
    ? "Esperando archivos de Diseño"
    : "Recibir"
  const recibirTooltip = !isDesignDelivered
    ? "Diseño aun no ha entregado los archivos para esta orden"
    : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="w-fit text-sm"
          >
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
            {getPrintStateBadge()}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ReportarIncidenciaButton
            pedido={orden.pedido}
            areaActual="Impresion"
          />
          <Button
            size="sm"
            onClick={() => setShowReceiveModal(true)}
            disabled={
              !isDesignDelivered || isReceivedInPrint || isPrintFinished
            }
            title={recibirTooltip}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
          >
            {!isDesignDelivered ? (
              <Lock className="mr-1 size-3.5" />
            ) : (
              <Inbox className="mr-1 size-3.5" />
            )}
            {recibirLabel}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowFinishModal(true)}
            disabled={!isReceivedInPrint || isPrintFinished}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Terminar
          </Button>
          {isPrintFinished && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReversarModal(true)}
              className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-sm"
            >
              <RotateCcw className="mr-1 size-3.5" />
              Reversar entrega
            </Button>
          )}
        </div>
      </div>

      {/* Gating alert when Design has not yet delivered */}
      {!isDesignDelivered && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Diseño aun no ha entregado los archivos para esta orden. Impresion
            podra recibir la orden una vez que Diseño entregue los artes.
          </AlertDescription>
        </Alert>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel - Informacion General */}
        <Card className="lg:col-span-1 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-icon-cyan" />
              Informacion General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              icon={User}
              label="Cliente"
              value={orden.cliente}
              iconColor="text-icon-cyan"
            />
            <Separator />
            <InfoRow
              icon={MapPin}
              label="Ciudad"
              value={orden.ciudad}
              iconColor="text-icon-coral"
            />
            <Separator />
            <InfoRow
              icon={Hash}
              label="Total PCS"
              value={orden.pcs?.toLocaleString()}
              iconColor="text-icon-cyan"
            />
            <Separator />
            <InfoRow
              icon={AlertTriangle}
              label="Urgencia"
              value={
                orden.es_urgente ? (
                  <Badge className="bg-amber-500 text-white text-xs">
                    Urgente
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Normal
                  </Badge>
                )
              }
              iconColor="text-icon-yellow"
            />
            <Separator />
            <InfoRow
              icon={Palette}
              label="Estatus de Diseno"
              value={getDesignStatusBadge()}
              iconColor="text-icon-magenta"
            />
            <Separator />
            <InfoRow
              icon={Printer}
              label="Estado Impresion"
              value={getPrintStateBadge()}
              iconColor="text-icon-cyan"
            />
            {/* Estado de Corte: clave para que el impresor sepa si ya hay
                tela cortada lista para coordinar entrada a Sublimacion.
                Si cfecha_de_corte tiene valor -> "Corte Terminado" verde,
                si no -> "Corte Pendiente" en ambar. */}
            <Separator />
            <InfoRow
              icon={Scissors}
              label="Estado de Corte"
              value={
                orden.cfecha_de_corte ? (
                  <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
                    <CheckCircle2 className="mr-1 size-3" />
                    Corte Terminado
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs">
                    <Inbox className="mr-1 size-3" />
                    Corte Pendiente
                  </Badge>
                )
              }
              iconColor="text-icon-coral"
            />
            {/* Disenador responsable: el impresor lo necesita por si tiene
                dudas con el archivo o necesita re-exportes. */}
            <Separator />
            <InfoRow
              icon={User}
              label="Disenador"
              value={orden.ddisenador}
              iconColor="text-icon-magenta"
            />
            {/* Tipo de Diseno: indica si es Nuevo, Repeticion o Ajuste.
                Ayuda al impresor a anticipar si debe buscar archivos previos. */}
            <Separator />
            <InfoRow
              icon={Sparkles}
              label="Tipo de Diseno"
              value={
                orden.tipo_prediseno ? (
                  <Badge variant="outline" className="text-xs">
                    {orden.tipo_prediseno}
                  </Badge>
                ) : undefined
              }
              iconColor="text-icon-purple"
            />
            {/* Lleva Muestra de Color: si dcheck_de_muestra_si_no = true se
                resalta con fondo rojo + icono de advertencia para que el
                impresor pida la muestra fisica ANTES de arrancar maquinas.
                Si es false / null se muestra como "No" sin enfasis. */}
            <Separator />
            <InfoRow
              icon={Eye}
              label="Lleva Muestra de Color"
              value={
                orden.dcheck_de_muestra_si_no === true ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-100 px-2 py-1 text-xs font-bold text-rose-900 ring-1 ring-rose-300">
                    <AlertTriangle className="size-3.5 text-rose-700" />
                    SI - Pedir muestra fisica
                  </span>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No
                  </Badge>
                )
              }
              iconColor={
                orden.dcheck_de_muestra_si_no === true
                  ? "text-rose-600"
                  : "text-icon-cyan"
              }
            />
            <Separator />
            <InfoRow
              icon={Calendar}
              label="Fecha Ingreso"
              value={formatDate(orden.fecha_de_ingreso)}
              iconColor="text-icon-purple"
            />
            <Separator />
            <InfoRow
              icon={Calendar}
              label="Fecha Objetivo Impresion"
              value={formatDate(orden.ifecha_objetivo_i)}
              iconColor="text-icon-green"
            />
            {orden.dentrega_diseno && (
              <>
                <Separator />
                <InfoRow
                  icon={Palette}
                  label="Entrega de Diseno"
                  value={formatDate(orden.dentrega_diseno)}
                  iconColor="text-icon-magenta"
                />
              </>
            )}
            {orden.ifecha_de_ingreso_imp && (
              <>
                <Separator />
                <InfoRow
                  icon={Inbox}
                  label="Fecha Recepcion Impresion"
                  value={formatDate(orden.ifecha_de_ingreso_imp)}
                  iconColor="text-icon-cyan"
                />
              </>
            )}
            {orden.iimpresora && (
              <>
                <Separator />
                <InfoRow
                  icon={Printer}
                  label="Impresora"
                  value={orden.iimpresora}
                  iconColor="text-icon-cyan"
                />
              </>
            )}
            {orden.iperfil_de_impresion && (
              <>
                <Separator />
                <InfoRow
                  icon={FileText}
                  label="Perfil de Impresion"
                  value={orden.iperfil_de_impresion}
                  iconColor="text-icon-magenta"
                />
              </>
            )}
            {orden.ipapel && (
              <>
                <Separator />
                <InfoRow
                  icon={FileText}
                  label="Papel"
                  value={orden.ipapel}
                  iconColor="text-icon-yellow"
                />
              </>
            )}
            {orden.iinches !== undefined && orden.iinches !== null && (
              <>
                <Separator />
                <InfoRow
                  icon={Ruler}
                  label="Inches / Yardas"
                  value={
                    <span>
                      {orden.iinches}&quot; /{" "}
                      {orden.iyardas_impresion ??
                        (orden.iinches / 36).toFixed(2)}{" "}
                      yd
                    </span>
                  }
                  iconColor="text-icon-green"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Right panel - Detalle de Productos */}
        <Card className="lg:col-span-2 bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShirtIcon className="size-4 text-icon-magenta" />
              Detalle de Productos
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
                      <TableHead className="text-xs min-w-[180px]">
                        Comentarios
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.map((detalle, index) => (
                      <TableRow key={detalle.id2 || `detalle-${index}`}>
                        <TableCell className="text-xs font-medium py-2">
                          {detalle.nombre || "-"}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {detalle.tela || "-"}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {detalle.genero || "-"}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {detalle.estilo || "-"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {detalle.talla || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium py-2">
                          {detalle.pcs?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell className="text-xs py-2 min-w-[180px] whitespace-normal text-muted-foreground">
                          {detalle.comentarios?.trim() ? (
                            <span className="italic">{detalle.comentarios}</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones y comentarios. En Impresion ya se ven las notas
          de Diseno (eslabon previo en el flujo). */}
      <InstructionsAndComments orden={orden} area="impresion" />

      {/* Receive Modal */}
      <PrintReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      {/* Finish Modal */}
      <PrintFinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
      />

      <ReversarEntregaModal
        open={showReversarModal}
        onClose={() => setShowReversarModal(false)}
        onConfirm={handleReversar}
        modulo="Impresión"
      />
    </div>
  )
}
