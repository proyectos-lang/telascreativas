"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useCut } from "@/lib/cut-context"
import { CutReceiveModal } from "./cut-receive-modal"
import { CutFinishModal } from "./cut-finish-modal"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
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
  Scissors,
  Tag,
  Lock,
  Palette,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface CutDetailProps {
  orden: Orden
  onBack: () => void
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

export function CutDetail({ orden, onBack }: CutDetailProps) {
  const { updateOrden } = useCut()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
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

      console.log("[v0] Cut - Detalles de orden:", data)
      console.log("[v0] Cut - Error detalles:", error)

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
      toast.success("Orden recibida en Corte", {
        description: `La orden ${orden.pedido} se registro como recibida en el area de Corte.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion en Corte.",
      })
    }
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Corte terminado", {
        description: `La orden ${orden.pedido} se marco como terminada en Corte.`,
      })
      setShowFinishModal(false)
      onBack()
    } else {
      toast.error("Error al terminar", {
        description:
          result.error || "No se pudo marcar el corte como terminado.",
      })
    }
  }

  // Cut state calculations
  // Flujo NORMAL: Corte trabaja en PARALELO con Diseño, solo lo bloquea la
  //   aprobacion del Planner.
  // Flujo YARDAJE: Corte va DESPUES de Sublimacion (Diseño -> Impresion ->
  //   Sublimacion -> Corte), por lo que solo se habilita cuando Sublimacion
  //   ha terminado (seta_sublimacion).
  const estadoNormalized = (orden.estado_aprobado_rechazado || "")
    .toString()
    .trim()
    .toLowerCase()
  const isApprovedByPlanner = estadoNormalized === "aprobado"
  const isYardaje =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "YARDAJE"
  const isSublimationFinished = Boolean(orden.seta_sublimacion)
  // Condicion para habilitar el "Recibir" en Corte segun el flujo.
  const isReadyToReceive = isYardaje
    ? isApprovedByPlanner && isSublimationFinished
    : isApprovedByPlanner
  const isDesignDelivered = Boolean(orden.dentrega_diseno)
  const isReceivedInCut = Boolean(orden.cfecha_de_recepcion)
  const isCutFinished = Boolean(orden.cfecha_de_corte)

  // Get design status badge (for info panel)
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

  // Get cut state badge (for header)
  const getCutStateBadge = () => {
    if (orden.cfecha_de_corte) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.cfecha_de_recepcion) {
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

  // Dynamic button text and tooltip for Recibir.
  // Flujo normal: solo requiere aprobacion del Planner (Corte en paralelo
  //   con Diseño). Flujo YARDAJE: ademas exige que Sublimacion haya terminado.
  const recibirLabel = !isApprovedByPlanner
    ? "Esperando aprobación de Planner"
    : isYardaje && !isSublimationFinished
      ? "Esperando a Sublimación"
      : "Recibir"
  const recibirTooltip = !isApprovedByPlanner
    ? "El Planner aun no ha aprobado esta orden"
    : isYardaje && !isSublimationFinished
      ? "En Yardaje el Corte se realiza despues de Sublimacion: debe terminar Sublimacion primero"
      : undefined

  return (
    <div className="space-y-6">
      {/* Header with back button and action buttons */}
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
            {getCutStateBadge()}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ReportarIncidenciaButton pedido={orden.pedido} areaActual="Corte" />
          <Button
            size="sm"
            onClick={() => setShowReceiveModal(true)}
            disabled={!isReadyToReceive || isReceivedInCut || isCutFinished}
            title={recibirTooltip}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
          >
            {!isReadyToReceive ? (
              <Lock className="mr-1 size-3.5" />
            ) : (
              <Inbox className="mr-1 size-3.5" />
            )}
            {recibirLabel}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowFinishModal(true)}
            disabled={!isReceivedInCut || isCutFinished}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Terminar
          </Button>
        </div>
      </div>

      {/* Alert when order has not been approved by the Planner */}
      {!isApprovedByPlanner && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Esta orden aun no ha sido aprobada por el Planner. Corte trabaja en
            paralelo con Diseno, pero requiere la aprobacion del Planner para
            ser procesada.
          </AlertDescription>
        </Alert>
      )}

      {/* Informational note: design is in process but Corte can still advance */}
      {isApprovedByPlanner && !isDesignDelivered && (
        <Alert className="border-sky-300 bg-sky-50 text-sky-900">
          <Palette className="size-4 text-sky-700" />
          <AlertDescription className="text-sky-900">
            Diseno aun no ha entregado los artes, pero Corte puede avanzar con
            el tendido y las piezas base en paralelo.
          </AlertDescription>
        </Alert>
      )}

      {/* Main content grid - 1/3 info panel + 2/3 products table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel - Informacion General (1/3 width) */}
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
              icon={Tag}
              label="Estado de Corte"
              value={getCutStateBadge()}
              iconColor="text-icon-teal"
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
              label="Fecha Objetivo Corte"
              value={formatDate(orden.cfecha_objetivo_c)}
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
            {orden.cfecha_de_recepcion && (
              <>
                <Separator />
                <InfoRow
                  icon={Inbox}
                  label="Fecha Recepcion Corte"
                  value={formatDate(orden.cfecha_de_recepcion)}
                  iconColor="text-icon-cyan"
                />
              </>
            )}
            {orden.cfecha_de_corte && (
              <>
                <Separator />
                <InfoRow
                  icon={Scissors}
                  label="Fecha de Corte"
                  value={formatDate(orden.cfecha_de_corte)}
                  iconColor="text-icon-green"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Right panel - Detalle de Productos (2/3 width) */}
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

      {/* Instrucciones del Planner. En Corte solo se muestran las del
          planner; Corte y Diseno corren en paralelo dentro del flujo. */}
      <InstructionsAndComments orden={orden} area="corte" />

      {/* Receive in Cut Modal */}
      <CutReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      {/* Finish Cut Modal */}
      <CutFinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
      />
    </div>
  )
}
