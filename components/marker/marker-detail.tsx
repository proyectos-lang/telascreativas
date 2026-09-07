"use client"

/**
 * Detalle de una orden en Marker Digital.
 *
 * Recibir/Entregar aplican a la orden suelta. Si la orden pertenece a un
 * core, la entrega la hace el core completo desde la pestaña de agrupación:
 * aquí se muestra a qué marker pertenece y se bloquean las acciones
 * individuales, para que las fechas del grupo no se desincronicen.
 */

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
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
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Calendar,
  CheckCircle2,
  Inbox,
  Info,
  Lock,
  Package,
  PenLine,
  Ruler,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { useMarker, type MarkerCore } from "@/lib/marker-context"
import { getMarkerStatus } from "@/lib/production-status"
import { ReportarIncidenciaButton } from "@/components/incidencias/reportar-incidencia-button"
import { EnviarPorChatButton } from "@/components/shared/enviar-por-chat-button"
import { InstructionsAndComments } from "@/components/shared/instructions-and-comments"
import { MarkerReceiveModal } from "./marker-receive-modal"
import { MarkerFinishModal } from "./marker-finish-modal"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  orden: Orden
  cores: MarkerCore[]
  onBack: () => void
}

function fmt(v: string | undefined | null) {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function MarkerDetail({ orden, cores, onBack }: Props) {
  const { updateOrden } = useMarker()
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<"recibir" | "terminar" | null>(null)

  useEffect(() => {
    let cancelado = false
    void (async () => {
      setCargando(true)
      const { data } = await supabase
        .schema("telas")
        .from("detalleorden")
        .select("*")
        .eq("pedido", orden.pedido)
      if (!cancelado) {
        setDetalles((data as DetalleOrden[]) ?? [])
        setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [orden.pedido])

  const core = orden.mdcore_id
    ? cores.find((c) => c.id === orden.mdcore_id) ?? null
    : null
  const estado = getMarkerStatus(orden)
  const disenoEntregado = Boolean(orden.dentrega_diseno)
  const recibido = Boolean(orden.mdfecha_de_recepcion)
  const entregado = Boolean(orden.mdentrega_marker)
  const enCore = Boolean(core)

  const revertir = async () => {
    const r = await updateOrden(orden.pedido, {
      mdentrega_marker: undefined,
      mdmotivo_demora_terminado_md: undefined,
      mdcomentario_entrega_md: undefined,
    })
    if (r.success) toast.success("Entrega del trazo revertida")
    else toast.error("No se pudo revertir", { description: r.error })
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{orden.pedido}</h2>
              {orden.es_urgente && (
                <Badge className="bg-rose-500 text-white hover:bg-rose-600">
                  <AlertTriangle className="mr-1 size-3" />
                  Urgente
                </Badge>
              )}
              {core && (
                <Badge
                  variant="outline"
                  className="gap-1 border-indigo-300 bg-indigo-50 text-indigo-800"
                >
                  <Boxes className="size-3" />
                  {core.nombre}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {orden.cliente || "Sin cliente"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportarIncidenciaButton pedido={orden.pedido} areaActual="Marker" />
          <EnviarPorChatButton tipo="pedido" pedido={orden.pedido} />
          <Button
            size="sm"
            onClick={() => setModal("recibir")}
            disabled={recibido || entregado || enCore}
            title={
              enCore
                ? "La orden pertenece a un marker: se gestiona desde Agrupación de cores"
                : undefined
            }
          >
            <Inbox className="mr-1 size-3.5" />
            Recibir
          </Button>
          <Button
            size="sm"
            onClick={() => setModal("terminar")}
            disabled={!recibido || entregado || enCore}
            title={
              enCore
                ? "La entrega la hace el marker completo, no la orden suelta"
                : undefined
            }
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Entregar trazo
          </Button>
          {entregado && !enCore && (
            <Button
              size="sm"
              variant="outline"
              onClick={revertir}
              className="border-rose-300 text-rose-600 hover:bg-rose-50"
            >
              Reversar
            </Button>
          )}
        </div>
      </div>

      {enCore && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              Esta orden se corta dentro del marker {core?.nombre}
            </p>
            <p className="mt-0.5 text-xs text-indigo-800/80">
              La recepción y la entrega se registran para todo el marker a la
              vez, desde la pestaña Agrupación de cores.
            </p>
          </div>
        </div>
      )}

      {/* Marker Digital NO depende de Diseño: el trazo se hace con las
          medidas y la tela, que ya vienen en la orden. Se informa el estado
          de Diseño como referencia, pero no bloquea el proceso. */}
      {!disenoEntregado && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-500" />
          <p className="text-sm text-slate-700">
            Diseño aún no ha entregado los artes. El trazo se puede hacer
            igual: Marker Digital no depende de Diseño.
          </p>
        </div>
      )}

      {/* Datos del área */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Marker Digital</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Dato icon={Calendar} label="Fecha objetivo" valor={fmt(orden.mdfecha_objetivo_md)} />
            <Dato icon={Inbox} label="Recibido" valor={fmt(orden.mdfecha_de_recepcion)} />
            <Dato icon={CheckCircle2} label="Trazo entregado" valor={fmt(orden.mdentrega_marker)} />
            <Dato icon={User} label="Responsable" valor={orden.mdresponsable || "-"} />
            <Dato
              icon={Ruler}
              label="Yardas teóricas"
              valor={
                orden.mdyardas_teoricas != null
                  ? `${orden.mdyardas_teoricas} yd`
                  : "-"
              }
            />
            <Dato icon={Package} label="Piezas" valor={String(orden.pcs ?? "-")} />
            {orden.mdcomentario_marker && (
              <div className="sm:col-span-2">
                <Separator className="my-1" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Comentario
                </p>
                <p className="text-sm text-slate-700">{orden.mdcomentario_marker}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Marker</span>
              <Badge
                className={
                  estado === "Terminado"
                    ? "bg-emerald-500 text-white"
                    : estado === "Recibido"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-700"
                }
              >
                {estado === "Terminado" ? "Entregado" : estado}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Diseño</span>
              <Badge
                className={
                  disenoEntregado
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }
              >
                {disenoEntregado ? "Entregado" : "Pendiente"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entrega cliente</span>
              <span className="text-sm font-medium">{fmt(orden.fecha_de_entrega)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productos: la tela es lo que decide la agrupación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="size-4 text-icon-cyan" />
            Detalle de productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : detalles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin detalle de productos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[40rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tela</TableHead>
                    <TableHead>Género</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead className="text-right">Pcs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d) => (
                    <TableRow key={d.id2}>
                      <TableCell>{d.nombre || "-"}</TableCell>
                      <TableCell className="font-medium">{d.tela || "-"}</TableCell>
                      <TableCell>{d.genero || "-"}</TableCell>
                      <TableCell>{d.talla || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.pcs ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InstructionsAndComments orden={orden} area="marker" />

      {modal === "recibir" && (
        <MarkerReceiveModal orden={orden} open onClose={() => setModal(null)} />
      )}
      {modal === "terminar" && (
        <MarkerFinishModal orden={orden} open onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function Dato({
  icon: Icon,
  label,
  valor,
}: {
  icon: typeof Calendar
  label: string
  valor: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{valor}</p>
      </div>
    </div>
  )
}
