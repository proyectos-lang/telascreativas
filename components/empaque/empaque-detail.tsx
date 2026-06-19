"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useEmpaque } from "@/lib/empaque-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft,
  AlertTriangle,
  PackageCheck,
  CheckCircle2,
  Calendar,
  User,
  MapPin,
  Clock,
  Package,
  Inbox,
  Lock,
  Scissors,
} from "lucide-react"
import { EmpaqueReceiveModal } from "./empaque-receive-modal"
import { EmpaqueFinishModal } from "./empaque-finish-modal"
import { EmpaqueProductsTable } from "./empaque-products-table"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
import { FirmasTransferencia } from "@/components/shared/firmas-transferencia"
import { InstructionsAndComments } from "@/components/shared/instructions-and-comments"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface EmpaqueDetailProps {
  orden: Orden
  onBack: () => void
}

export function EmpaqueDetail({ orden, onBack }: EmpaqueDetailProps) {
  const { updateOrden } = useEmpaque()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)

  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)

  // Empaque state
  const isPacked = Boolean(orden.efecha_de_empaque)
  const hasPacker = Boolean(orden.enombre_de_quien_empaca)
  const isCosturaFinished = Boolean(orden.coseta_costura)
  const isSoloCorteCostura = orden.solo_corte_costura === true

  // VENTA_INVENTARIO: flujo directo a Empaque sin producción previa.
  // La orden se considera "lista para recibir" en cuanto está aprobada,
  // sin necesidad de que Costura (ni ninguna otra etapa) haya terminado.
  const isVentaInventario =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "VENTA_INVENTARIO"

  // isReadyToReceive: para VENTA_INVENTARIO basta con estar aprobada;
  // para el resto de flujos se requiere coseta_costura.
  const prerequisiteOk = isVentaInventario
    ? (orden.estado_aprobado_rechazado ?? "")
        .toString()
        .trim()
        .toLowerCase() === "aprobado"
    : isCosturaFinished
  const isReadyToReceive = prerequisiteOk && !hasPacker && !isPacked

  const fetchDetalles = useCallback(async () => {
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
      .order("id", { ascending: true })



    if (error) {
      setDetallesError(error.message)
    } else {
      setDetalles(data || [])
    }
    setDetallesLoading(false)
  }, [orden.pedido])

  useEffect(() => {
    fetchDetalles()
  }, [fetchDetalles])

  // Packing progress
  const totalPcs = detalles.reduce((sum, d) => sum + Number(d.pcs || 0), 0)
  const totalEmpacados = detalles.reduce(
    (sum, d) => sum + Number(d.pcs_empacados || 0),
    0
  )
  const isFullyPacked = totalPcs > 0 && totalEmpacados >= totalPcs

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  const getEstadoEmpaqueBadge = () => {
    if (isPacked) {
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (hasPacker) {
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-700">
          <Clock className="mr-1 size-3" />
          En Proceso
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Pendiente
      </Badge>
    )
  }

  const handleReceive = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Orden recibida en Empaque", {
        description: `La orden ${orden.pedido} se asigno al empacador ${data.enombre_de_quien_empaca}.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion en Empaque.",
      })
    }
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Orden 100% completada", {
        description: `La orden ${orden.pedido} cierra el flujo completo.`,
      })
      setShowFinishModal(false)
      onBack()
    } else {
      toast.error("Error al entregar", {
        description:
          result.error || "No se pudo marcar el empaque como terminado.",
      })
    }
  }

  // Dynamic labels
  const recibirLabel = hasPacker
    ? "Ya recibido"
    : !prerequisiteOk
      ? isVentaInventario
        ? "Pendiente de aprobacion"
        : "Esperando a Costura"
      : "Recibir"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Volver
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Pedido {orden.pedido}
            </h2>
            <p className="text-sm text-muted-foreground">{orden.cliente}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {orden.es_urgente && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600">
              <AlertTriangle className="mr-1 size-3" />
              Urgente
            </Badge>
          )}
          {isVentaInventario && (
            <Badge
              variant="outline"
              className="border-blue-300 text-blue-700 bg-blue-50"
              title="Venta de Inventario: llega directo a Empaque"
            >
              Venta Inventario
            </Badge>
          )}
          {!isVentaInventario && isSoloCorteCostura && (
            <Badge
              variant="outline"
              className="border-icon-green/40 text-icon-green bg-emerald-50"
              title="Flujo reducido: Solo Corte y Costura"
            >
              <Scissors className="mr-1 size-3" />
              Solo Corte/Costura
            </Badge>
          )}
          {getEstadoEmpaqueBadge()}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <ReportarIncidenciaButton
          pedido={orden.pedido}
          areaActual="Empaque"
        />
        <Button
          size="sm"
          onClick={() => setShowReceiveModal(true)}
          disabled={!isReadyToReceive}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
        >
          {!prerequisiteOk ? (
            <Lock className="mr-1 size-3.5" />
          ) : (
            <Inbox className="mr-1 size-3.5" />
          )}
          {recibirLabel}
        </Button>

        <Button
          size="sm"
          onClick={() => setShowFinishModal(true)}
          disabled={!hasPacker || isPacked}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
        >
          {isPacked ? (
            <>
              <CheckCircle2 className="mr-1 size-3.5" />
              Empaque Entregado
            </>
          ) : (
            <>
              <PackageCheck className="mr-1 size-3.5" />
              Terminar
            </>
          )}
        </Button>
      </div>

      {/* Alerts */}

      {/* VENTA_INVENTARIO: nota informativa de flujo directo */}
      {isVentaInventario && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <Inbox className="size-4 text-blue-700" />
          <AlertDescription className="text-blue-900">
            Orden de <strong>Venta de Inventario</strong>. Llega directo a
            Empaque sin pasar por Diseno, Corte, Impresion, Sublimacion ni
            Costura.
          </AlertDescription>
        </Alert>
      )}

      {/* Flujo normal / Solo Corte-Costura: bloqueo si Costura no terminó */}
      {!isVentaInventario && !isCosturaFinished && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Esta orden aun no ha sido terminada por el area de Costura. No es
            posible recibirla en Empaque hasta que Costura la entregue.
          </AlertDescription>
        </Alert>
      )}

      {/* Nota informativa del flujo reducido Solo Corte/Costura */}
      {!isVentaInventario && isSoloCorteCostura && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <Scissors className="size-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            Orden marcada como <strong>Solo Corte / Costura</strong>. Las etapas
            de Diseno, Impresion y Sublimacion se omiten; la orden llega aqui
            directamente desde Costura.
          </AlertDescription>
        </Alert>
      )}

      {isPacked && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="size-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            <strong>Orden 100% completada.</strong> El empaque se cerro el{" "}
            {formatDate(orden.efecha_de_empaque)}
            {orden.enombre_de_quien_empaca && (
              <> por {orden.enombre_de_quien_empaca}</>
            )}
            .
          </AlertDescription>
        </Alert>
      )}

      {hasPacker && !isPacked && !isFullyPacked && totalPcs > 0 && (
        <Alert className="border-blue-300 bg-blue-50 text-blue-900">
          <AlertTriangle className="size-4 text-blue-700" />
          <AlertDescription className="text-blue-900">
            Faltan{" "}
            <strong>{(totalPcs - totalEmpacados).toLocaleString()}</strong>{" "}
            piezas por empacar. Puedes registrar cantidades parciales
            acumulativas en la tabla de productos.
          </AlertDescription>
        </Alert>
      )}

      {/* General info - compact 2-column grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informacion General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{orden.cliente}</span>
            </div>
            {orden.ciudad && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Ciudad:</span>
                <span className="font-medium">{orden.ciudad}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Ingreso:</span>
              <span className="font-medium">
                {formatDate(orden.fecha_de_ingreso)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Entrega:</span>
              <span className="font-medium">
                {formatDate(orden.fecha_de_entrega)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Total Pcs:</span>
              <span className="font-medium">
                {orden.pcs?.toLocaleString() || "-"}
              </span>
            </div>
            {orden.empaque && (
              <div className="flex items-center gap-2">
                <PackageCheck className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Tipo Empaque:</span>
                <span className="font-medium">{orden.empaque}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="size-4 text-teal-600" />
              Estado de Empaque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Objetivo:</span>
              <span className="font-medium">
                {formatDate(orden.efecha_objetivo_e)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Empacador:</span>
              <span className="font-medium">
                {orden.enombre_de_quien_empaca || "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Inicio Empaque:</span>
              <span className="font-medium">
                {formatDate(orden.edia_de_entrega)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Empaque:</span>
              <span className="font-medium">
                {formatDate(orden.efecha_de_empaque)}
              </span>
            </div>
            {orden.ecomentario_entrega_e && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Comentario de Entrega:
                  </p>
                  <p className="text-sm italic text-foreground">
                    {orden.ecomentario_entrega_e}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products / accumulative packing */}
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="size-4 text-teal-600" />
            Productos - Registro de Cantidades Empacadas
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ingresa la cantidad a sumar en cada linea. El valor se acumula en el
            campo <code className="text-[11px]">pcs_empacados</code> de{" "}
            <code className="text-[11px]">detalleorden</code>.
          </p>
        </CardHeader>
        <CardContent>
          <EmpaqueProductsTable
            detalles={detalles}
            loading={detallesLoading}
            error={detallesError}
            onUpdated={fetchDetalles}
            disabled={!hasPacker || isPacked}
            disabledReason={
              !hasPacker
                ? "Debes recibir la orden en Empaque (asignar empacador) antes de registrar cantidades empacadas."
                : isPacked
                  ? "La orden ya fue entregada. No se pueden modificar las cantidades empacadas."
                  : undefined
            }
          />
        </CardContent>
      </Card>

      {/* Firmas de Transferencia: evidencia de las firmas relevantes a este
          modulo. La card se oculta automaticamente si no hay firmas. */}
      <FirmasTransferencia
        firmas={[
          {
            label: "Recibido por Costura",
            url: orden.s_firma_recibe_costura,
          },
          {
            label: "Recibido por Ventas / Vendedora",
            url: orden.e_firma_recibe_vendedora,
          },
        ]}
      />

      {/* Instrucciones y comentarios. Empaque ve Planner + Diseno + Corte
          + Impresion + Sublimacion + Costura. */}
      <InstructionsAndComments orden={orden} area="empaque" />

      {/* Modals */}
      <EmpaqueReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      <EmpaqueFinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
      />
    </div>
  )
}
