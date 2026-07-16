"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useCostura } from "@/lib/costura-context"
import { CosturaReceiveModal } from "./costura-receive-modal"
import { CosturaFinishModal } from "./costura-finish-modal"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
import { ReversarEntregaModal } from "@/components/shared/reversar-entrega-modal"
import { FirmasTransferencia } from "@/components/shared/firmas-transferencia"
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
  Flame,
  Palette,
  Scissors,
  Printer,
  Shirt,
  Lock,
  Factory,
  MinusCircle,
  AlertTriangle as AlertTriangleIcon,
  MessageSquare,
  TrendingUp,
  PackageCheck,
  CheckCheck,
  RotateCcw,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface CosturaDetailProps {
  orden: Orden
  onBack: () => void
}

function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor = "text-icon-purple",
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

export function CosturaDetail({ orden, onBack }: CosturaDetailProps) {
  const { updateOrden } = useCostura()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showReversarModal, setShowReversarModal] = useState(false)
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)
  // Estado para la accion de recibo parcial desde Sublimacion
  const [isRegistrandoParcial, setIsRegistrandoParcial] = useState(false)

  /**
   * Registra que Costura recibio parcialmente desde Sublimacion.
   * Escribe cos_fecha_recibo_parcial con la fecha de hoy en cabecera.
   */
  const handleReciboParcial = async () => {
    if (!supabase) {
      toast.error("Supabase no configurado")
      return
    }
    setIsRegistrandoParcial(true)
    const todayISO = new Date().toISOString().split("T")[0]
    const { error } = await supabase
      .schema("telas")
      .from("cabecera")
      .update({ cos_fecha_recibo_parcial: todayISO })
      .eq("pedido", orden.pedido)

    if (error) {
      toast.error("Error al registrar recibo parcial", {
        description: error.message,
      })
    } else {
      toast.success("Recibido parcialmente de Sublimacion", {
        description: `La recepcion parcial de la orden ${orden.pedido} fue registrada.`,
      })
      await updateOrden(orden.pedido, { cos_fecha_recibo_parcial: todayISO })
    }
    setIsRegistrandoParcial(false)
  }

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

  const handleReceive = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Orden recibida en Costura", {
        description: `La orden ${orden.pedido} se registro como recibida en el area de Costura.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion en Costura.",
      })
    }
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Costura terminada", {
        description: `La orden ${orden.pedido} se marco como terminada en Costura.`,
      })
      setShowFinishModal(false)
      onBack()
    } else {
      toast.error("Error al terminar", {
        description:
          result.error || "No se pudo marcar la costura como terminada.",
      })
    }
  }

  const handleReversar = async () => {
    const result = await updateOrden(orden.pedido, {
      coseta_costura: null,
      cosproceso_maquilado: null,
      cosfecha_recepcion_maquilador: null,
      cosnovedad_de_costura: null,
      coscantidad_costurada: null,
      cosmotivo_demora_recibido_cs: null,
      coscomentario_costura: null,
      cosmotivo_demora_terminado_cs: null,
      coscomentario_entrega_cs: null,
    } as unknown as Partial<Orden>)
    if (result.success) {
      toast.success("Entrega reversada", {
        description: `La entrega de Costura de ${orden.pedido} fue reversada.`,
      })
    } else {
      toast.error("Error al reversar", { description: result.error })
    }
  }

  // Flujo reducido "Solo Corte / Costura":
  // la orden se salta Diseno, Impresion y Sublimacion. Por lo tanto la etapa
  // previa a Costura pasa a ser Corte en vez de Sublimacion.
  const isSoloCorteCostura = orden.solo_corte_costura === true
  const isYardaje =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "YARDAJE"
  // En estos flujos la etapa previa a Costura es Corte (no Sublimacion).
  // En YARDAJE el corte se ejecuta DESPUES de Sublimacion.
  const previaEsCorte = isSoloCorteCostura || isYardaje

  // Gating rule para "Recibir en Costura":
  //   - flujo normal: Sublimacion debe estar terminada (seta_sublimacion)
  //   - Solo Corte/Costura y YARDAJE: Corte debe estar terminado (cfecha_de_corte)
  const isSublimationFinished = Boolean(orden.seta_sublimacion)
  const isCorteFinished = Boolean(orden.cfecha_de_corte)
  const isReadyToReceive = previaEsCorte
    ? isCorteFinished
    : isSublimationFinished
  const isReceivedInCostura = Boolean(orden.cosfecha_conteo)
  const isCosturaFinished = Boolean(orden.coseta_costura)

  // Status badges (info only) for upstream processes
  const makeStepBadge = (
    finishedDate: string | undefined,
    receivedDate?: string | undefined
  ) => {
    if (finishedDate) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (receivedDate) {
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

  // Badge para etapas que se saltan en flujo "Solo Corte / Costura".
  // Visualmente deshabilitado con borde gris y texto "N/A" para indicar
  // que la etapa no aplica a esta orden (no es un retraso ni un pendiente).
  const makeSkippedBadge = () => (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-400 text-xs"
      title="Esta etapa se omite en flujo Solo Corte/Costura"
    >
      <MinusCircle className="mr-1 size-3" />
      N/A - Omitido
    </Badge>
  )

  const getDesignStatusBadge = () => {
    if (orden.dentrega_diseno) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Entregado
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Pendiente
      </Badge>
    )
  }

  const getCosturaStateBadge = () => {
    if (orden.coseta_costura) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.cosfecha_conteo) {
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

  // Logica de flujo parcial: Sublimacion marco la entrega como "Parcial"
  // (s_estado_entrega) y Costura puede confirmar el recibo parcial.
  // "Recibir Parcial" aparece cuando:
  //   - s_estado_entrega === 'Parcial' (Sublimacion entrego pero no termino)
  //   - cos_fecha_recibo_parcial esta vacio (aun no se confirmo el recibo)
  //   - La orden no ha sido recibida completamente (sin cosfecha_conteo)
  const esFlujoPartial = orden.s_estado_entrega === "Parcial"
  const esFlujoCompletado = orden.s_estado_entrega === "Completado"
  const yaRecibioParcialment = Boolean(orden.cos_fecha_recibo_parcial)
  const showBotonReciboParcial =
    esFlujoPartial && !yaRecibioParcialment && !isReceivedInCostura && !isCosturaFinished
  // "Recibir Completo" = boton principal de recibo cuando Sublimacion termino
  // con firma (s_estado_entrega === 'Completado' o seta_sublimacion lleno).
  // Ya esta cubierto por el boton existente "Recibir"; solo lo resaltamos
  // visualmente cuando viene de un flujo parcial.
  const esCompletoDesflujoPartial = esFlujoCompletado || isSublimationFinished

  // Dynamic button text for Recibir. El bloqueo depende de cual es la etapa
  // previa segun el flujo (Sublimacion o Corte cuando es Solo Corte/Costura).
  const recibirLabel = !isReadyToReceive
    ? previaEsCorte
      ? "Esperando a Corte"
      : "Esperando a Sublimación"
    : "Recibir"
  const recibirTooltip = !isReadyToReceive
    ? previaEsCorte
      ? "Corte debe estar terminado antes de recibir en Costura"
      : "Sublimacion debe estar terminada antes de recibir en Costura"
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{orden.pedido}</h1>
            {orden.es_urgente && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                <AlertTriangle className="mr-1 size-3" />
                Urgente
              </Badge>
            )}
            {isSoloCorteCostura && (
              <Badge
                variant="outline"
                className="border-icon-green/40 text-icon-green bg-emerald-50"
                title="Flujo reducido: Solo Corte y Costura"
              >
                <Scissors className="mr-1 size-3" />
                Solo Corte/Costura
              </Badge>
            )}
            {getCosturaStateBadge()}
            {/* Badge dinamico de flujo parcial/completado desde Sublimacion */}
            {esFlujoPartial && !isCosturaFinished && (
              <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-400 text-xs border border-amber-500">
                <TrendingUp className="mr-1 size-3" />
                Flujo Parcial
              </Badge>
            )}
            {esFlujoCompletado && !isReceivedInCostura && !isCosturaFinished && (
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
                <CheckCircle2 className="mr-1 size-3" />
                Listo para Recibo Total
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ReportarIncidenciaButton
            pedido={orden.pedido}
            areaActual="Costura"
          />
          {/* Boton Recibir Parcial: solo visible cuando Sublimacion marco
              la entrega como Parcial y Costura aun no confirmo el recibo. */}
          {showBotonReciboParcial && (
            <Button
              size="sm"
              onClick={handleReciboParcial}
              disabled={isRegistrandoParcial}
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm"
              title="Sublimacion entrego parcialmente. Confirma el recibo en Costura."
            >
              {isRegistrandoParcial ? (
                <Spinner className="mr-1 size-3.5" />
              ) : (
                <PackageCheck className="mr-1 size-3.5" />
              )}
              Recibir Parcial
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowReceiveModal(true)}
            disabled={!isReadyToReceive || isReceivedInCostura || isCosturaFinished}
            title={recibirTooltip}
            className={`text-white text-sm disabled:bg-slate-400 disabled:text-white ${
              esCompletoDesflujoPartial && !isReceivedInCostura && isReadyToReceive
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {!isReadyToReceive ? (
              <Lock className="mr-1 size-3.5" />
            ) : esCompletoDesflujoPartial && !isReceivedInCostura ? (
              <CheckCheck className="mr-1 size-3.5" />
            ) : (
              <Inbox className="mr-1 size-3.5" />
            )}
            {esCompletoDesflujoPartial && !isReceivedInCostura && isReadyToReceive
              ? "Recibir Completo"
              : recibirLabel}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowFinishModal(true)}
            disabled={!isReceivedInCostura || isCosturaFinished}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Terminar
          </Button>
          {isCosturaFinished && (
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

      {/* Alert informativo: Sublimacion entrego parcialmente y Costura
          puede confirmar el recibo antes de que Sublimacion termine. */}
      {esFlujoPartial && !isReceivedInCostura && !isCosturaFinished && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <TrendingUp className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            <strong>Flujo Parcial activo:</strong> Sublimacion ha entregado
            parte de la orden. Puedes confirmar el{" "}
            <strong>Recibo Parcial</strong> ahora y esperar la entrega
            completa para usar <strong>Recibir Completo</strong>.
            {yaRecibioParcialment && (
              <> Recibo parcial ya confirmado el {orden.cos_fecha_recibo_parcial}.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Alert cuando Sublimacion completó y está lista para recibo total */}
      {esFlujoCompletado && !isReceivedInCostura && !isCosturaFinished && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="size-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            <strong>Lista para Recibo Total:</strong> Sublimacion termino y
            firmo la entrega completa. Usa <strong>Recibir Completo</strong>{" "}
            para iniciar el proceso de costura.
          </AlertDescription>
        </Alert>
      )}

      {/* Gating alert when the previous stage is not done. El nombre de la
          etapa previa depende del flujo (Sublimacion normalmente, Corte en
          flujo Solo Corte/Costura). */}
      {!isReadyToReceive && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Esta orden aun no esta lista para Costura. Falta que{" "}
            <strong>{isSoloCorteCostura ? "Corte" : "Sublimacion"}</strong>{" "}
            termine el proceso.
          </AlertDescription>
        </Alert>
      )}

      {/* Nota informativa del flujo reducido */}
      {isSoloCorteCostura && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <Scissors className="size-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            Orden marcada como <strong>Solo Corte / Costura</strong>. Las etapas
            de Diseno, Impresion y Sublimacion se omiten en este flujo.
          </AlertDescription>
        </Alert>
      )}

      {/* Main content grid - 1/3 info panel + 2/3 products table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel - Informacion General */}
        <Card className="lg:col-span-1 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-icon-purple" />
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
              value={
                isSoloCorteCostura
                  ? makeSkippedBadge()
                  : getDesignStatusBadge()
              }
              iconColor={
                isSoloCorteCostura ? "text-slate-400" : "text-icon-magenta"
              }
            />
            <Separator />
            <InfoRow
              icon={Scissors}
              label="Estado Corte"
              value={makeStepBadge(
                orden.cfecha_de_corte,
                orden.cfecha_de_recepcion
              )}
              iconColor="text-icon-green"
            />
            <Separator />
            <InfoRow
              icon={Printer}
              label="Estado Impresion"
              value={
                isSoloCorteCostura
                  ? makeSkippedBadge()
                  : makeStepBadge(
                      orden.ientrega_impresion,
                      orden.ifecha_de_ingreso_imp
                    )
              }
              iconColor={
                isSoloCorteCostura ? "text-slate-400" : "text-icon-cyan"
              }
            />
            <Separator />
            <InfoRow
              icon={Flame}
              label="Estado Sublimacion"
              value={
                isSoloCorteCostura
                  ? makeSkippedBadge()
                  : makeStepBadge(
                      orden.seta_sublimacion,
                      orden.sfecha_de_ingreso_sub
                    )
              }
              iconColor={
                isSoloCorteCostura ? "text-slate-400" : "text-icon-coral"
              }
            />
            <Separator />
            <InfoRow
              icon={Shirt}
              label="Estado Costura"
              value={getCosturaStateBadge()}
              iconColor="text-icon-purple"
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
              label="Fecha Objetivo Costura"
              value={formatDate(orden.cosfecha_objetivo_cs)}
              iconColor="text-icon-green"
            />
            {/* Estado de entrega de Sublimacion hacia Costura */}
            {orden.s_estado_entrega && orden.s_estado_entrega !== "Pendiente" && (
              <>
                <Separator />
                <InfoRow
                  icon={TrendingUp}
                  label="Estado Entrega Sub."
                  value={
                    <Badge
                      className={
                        orden.s_estado_entrega === "Completado"
                          ? "bg-emerald-500 text-white text-xs"
                          : "bg-amber-400 text-amber-900 text-xs border border-amber-500"
                      }
                    >
                      {orden.s_estado_entrega === "Completado"
                        ? "Listo para Recibo Total"
                        : "Flujo Parcial"}
                    </Badge>
                  }
                  iconColor={
                    orden.s_estado_entrega === "Completado"
                      ? "text-icon-green"
                      : "text-icon-yellow"
                  }
                />
              </>
            )}
            {orden.s_fecha_entrega_parcial && (
              <>
                <Separator />
                <InfoRow
                  icon={Calendar}
                  label="Primera Entrega Parcial"
                  value={formatDate(orden.s_fecha_entrega_parcial)}
                  iconColor="text-icon-coral"
                />
              </>
            )}
            {orden.cos_fecha_recibo_parcial && (
              <>
                <Separator />
                <InfoRow
                  icon={PackageCheck}
                  label="Recibo Parcial Costura"
                  value={formatDate(orden.cos_fecha_recibo_parcial)}
                  iconColor="text-icon-purple"
                />
              </>
            )}
            {orden.seta_sublimacion && (
              <>
                <Separator />
                <InfoRow
                  icon={Flame}
                  label="Entrega Sublimacion"
                  value={formatDate(orden.seta_sublimacion)}
                  iconColor="text-icon-coral"
                />
              </>
            )}
            {orden.cosfecha_conteo && (
              <>
                <Separator />
                <InfoRow
                  icon={Inbox}
                  label="Fecha Conteo"
                  value={formatDate(orden.cosfecha_conteo)}
                  iconColor="text-icon-purple"
                />
              </>
            )}
            {orden.cosnombre_de_persona_que_conto && (
              <>
                <Separator />
                <InfoRow
                  icon={User}
                  label="Contador"
                  value={orden.cosnombre_de_persona_que_conto}
                  iconColor="text-icon-cyan"
                />
              </>
            )}
            {orden.cosnombre_maquilador && (
              <>
                <Separator />
                <InfoRow
                  icon={Factory}
                  label="Maquilador"
                  value={orden.cosnombre_maquilador}
                  iconColor="text-icon-coral"
                />
              </>
            )}
            {orden.coscantidad_contada !== undefined &&
              orden.coscantidad_contada !== null && (
                <>
                  <Separator />
                  <InfoRow
                    icon={Hash}
                    label="Cantidad Contada"
                    value={orden.coscantidad_contada.toLocaleString()}
                    iconColor="text-icon-cyan"
                  />
                </>
              )}
            {/* Novedad y comentario capturados al RECIBIR la carga.
                Permiten al supervisor saber bajo que condiciones se acepto
                el trabajo (incompleto, parcial, etc.). Solo se muestran si
                el supervisor los registro. */}
            {orden.cos_motivo_demora_rec && (
              <>
                <Separator />
                <InfoRow
                  icon={AlertTriangleIcon}
                  label="Novedad al Recibir"
                  value={
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                      {orden.cos_motivo_demora_rec}
                    </span>
                  }
                  iconColor="text-icon-coral"
                />
              </>
            )}
            {orden.cos_comentario_recibo && (
              <>
                <Separator />
                <InfoRow
                  icon={MessageSquare}
                  label="Comentario de Recibo"
                  value={
                    <span className="whitespace-pre-wrap text-sm leading-relaxed">
                      {orden.cos_comentario_recibo}
                    </span>
                  }
                  iconColor="text-icon-purple"
                />
              </>
            )}
            {orden.coscantidad_costurada !== undefined &&
              orden.coscantidad_costurada !== null && (
                <>
                  <Separator />
                  <InfoRow
                    icon={ShirtIcon}
                    label="Cantidad Costurada"
                    value={orden.coscantidad_costurada.toLocaleString()}
                    iconColor="text-icon-purple"
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
                            <span className="italic">
                              {detalle.comentarios}
                            </span>
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

      {/* Firmas de Transferencia: evidencia visible para que Costura
          confirme que existe trazabilidad de la entrega de Sublimacion. */}
      <FirmasTransferencia
        firmas={[
          {
            label: "Recibido por Costura",
            url: orden.s_firma_recibe_costura,
          },
        ]}
      />

      {/* Instrucciones y comentarios. Costura ve Planner + Diseno + Corte
          + Impresion + Sublimacion (todo el flujo previo). */}
      <InstructionsAndComments orden={orden} area="costura" />

      {/* Receive Modal */}
      <CosturaReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      {/* Finish Modal */}
      <CosturaFinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
      />

      <ReversarEntregaModal
        open={showReversarModal}
        onClose={() => setShowReversarModal(false)}
        onConfirm={handleReversar}
        modulo="Costura"
      />
    </div>
  )
}
