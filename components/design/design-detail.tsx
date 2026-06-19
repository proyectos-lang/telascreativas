"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useDesign } from "@/lib/design-context"
import { ReceiveModal } from "./receive-modal"
import { ChangesModal } from "./changes-modal"
import { FinishModal } from "./finish-modal"
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
  Edit3,
  CheckCircle2,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  ShirtIcon,
  Hash,
  ClipboardList,
  Palette,
  Tag,
  Lock,
  Package,
  UserCircle,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface DesignDetailProps {
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

export function DesignDetail({ orden, onBack }: DesignDetailProps) {
  const { updateOrden } = useDesign()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
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

      console.log("[v0] Design - Detalles de orden:", data)
      console.log("[v0] Design - Error detalles:", error)

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
      toast.success("Diseno recibido", {
        description: `La orden ${orden.pedido} se registro como recibida en diseno.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion del diseno.",
      })
    }
  }

  const handleSaveChanges = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Cambios registrados", {
        description: `Los cambios para la orden ${orden.pedido} se guardaron correctamente.`,
      })
      setShowChangesModal(false)
    } else {
      toast.error("Error al guardar cambios", {
        description:
          result.error || "No se pudieron guardar los cambios del diseno.",
      })
    }
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Diseno terminado", {
        description: `La orden ${orden.pedido} se marco como terminada.`,
      })
      setShowFinishModal(false)
    } else {
      toast.error("Error al terminar", {
        description:
          result.error || "No se pudo marcar el diseno como terminado.",
      })
    }
  }

  // Calculate design state
  const getDesignStateBadge = () => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.dfecha_de_ingreso_diseno) {
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

  const isReceived = Boolean(orden.dfecha_de_ingreso_diseno)
  const isFinished = Boolean(orden.dentrega_diseno)
  const isApproved = orden.estado_aprobado_rechazado === "Aprobado"

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
            {getDesignStateBadge()}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ReportarIncidenciaButton pedido={orden.pedido} areaActual="Diseno" />
          <Button
            size="sm"
            onClick={() => setShowReceiveModal(true)}
            disabled={!isApproved || isReceived || isFinished}
            title={
              !isApproved
                ? "Esta orden aun no ha sido aprobada por el Planner"
                : undefined
            }
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            <Inbox className="mr-1 size-3.5" />
            Recibir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowChangesModal(true)}
            disabled={!isReceived || isFinished}
            className="text-sm"
          >
            <Edit3 className="mr-1 size-3.5" />
            Registrar Cambios
          </Button>
          <Button
            size="sm"
            onClick={() => setShowFinishModal(true)}
            disabled={!isReceived || isFinished}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Terminar
          </Button>
        </div>
      </div>

      {/* Alert when order is not yet approved by the planner */}
      {!isApproved && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Esta orden aun no ha sido aprobada por el Planner. No es posible
            recibirla en diseno hasta que se complete su aprobacion.
          </AlertDescription>
        </Alert>
      )}

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
            <InfoRow
              icon={User}
              label="Cliente"
              value={orden.cliente}
              iconColor="text-icon-cyan"
            />
            <Separator />
            <InfoRow
              icon={UserCircle}
              label="Vendedora"
              value={orden.vendedora}
              iconColor="text-icon-teal"
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
              icon={Palette}
              label="Tipo de Diseno"
              value={orden.tipo_prediseno}
              iconColor="text-icon-magenta"
            />
            <Separator />
            <InfoRow
              icon={Package}
              label="Accesorios"
              value={orden.accesorios}
              iconColor="text-icon-yellow"
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
              icon={Tag}
              label="Estado"
              value={getDesignStateBadge()}
              iconColor="text-icon-teal"
            />
            <Separator />
            <InfoRow
              icon={Calendar}
              label="Fecha Objetivo"
              value={formatDate(orden.dfecha_objetivo_d)}
              iconColor="text-icon-purple"
            />
            {orden.dfecha_de_ingreso_diseno && (
              <>
                <Separator />
                <InfoRow
                  icon={Inbox}
                  label="Fecha Ingreso Diseno"
                  value={formatDate(orden.dfecha_de_ingreso_diseno)}
                  iconColor="text-icon-green"
                />
              </>
            )}
            {orden.ddisenador && (
              <>
                <Separator />
                <InfoRow
                  icon={User}
                  label="Disenador"
                  value={orden.ddisenador}
                  iconColor="text-icon-purple"
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

      {/* Instrucciones del Planner. En Diseno solo se muestran las del
          planner ya que es el primer eslabon del flujo. */}
      <InstructionsAndComments orden={orden} area="diseno" />

      {/* Receive Modal */}
      <ReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      {/* Changes Modal */}
      <ChangesModal
        orden={orden}
        open={showChangesModal}
        onClose={() => setShowChangesModal(false)}
        onSave={handleSaveChanges}
      />

      {/* Finish Modal */}
      <FinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
      />
    </div>
  )
}
