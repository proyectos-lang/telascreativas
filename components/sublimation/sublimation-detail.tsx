"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useSublimation } from "@/lib/sublimation-context"
import { useAuth } from "@/lib/auth-context"
import { SublimationReceiveModal } from "./sublimation-receive-modal"
import { SublimationFinishModal } from "./sublimation-finish-modal"
import { SublimationPartialDeliveryModal } from "./sublimation-partial-delivery-modal"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
import { ReversarEntregaModal } from "@/components/shared/reversar-entrega-modal"
import { FirmasTransferencia } from "@/components/shared/firmas-transferencia"
import { InstructionsAndComments } from "@/components/shared/instructions-and-comments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  Lock,
  PackagePlus,
  TrendingUp,
  UserCircle,
  Zap,
  RotateCcw,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface SublimationDetailProps {
  orden: Orden
  onBack: () => void
}

function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor = "text-icon-coral",
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

/**
 * Fila de la tabla `telas.entregas_parciales_sublimacion`. Las columnas
 * `producto_detalle`, `usuario` y `detalle_id` son opcionales por
 * compatibilidad con registros previos a los features incrementales de
 * trazabilidad por línea.
 */
export interface EntregaParcialRow {
  id?: number
  pedido: string
  cantidad: number
  fecha?: string
  producto_detalle?: string | null
  usuario?: string | null
  // FK a `telas.detalleorden.id` — identifica de qué línea/pieza se
  // entregó la cantidad. Permite calcular el acumulado por línea en el
  // modal de entrega parcial. Movimientos legacy lo tienen en null.
  detalle_id?: number | null
}

export function SublimationDetail({ orden, onBack }: SublimationDetailProps) {
  const { updateOrden, refreshOrdenes } = useSublimation()
  // Usuario activo para auditar la "Entrega Total" (mismo patrón que el
  // modal de entrega parcial). Cae a "Desconocido" si no hay sesión.
  const { usuarioActual } = useAuth()
  const usuarioRegistro =
    usuarioActual?.nombre || usuarioActual?.email || "Desconocido"
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showReversarModal, setShowReversarModal] = useState(false)
  const [showPartialModal, setShowPartialModal] = useState(false)
  // Confirmación + flag de envío para "Registrar Entrega Total". Es una
  // acción crítica (cierra todas las cantidades pendientes) por eso usa
  // un AlertDialog independiente del modal de entrega parcial.
  const [showTotalConfirm, setShowTotalConfirm] = useState(false)
  const [isSubmittingTotal, setIsSubmittingTotal] = useState(false)
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)
  // Lista de entregas parciales registradas para esta orden, ordenadas
  // por fecha desc (mas reciente primero) para que el supervisor las vea
  // como un timeline de movimientos del dia.
  const [entregasParciales, setEntregasParciales] = useState<
    EntregaParcialRow[]
  >([])
  const [entregasLoading, setEntregasLoading] = useState(true)

  /**
   * Recarga la lista de entregas parciales desde la BD. Se invoca al
   * montar el componente y despues de cada nueva entrega registrada.
   */
  const fetchEntregasParciales = async () => {
    if (!supabase) {
      setEntregasLoading(false)
      return
    }
    setEntregasLoading(true)
    const { data, error } = await supabase
      .schema("telas")
      .from("entregas_parciales_sublimacion")
      .select("*")
      .eq("pedido", orden.pedido)
      .order("fecha", { ascending: false })

    if (error) {
      console.log("[v0] Sublimation - Error entregas parciales:", error)
      setEntregasParciales([])
    } else {
      setEntregasParciales((data as EntregaParcialRow[]) || [])
    }
    setEntregasLoading(false)
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

      console.log("[v0] Sublimation - Detalles de orden:", data)
      console.log("[v0] Sublimation - Error detalles:", error)

      if (error) {
        setDetallesError(error.message)
      } else {
        setDetalles(data || [])
      }
      setDetallesLoading(false)
    }

    fetchDetalles()
    fetchEntregasParciales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.success("Orden recibida en Sublimacion", {
        description: `La orden ${orden.pedido} se registro como recibida en el area de Sublimacion.`,
      })
      setShowReceiveModal(false)
    } else {
      toast.error("Error al recibir", {
        description:
          result.error || "No se pudo registrar la recepcion en Sublimacion.",
      })
    }
  }

  /**
   * "Registrar Entrega Total": en un solo click cierra todas las
   * cantidades pendientes de la orden. Inserta una fila en
   * `entregas_parciales_sublimacion` por cada línea del detalleorden con
   * pendiente > 0 (cubriendo el faltante exacto de cada línea) y deja
   * `s_pcs_entregados_acumulado` igual a `pcs` total. Después refresca
   * para que el botón "Terminar" se habilite automáticamente.
   *
   * Se llama desde el AlertDialog de confirmación del header. Si la orden
   * no tiene líneas en detalleorden, igual hacemos el UPDATE del acumulado
   * (con `detalle_id` null en la fila de entrega) para no bloquear al
   * sublimador en órdenes legacy sin detalle desglosado.
   */
  const handleEntregaTotal = async () => {
    if (!supabase) {
      toast.error("Supabase no configurado")
      return
    }
    if (piezasFaltantes <= 0) {
      toast.info("No hay piezas pendientes por entregar.")
      setShowTotalConfirm(false)
      return
    }

    setIsSubmittingTotal(true)

    // 1. Construir filas a insertar: una por cada línea con pendiente > 0
    //    según el acumulado por línea ya registrado.
    const acumuladoPorLinea: Record<number, number> = {}
    for (const ep of entregasParciales) {
      if (ep.detalle_id == null) continue
      acumuladoPorLinea[ep.detalle_id] =
        (acumuladoPorLinea[ep.detalle_id] || 0) + (Number(ep.cantidad) || 0)
    }

    const filas = detalles
      .map((det) => {
        const pendienteLinea = Math.max(
          (Number(det.pcs) || 0) - (acumuladoPorLinea[det.id] || 0),
          0
        )
        return {
          det,
          pendiente: pendienteLinea,
        }
      })
      .filter((row) => row.pendiente > 0)
      .map(({ det, pendiente }) => ({
        pedido: orden.pedido,
        cantidad: pendiente,
        detalle_id: det.id,
        producto_detalle: `${det.nombre}${det.talla ? ` - ${det.talla}` : ""}`,
        usuario: usuarioRegistro,
      }))

    // Suma de los pendientes (debería igualar piezasFaltantes salvo en
    // órdenes legacy sin detalleorden poblado).
    const sumaFilas = filas.reduce((s, r) => s + r.cantidad, 0)

    // 2. Si hay líneas con pendiente, hacer INSERT batch.
    if (filas.length > 0) {
      const { error: insertError } = await supabase
        .schema("telas")
        .from("entregas_parciales_sublimacion")
        .insert(filas)

      if (insertError) {
        console.log("[v0] Sublimation - Entrega Total insert error:", insertError)
        toast.error("Error al registrar entrega total", {
          description: insertError.message,
        })
        setIsSubmittingTotal(false)
        return
      }
    }

    // 3. Si la orden no tenía líneas en detalleorden, o el acumulado por
    //    línea no llega al total (caso legacy con `detalle_id` nulos),
    //    insertamos una fila "comodín" con el remanente para mantener
    //    consistencia entre `s_pcs_entregados_acumulado` y la tabla.
    const remanente = piezasFaltantes - sumaFilas
    if (remanente > 0) {
      const { error: filaRemanenteError } = await supabase
        .schema("telas")
        .from("entregas_parciales_sublimacion")
        .insert({
          pedido: orden.pedido,
          cantidad: remanente,
          detalle_id: null,
          producto_detalle: "Entrega total (remanente)",
          usuario: usuarioRegistro,
        })
      if (filaRemanenteError) {
        console.log(
          "[v0] Sublimation - Entrega Total remanente error:",
          filaRemanenteError
        )
        toast.error("Error al registrar remanente", {
          description: filaRemanenteError.message,
        })
        setIsSubmittingTotal(false)
        return
      }
    }

    // 4. UPDATE acumulado al total exacto + estado de entrega para
    //    habilitar "Terminar" y notificar a Costura.
    const todayISO = new Date().toISOString().split("T")[0]
    const entregaTotalPayload: Record<string, unknown> = {
      s_pcs_entregados_acumulado: totalPcs,
      // Al registrar la entrega total el estado queda en "Parcial" porque
      // aun no se llamo "Terminar" (que cierra con firma y escribe
      // seta_sublimacion). El modal de Terminar actualiza esto a "Completado".
      s_estado_entrega: "Parcial",
    }
    if (!orden.s_fecha_entrega_parcial) {
      entregaTotalPayload.s_fecha_entrega_parcial = todayISO
    }
    const { error: updateError } = await supabase
      .schema("telas")
      .from("cabecera")
      .update(entregaTotalPayload)
      .eq("pedido", orden.pedido)

    if (updateError) {
      console.log("[v0] Sublimation - Entrega Total update error:", updateError)
      toast.error("Error al actualizar acumulado", {
        description: updateError.message,
      })
      setIsSubmittingTotal(false)
      return
    }

    toast.success("Entrega total registrada", {
      description: `Se cerraron ${formatPcs(
        piezasFaltantes
      )} pcs pendientes. Ya puedes Terminar la orden.`,
    })

    setIsSubmittingTotal(false)
    setShowTotalConfirm(false)
    await fetchEntregasParciales()
    await refreshOrdenes()
  }

  const handleFinish = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Sublimacion terminada", {
        description: `La orden ${orden.pedido} se marco como terminada en Sublimacion.`,
      })
      setShowFinishModal(false)
      onBack()
    } else {
      toast.error("Error al terminar", {
        description:
          result.error || "No se pudo marcar la sublimacion como terminada.",
      })
    }
  }

  const handleReversar = async () => {
    const result = await updateOrden(orden.pedido, {
      seta_sublimacion: null,
      stiempo_sublimacion: null,
      stemperatura: null,
      svelocidad: null,
      scantidad_sublimada: null,
      serrores: null,
      saprobacion_cliente_si_no: null,
      smotivo_demora_terminado_s: null,
      scomentario_entrega_s: null,
      s_firma_recibe_costura: null,
      s_estado_entrega: null,
      s_pcs_entregados_acumulado: null,
      s_fecha_entrega_parcial: null,
    } as unknown as Partial<Orden>)
    if (result.success) {
      toast.success("Entrega reversada", {
        description: `La entrega de Sublimación de ${orden.pedido} fue reversada.`,
      })
    } else {
      toast.error("Error al reversar", { description: result.error })
    }
  }

  // Gating rule (CRITICAL): Receive is enabled based on the flow:
  //   - VENTA_INVENTARIO con accesorios: no pasa por Impresión ni Corte;
  //     lista en cuanto la orden está aprobada.
  //   - YARDAJE / costura_si_no=false: solo requiere ientrega_impresion.
  //   - PRODUCCION_NORMAL con costura: requiere cfecha_de_corte Y ientrega_impresion.
  const isCutFinished = Boolean(orden.cfecha_de_corte)
  const isPrintDelivered = Boolean(orden.ientrega_impresion)
  const sinCostura =
    String(orden.costura_si_no ?? "true").trim().toLowerCase() === "false"
  const isYardaje =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
    "YARDAJE"
  const isVentaInventarioConAccesorios =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
      "VENTA_INVENTARIO" &&
    typeof orden.accesorios_inventario === "string" &&
    orden.accesorios_inventario.trim().length > 0
  const isReadyToReceive =
    isVentaInventarioConAccesorios
      ? true
      : sinCostura || isYardaje
      ? isPrintDelivered
      : isCutFinished && isPrintDelivered

  const isReceivedInSublimation = Boolean(orden.sfecha_de_ingreso_sub)
  const isSublimationFinished = Boolean(orden.seta_sublimacion)

  // Calculo del progreso de entregas parciales. Se usa el campo
  // s_pcs_entregados_acumulado de la cabecera (mantenido por el modal
  // de entrega parcial) en lugar de re-sumar la lista en cliente para
  // mantener una unica fuente de verdad.
  const totalPcs = orden.pcs ?? 0
  const acumulado = orden.s_pcs_entregados_acumulado ?? 0
  const piezasFaltantes = Math.max(totalPcs - acumulado, 0)
  const progresoPct =
    totalPcs > 0 ? Math.min(Math.round((acumulado / totalPcs) * 100), 100) : 0
  // Solo se permite cerrar la orden cuando el acumulado >= total. Esta
  // regla aplica unicamente cuando ya se recibio en Sublimacion; mientras
  // no se reciba el boton "Terminar" sigue bloqueado por el flujo previo.
  const canCloseOrder = totalPcs > 0 && acumulado >= totalPcs

  // Formato amigable de piezas: conserva hasta 2 decimales pero no
  // fuerza ".00" en valores enteros. Necesario porque las entregas
  // parciales ahora aceptan decimales (p. ej. 12.5 piezas).
  const formatPcs = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 })

  // Formato corto de fecha+hora para el timeline de entregas parciales.
  const formatDateTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

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
    return (
      <Badge variant="secondary" className="text-xs">
        Pendiente
      </Badge>
    )
  }

  // Cut status badge (info only)
  const getCutStatusBadge = () => {
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

  // Print status badge (info only)
  const getPrintStatusBadge = () => {
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

  // Sublimation state badge (header)
  const getSublimationStateBadge = () => {
    if (orden.seta_sublimacion) {
      return (
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Terminado
        </Badge>
      )
    }
    if (orden.sfecha_de_ingreso_sub) {
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

  // Dynamic button text for Recibir - gated by the applicable flow conditions
  const recibirLabel = !isReadyToReceive
    ? sinCostura || isYardaje
      ? "Esperando a Impresión"
      : "Esperando a Corte e Impresión"
    : "Recibir"
  const recibirTooltip = !isReadyToReceive
    ? sinCostura || isYardaje
      ? "Impresión debe estar terminada antes de recibir en Sublimación"
      : "Corte e Impresión deben estar terminados antes de recibir en Sublimación"
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
            {getSublimationStateBadge()}
            {/* Badge de estado de flujo de entregas parciales */}
            {orden.s_estado_entrega === "Parcial" && !orden.seta_sublimacion && (
              <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-400 text-xs border border-amber-500">
                <TrendingUp className="mr-1 size-3" />
                Flujo Parcial
              </Badge>
            )}
            {orden.s_estado_entrega === "Completado" && !orden.seta_sublimacion && (
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
            areaActual="Sublimacion"
          />
          <Button
            size="sm"
            onClick={() => setShowReceiveModal(true)}
            disabled={
              !isReadyToReceive ||
              isReceivedInSublimation ||
              isSublimationFinished
            }
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
          {/* Entrega Parcial: solo disponible cuando la orden ya esta
              recibida en Sublimacion y aun no se ha cerrado. Permite
              registrar entregas por partes a Costura mientras se sublima
              el resto. */}
          <Button
            size="sm"
            onClick={() => setShowPartialModal(true)}
            disabled={
              !isReceivedInSublimation ||
              isSublimationFinished ||
              piezasFaltantes === 0
            }
            title={
              !isReceivedInSublimation
                ? "Primero debes recibir la orden en Sublimacion"
                : piezasFaltantes === 0
                ? "Todas las piezas ya fueron entregadas"
                : undefined
            }
            className="bg-icon-coral hover:bg-icon-coral/90 text-white text-sm disabled:bg-slate-400 disabled:text-white"
          >
            <PackagePlus className="mr-1 size-3.5" />
            Registrar Entrega Parcial
          </Button>
          {/* Entrega Total: cierra todas las cantidades pendientes en un
              solo click. Útil cuando el sublimador termina la totalidad
              de la orden de una vez (no necesita registrar parcialidad
              por parcialidad). Habilita "Terminar" automáticamente. */}
          <Button
            size="sm"
            onClick={() => setShowTotalConfirm(true)}
            disabled={
              !isReceivedInSublimation ||
              isSublimationFinished ||
              piezasFaltantes === 0 ||
              isSubmittingTotal
            }
            title={
              !isReceivedInSublimation
                ? "Primero debes recibir la orden en Sublimacion"
                : piezasFaltantes === 0
                ? "Todas las piezas ya fueron entregadas"
                : "Cierra todas las piezas pendientes en un solo movimiento"
            }
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
          >
            {isSubmittingTotal ? (
              <Spinner className="mr-1 size-3.5" />
            ) : (
              <Zap className="mr-1 size-3.5" />
            )}
            Registrar Entrega Total
          </Button>
          {/* Terminar: solo se habilita cuando el acumulado de entregas
              parciales cubre el total de la orden. El tooltip indica al
              usuario cuantas piezas faltan para poder cerrar y firmar. */}
          <Button
            size="sm"
            onClick={() => setShowFinishModal(true)}
            disabled={
              !isReceivedInSublimation ||
              isSublimationFinished ||
              !canCloseOrder
            }
            title={
              !isReceivedInSublimation
                ? "Primero debes recibir la orden en Sublimacion"
                : !canCloseOrder
                ? `Faltan ${formatPcs(piezasFaltantes)} piezas por entregar para poder cerrar y firmar la orden`
                : undefined
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:bg-slate-400 disabled:text-white"
          >
            {!canCloseOrder && isReceivedInSublimation ? (
              <Lock className="mr-1 size-3.5" />
            ) : (
              <CheckCircle2 className="mr-1 size-3.5" />
            )}
            Terminar
          </Button>
          {isSublimationFinished && (
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

      {/* Gating alert when Cut or Print are not ready */}
      {!isReadyToReceive && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Lock className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            Esta orden aun no esta lista para Sublimacion.{" "}
            {sinCostura || isYardaje ? (
              // YARDAJE / sin costura: Sublimacion va ANTES de Corte
              // (Diseño -> Impresion -> Sublimacion -> Corte). Aqui solo
              // depende de que Impresion entregue, nunca de Corte.
              <>
                Falta que <strong>Impresion</strong> entregue la orden.
              </>
            ) : !isCutFinished && !isPrintDelivered ? (
              <>
                Falta que <strong>Corte</strong> termine y que{" "}
                <strong>Impresion</strong> entregue.
              </>
            ) : !isCutFinished ? (
              <>
                Falta que <strong>Corte</strong> termine el proceso.
              </>
            ) : (
              <>
                Falta que <strong>Impresion</strong> entregue la orden.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Card de progreso de entregas parciales. Se muestra unicamente
          cuando la orden ya fue recibida en Sublimacion (mientras no se
          reciba no tiene sentido mostrar el avance). Se mantiene visible
          incluso despues de cerrar la orden para preservar el historial. */}
      {isReceivedInSublimation && (
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-icon-coral" />
                Progreso de Entregas Parciales
              </CardTitle>
              <Badge
                variant={canCloseOrder ? "default" : "secondary"}
                className={
                  canCloseOrder
                    ? "bg-emerald-500 text-white hover:bg-emerald-600 self-start sm:self-auto"
                    : "self-start sm:self-auto"
                }
              >
                {formatPcs(acumulado)} / {formatPcs(totalPcs)} pcs
                {" - "}
                {progresoPct}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Progress value={progresoPct} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Entregado:{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatPcs(acumulado)}
                  </span>{" "}
                  pcs
                </span>
                <span>
                  Pendiente:{" "}
                  <span className="font-semibold text-amber-700">
                    {formatPcs(piezasFaltantes)}
                  </span>{" "}
                  pcs
                </span>
              </div>
              {!canCloseOrder && !isSublimationFinished && (
                <p className="text-xs text-muted-foreground">
                  <Lock className="inline size-3 mr-1 -mt-0.5" />
                  Faltan{" "}
                  <strong>
                    {formatPcs(piezasFaltantes)} piezas
                  </strong>{" "}
                  por entregar para poder cerrar y firmar la orden.
                </p>
              )}
            </div>

            {/* Timeline / lista de entregas parciales registradas */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Historial de Entregas
                </p>
                <span className="text-xs text-muted-foreground">
                  {entregasParciales.length}{" "}
                  {entregasParciales.length === 1
                    ? "movimiento"
                    : "movimientos"}
                </span>
              </div>
              {entregasLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  Cargando entregas...
                </div>
              ) : entregasParciales.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Aun no se han registrado entregas parciales.
                </p>
              ) : (
                // Tabla detallada del historial. Si hay muchas entregas la
                // ScrollArea evita que la vista de detalle crezca sin
                // limite; el header queda sticky para que las columnas
                // sean siempre visibles al hacer scroll.
                <ScrollArea className="max-h-[280px] rounded-md border bg-background">
                  <Table className="text-sm">
                    <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                      <TableRow>
                        <TableHead className="h-9 text-xs whitespace-nowrap">
                          Fecha
                        </TableHead>
                        <TableHead className="h-9 text-xs whitespace-nowrap">
                          Cantidad
                        </TableHead>
                        <TableHead className="h-9 text-xs">
                          Producto / Detalle
                        </TableHead>
                        <TableHead className="h-9 text-xs whitespace-nowrap">
                          Usuario
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entregasParciales.map((ep, idx) => (
                        <TableRow key={ep.id ?? `ep-${idx}`}>
                          <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(ep.fecha)}
                          </TableCell>
                          <TableCell className="py-2 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className="font-semibold text-emerald-700 border-emerald-300 bg-emerald-50"
                            >
                              +
                              {ep.cantidad != null
                                ? formatPcs(ep.cantidad)
                                : 0}{" "}
                              pcs
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-sm">
                            {ep.producto_detalle ? (
                              <span className="font-medium break-words">
                                {ep.producto_detalle}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Sin detalle
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 whitespace-nowrap">
                            {ep.usuario ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <UserCircle className="size-3 text-muted-foreground" />
                                {ep.usuario}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                -
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content grid - 1/3 info panel + 2/3 products table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel - Informacion General */}
        <Card className="lg:col-span-1 bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-icon-coral" />
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
              icon={Scissors}
              label="Estado Corte"
              value={getCutStatusBadge()}
              iconColor="text-icon-green"
            />
            <Separator />
            <InfoRow
              icon={Printer}
              label="Estado Impresion"
              value={getPrintStatusBadge()}
              iconColor="text-icon-cyan"
            />
            <Separator />
            <InfoRow
              icon={Flame}
              label="Estado Sublimacion"
              value={getSublimationStateBadge()}
              iconColor="text-icon-coral"
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
              label="Fecha Objetivo Sublimacion"
              value={formatDate(orden.sfecha_objetivo_s)}
              iconColor="text-icon-green"
            />
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
            {orden.ientrega_impresion && (
              <>
                <Separator />
                <InfoRow
                  icon={Printer}
                  label="Entrega Impresion"
                  value={formatDate(orden.ientrega_impresion)}
                  iconColor="text-icon-cyan"
                />
              </>
            )}
            {orden.sfecha_de_ingreso_sub && (
              <>
                <Separator />
                <InfoRow
                  icon={Inbox}
                  label="Fecha Recepcion Sublimacion"
                  value={formatDate(orden.sfecha_de_ingreso_sub)}
                  iconColor="text-icon-coral"
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

      {/* Firmas de Transferencia: evidencia de la entrega Sublimacion -> Costura.
          Si todavia no se ha terminado el proceso, la card no se renderiza. */}
      <FirmasTransferencia
        firmas={[
          {
            label: "Recibido por Costura",
            url: orden.s_firma_recibe_costura,
          },
        ]}
      />

      {/* Instrucciones y comentarios. En Sublimacion se ven Planner +
          Diseno + Corte + Impresion (todos los eslabones previos). */}
      <InstructionsAndComments orden={orden} area="sublimacion" />

      {/* Receive Modal */}
      <SublimationReceiveModal
        orden={orden}
        open={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        onReceive={handleReceive}
      />

      {/* Finish Modal. Le pasamos las entregas parciales ya cargadas para
          que muestre el desglose detallado de QUE se entrego en cada
          parcialidad antes de que la persona de Costura firme. */}
      <SublimationFinishModal
        orden={orden}
        open={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onFinish={handleFinish}
        entregasParciales={entregasParciales}
      />

      <ReversarEntregaModal
        open={showReversarModal}
        onClose={() => setShowReversarModal(false)}
        onConfirm={handleReversar}
        modulo="Sublimación"
      />

      {/* Confirmación de Entrega Total */}
      <AlertDialog
        open={showTotalConfirm}
        onOpenChange={(isOpen) => {
          // Si el submit está en curso evitamos cerrar el dialog para no
          // dejar al usuario sin feedback de la operación pendiente.
          if (!isSubmittingTotal) setShowTotalConfirm(isOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-amber-600" />
              ¿Registrar entrega total?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                Vas a cerrar todas las piezas pendientes de la orden{" "}
                <strong>{orden.pedido}</strong> en un solo movimiento.
              </span>
              <span className="block rounded-md border bg-muted/30 px-3 py-2">
                Pendiente actual:{" "}
                <strong className="text-amber-700">
                  {formatPcs(piezasFaltantes)} pcs
                </strong>{" "}
                — quedará en{" "}
                <strong className="text-emerald-700">
                  {formatPcs(totalPcs)} / {formatPcs(totalPcs)}
                </strong>{" "}
                y el botón <strong>Terminar</strong> se habilitará.
              </span>
              <span className="block text-xs text-muted-foreground">
                Esta acción registra una entrada por cada línea con
                pendiente y no puede deshacerse desde la app.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingTotal}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Evitamos el cierre automático del AlertDialogAction para
                // poder mantener el spinner visible mientras el INSERT
                // batch + UPDATE se completan. El handler cierra el
                // diálogo manualmente al terminar.
                e.preventDefault()
                handleEntregaTotal()
              }}
              disabled={isSubmittingTotal}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmittingTotal ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Registrando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 size-4" />
                  Sí, registrar total
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partial Delivery Modal: registra una entrega parcial (INSERT en
          entregas_parciales_sublimacion + UPDATE incremental del acumulado
          en cabecera). Al exito recargamos tanto la lista como las ordenes
          para que el header refleje el nuevo estado del gating. */}
      <SublimationPartialDeliveryModal
        orden={orden}
        open={showPartialModal}
        onClose={() => setShowPartialModal(false)}
        // Lista de líneas (piezas) de la orden — el modal renderiza una
        // fila por cada una para registrar cuánto se entrega de cada
        // pieza/talla en el movimiento actual.
        detalles={detalles}
        // Entregas previas para que el modal calcule el acumulado por
        // línea (suma de cantidades agrupadas por `detalle_id`).
        entregasPrevias={entregasParciales}
        onSuccess={() => {
          fetchEntregasParciales()
          refreshOrdenes()
        }}
      />
    </div>
  )
}
