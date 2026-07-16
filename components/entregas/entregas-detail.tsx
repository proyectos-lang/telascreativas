"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useEntregas } from "@/lib/entregas-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Calendar,
  User,
  MapPin,
  Package,
  PackageCheck,
  AlertTriangle,
  Loader2,
  PenLine,
  Maximize2,
  FileText,
  ExternalLink,
  Image as ImageIcon,
  Scissors,
  Sparkles,
  RotateCcw,
} from "lucide-react"
import { EntregasDeliverModal } from "./entregas-deliver-modal"
import { FirmasTransferencia } from "@/components/shared/firmas-transferencia"
import { ReversarEntregaModal } from "@/components/shared/reversar-entrega-modal"
import { InstructionsAndComments } from "@/components/shared/instructions-and-comments"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface EntregasDetailProps {
  orden: Orden
  onBack: () => void
}

/**
 * Determina si una URL de guia corresponde a un PDF. Revisa tanto la
 * extension del path como el query-string, porque Supabase Storage puede
 * anadir parametros de firma al final de la URL.
 */
function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return pathname.endsWith(".pdf")
  } catch {
    return url.toLowerCase().includes(".pdf")
  }
}

export function EntregasDetail({ orden, onBack }: EntregasDetailProps) {
  const { updateOrden } = useEntregas()
  const [showDeliverModal, setShowDeliverModal] = useState(false)
  const [showReversarModal, setShowReversarModal] = useState(false)
  const [showSignatureLightbox, setShowSignatureLightbox] = useState(false)

  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [detallesLoading, setDetallesLoading] = useState(true)
  const [detallesError, setDetallesError] = useState<string | null>(null)

  const isDelivered = orden.entregado_cliente_si_no === true
  // Flujo reducido "Solo Corte / Costura": unicamente afecta la visual
  // (la entrega al cliente solo requiere que el Empaque este cerrado).
  const isSoloCorteCostura = orden.solo_corte_costura === true
  // YARDAJE sin costura: salta Costura y Empaque; llega a Entregas directo
  // desde Sublimacion. No tiene fecha de empaque.
  const isYardajeSinCostura =
    (orden.tipo_flujo_especial ?? "").toString().trim().toUpperCase() ===
      "YARDAJE" &&
    String(orden.costura_si_no ?? "true").trim().toLowerCase() === "false"

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

    console.log("[v0] Entregas - Detalles de orden:", data)
    console.log("[v0] Entregas - Error detalles:", error)

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

  const totalPcs = detalles.reduce((sum, d) => sum + Number(d.pcs || 0), 0)
  const totalEmpacados = detalles.reduce(
    (sum, d) => sum + Number(d.pcs_empacados || 0),
    0
  )

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  const formatDateTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    return d.toLocaleString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
  }

  const handleReversar = async () => {
    const result = await updateOrden(orden.pedido, {
      entregado_cliente_si_no: false,
      fecha_entrega_cliente: null,
      comentario_entrega_cliente: null,
      firma_url: null,
      guia_envio_url: null,
    } as unknown as Partial<Orden>)
    if (result.success) {
      toast.success("Entrega reversada", {
        description: `La entrega al cliente de ${orden.pedido} fue reversada.`,
      })
    } else {
      toast.error("Error al reversar", { description: result.error })
    }
  }

  const handleDeliver = async (data: Partial<Orden>) => {
    const result = await updateOrden(orden.pedido, data)

    if (result.success) {
      toast.success("Orden entregada con exito", {
        description: `El pedido ${orden.pedido} fue marcado como entregado al cliente.`,
      })
      setShowDeliverModal(false)
      onBack()
    } else {
      toast.error("Error al registrar entrega", {
        description:
          result.error ||
          "No se pudo registrar la entrega al cliente. Intentalo de nuevo.",
      })
    }
  }

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
          {isYardajeSinCostura && (
            <Badge
              variant="outline"
              className="border-teal-300 text-teal-700 bg-teal-50"
              title="Yardaje sin costura: pasa directo de Sublimacion a Entregas"
            >
              <Sparkles className="mr-1 size-3" />
              Yardaje sin costura
            </Badge>
          )}
          {isDelivered ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
              <CheckCircle2 className="mr-1 size-3" />
              Entregado a Cliente
            </Badge>
          ) : (
            <Badge className="bg-blue-600 text-white hover:bg-blue-700">
              <Truck className="mr-1 size-3" />
              Listo para Entrega
            </Badge>
          )}
        </div>
      </div>

      {/* Nota informativa del flujo reducido */}
      {isSoloCorteCostura && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <Scissors className="size-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            Orden marcada como <strong>Solo Corte / Costura</strong>. Se
            fabrico sin Diseno, Impresion ni Sublimacion.
          </AlertDescription>
        </Alert>
      )}

      {/* Action area */}
      <div className="flex items-center gap-2 flex-wrap">
        {isDelivered ? (
          <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 flex-1">
            <CheckCircle2 className="size-4 text-emerald-700" />
            <AlertDescription className="text-emerald-900">
              <strong>
                Orden Entregada el {formatDateTime(orden.fecha_entrega_cliente)}
              </strong>
              {orden.comentario_entrega_cliente && (
                <>
                  {" "}
                  - {orden.comentario_entrega_cliente}
                </>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowDeliverModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          >
            <Truck className="mr-1 size-3.5" />
            Registrar Entrega a Cliente
          </Button>
        )}
        {isDelivered && (
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

      {/* Two-panel layout: Info General (left) + Productos (right) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: Informacion General */}
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-icon-magenta" />
              Informacion General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{orden.cliente || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Vendedora:</span>
              <span className="font-medium">{orden.vendedora || "-"}</span>
            </div>
            {orden.ciudad && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Ciudad:</span>
                <span className="font-medium">{orden.ciudad}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Total PCS:</span>
              <span className="font-medium">
                {orden.pcs?.toLocaleString() || totalPcs.toLocaleString() || "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PackageCheck className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">PCS Empacadas:</span>
              <span className="font-medium text-emerald-700">
                {totalEmpacados.toLocaleString()}
              </span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Fecha Ingreso:</span>
              <span className="font-medium">
                {formatDate(orden.fecha_de_ingreso)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {isYardajeSinCostura ? "Fecha Sublimacion:" : "Fecha Empaque:"}
              </span>
              <span className="font-medium text-teal-700">
                {formatDate(
                  isYardajeSinCostura
                    ? orden.seta_sublimacion
                    : orden.efecha_de_empaque
                )}
              </span>
            </div>
            {orden.enombre_de_quien_empaca && (
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Empacado por:</span>
                <span className="font-medium">
                  {orden.enombre_de_quien_empaca}
                </span>
              </div>
            )}

            {isDelivered && (
              <>
                <Separator />
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    Entrega Final al Cliente
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="size-3 text-emerald-700" />
                    <span className="text-emerald-800">Fecha:</span>
                    <span className="font-medium text-emerald-900">
                      {formatDateTime(orden.fecha_entrega_cliente)}
                    </span>
                  </div>
                  {orden.comentario_entrega_cliente && (
                    <div className="pt-1 border-t border-emerald-200">
                      <p className="text-xs text-emerald-800 mb-1">
                        Observaciones:
                      </p>
                      <p className="text-xs italic text-emerald-900">
                        {orden.comentario_entrega_cliente}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Productos (telas.detalleorden) */}
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4 text-icon-magenta" />
              Detalle de Productos
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Verifica fisicamente que cada linea este incluida antes de confirmar la entrega.
            </p>
          </CardHeader>
          <CardContent>
            {detallesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-icon-magenta" />
              </div>
            ) : detallesError ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{detallesError}</AlertDescription>
              </Alert>
            ) : detalles.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No hay productos registrados para esta orden.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Tela</TableHead>
                      <TableHead className="text-xs">Genero</TableHead>
                      <TableHead className="text-xs">Talla</TableHead>
                      <TableHead className="text-xs text-right">Pcs</TableHead>
                      <TableHead className="text-xs text-right">
                        Empacadas
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.map((detalle, index) => {
                      const empacados = Number(detalle.pcs_empacados || 0)
                      const total = Number(detalle.pcs || 0)
                      const isComplete = total > 0 && empacados >= total
                      return (
                        <TableRow
                          key={detalle.id2 || `detalle-${index}`}
                          className={
                            isComplete ? "bg-emerald-50/40" : undefined
                          }
                        >
                          <TableCell className="text-xs font-medium py-2">
                            {detalle.nombre || "-"}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {detalle.tela || "-"}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {detalle.genero || "-"}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-xs">
                              {detalle.talla || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium py-2">
                            {total.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right py-2">
                            <span
                              className={
                                isComplete
                                  ? "font-semibold text-emerald-700"
                                  : "text-muted-foreground"
                              }
                            >
                              {empacados.toLocaleString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {detalles.length > 0 && !detallesLoading && !detallesError && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                <span>
                  <strong className="text-foreground">
                    {detalles.length}
                  </strong>{" "}
                  lineas
                </span>
                <span>
                  Total empacado:{" "}
                  <strong className="text-emerald-700">
                    {totalEmpacados.toLocaleString()}
                  </strong>{" "}
                  / {totalPcs.toLocaleString()} piezas
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidencia de Entrega: se muestra siempre que el pedido este entregado.
          Incluye firma digital (obligatoria) y guia de envio (opcional).
          La guia puede ser una imagen (miniatura clickable que abre en
          pestana nueva) o un PDF (boton de descarga/apertura). */}
      {isDelivered && (
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="size-4 text-icon-magenta" />
              Evidencia de Entrega
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {orden.firma_url
                ? "Firma capturada al momento de la entrega al cliente. Haz clic sobre la imagen para ampliarla."
                : "Este pedido fue marcado como entregado pero no se capturo firma digital."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-start gap-6">
              {/* Firma */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <PenLine className="size-3.5 text-icon-magenta" />
                  Firma del Cliente
                </p>
                {orden.firma_url ? (
                  <button
                    type="button"
                    onClick={() => setShowSignatureLightbox(true)}
                    className="group relative inline-block rounded-md border-2 border-slate-200 bg-white p-2 shadow-sm transition hover:border-icon-magenta hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-icon-magenta"
                    aria-label="Ampliar firma del cliente"
                  >
                    <img
                      src={orden.firma_url || "/placeholder.svg"}
                      alt={`Firma del cliente para el pedido ${orden.pedido}`}
                      className="block h-32 w-auto max-w-sm object-contain"
                      onError={(e) => {
                        // Fallback si el bucket publico esta inaccesible o la ruta se rompio
                        ;(e.currentTarget as HTMLImageElement).src =
                          "/placeholder.svg"
                      }}
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-900 shadow">
                        <Maximize2 className="size-3.5" />
                        Ampliar
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-md border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-muted-foreground">
                    <PenLine className="size-5 text-slate-400" />
                    <span>Sin firma registrada.</span>
                  </div>
                )}
              </div>

              {/* Guia de envio (opcional) */}
              {orden.guia_envio_url && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="size-3.5 text-icon-magenta" />
                    Guia de Envio
                  </p>
                  {isPdfUrl(orden.guia_envio_url) ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-white"
                    >
                      <a
                        href={orden.guia_envio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Descargar o ver guia de envio en PDF"
                      >
                        <FileText className="size-4 text-rose-600" />
                        Descargar/Ver Guia (PDF)
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </a>
                    </Button>
                  ) : (
                    <a
                      href={orden.guia_envio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative inline-block rounded-md border-2 border-slate-200 bg-white p-2 shadow-sm transition hover:border-icon-magenta hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-icon-magenta"
                      aria-label="Abrir guia de envio en nueva pestana"
                    >
                      <img
                        src={orden.guia_envio_url || "/placeholder.svg"}
                        alt={`Guia de envio del pedido ${orden.pedido}`}
                        className="block h-32 w-auto max-w-sm object-contain"
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).src =
                            "/placeholder.svg"
                        }}
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100">
                        <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-900 shadow">
                          <ImageIcon className="size-3.5" />
                          Abrir
                        </span>
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Firmas de Transferencia: muestra la cadena completa de firmas de
          procesos productivos (Sublimacion -> Costura -> Vendedora) para
          que el coordinador tenga trazabilidad fisica antes de la entrega
          final al cliente. La card se oculta si no hay firmas. */}
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

      {/* Instrucciones y comentarios. En Entregas se ve TODO el historial
          (Planner + Diseno + Corte + Impresion + Sublimacion + Costura +
          Empaque) para que el responsable de la entrega final tenga el
          contexto completo de la orden. */}
      <InstructionsAndComments orden={orden} area="entregas" />

      {/* Deliver Modal */}
      <EntregasDeliverModal
        orden={orden}
        open={showDeliverModal}
        onClose={() => setShowDeliverModal(false)}
        onDeliver={handleDeliver}
      />

      <ReversarEntregaModal
        open={showReversarModal}
        onClose={() => setShowReversarModal(false)}
        onConfirm={handleReversar}
        modulo="Entregas"
      />

      {/* Lightbox para firma ampliada */}
      <Dialog
        open={showSignatureLightbox}
        onOpenChange={setShowSignatureLightbox}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PenLine className="size-4 text-icon-magenta" />
              Firma del Cliente - Pedido {orden.pedido}
            </DialogTitle>
          </DialogHeader>
          {orden.firma_url && (
            <div className="flex items-center justify-center rounded-md border bg-white p-6">
              <img
                src={orden.firma_url || "/placeholder.svg"}
                alt={`Firma ampliada del cliente para el pedido ${orden.pedido}`}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
