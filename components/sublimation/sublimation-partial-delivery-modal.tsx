"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Orden, DetalleOrden } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Hash,
  Layers,
  PackagePlus,
  Save,
  ShirtIcon,
  UserCircle,
  Wand2,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

/**
 * Estructura mínima de una entrega parcial previa para el cálculo de
 * acumulados por línea. Coincide con `EntregaParcialRow` exportado desde
 * `sublimation-detail.tsx` pero la duplicamos acá (subset) para evitar un
 * acoplamiento cíclico entre componentes.
 */
interface EntregaPrevia {
  id?: number
  cantidad: number
  detalle_id?: number | null
}

interface SublimationPartialDeliveryModalProps {
  orden: Orden
  open: boolean
  onClose: () => void
  /**
   * Lista de líneas (piezas) de la orden tomada de `telas.detalleorden`.
   * Cada línea representa una combinación pieza/talla con su cantidad
   * total. El modal renderiza una fila por cada una y permite registrar
   * cuánto se entrega de esa línea en este movimiento.
   */
  detalles: DetalleOrden[]
  /**
   * Entregas parciales ya registradas para la orden. Se usan para
   * computar el acumulado entregado por línea (sumando las que coinciden
   * con cada `detalle_id`).
   */
  entregasPrevias: EntregaPrevia[]
  /**
   * Callback invocado cuando la entrega parcial se registró exitosamente
   * (INSERT batch + UPDATE acumulado). Recibe el nuevo acumulado total
   * para que el detalle revalide el gate del botón "Terminar".
   */
  onSuccess: (nuevoAcumulado: number) => void
}

/**
 * Modal "Registrar Entrega Parcial" para el módulo de Sublimación.
 *
 * Diferencias clave con la versión anterior:
 *  - En vez de pedir UNA cantidad genérica, ahora muestra la lista de
 *    piezas de la orden (`detalleorden`) y permite registrar cuánto se
 *    entrega DE CADA línea en el movimiento actual.
 *  - Por cada línea muestra: total contratado, ya entregado (sumando los
 *    movimientos previos con `detalle_id` = línea) y pendiente.
 *  - Tiene un botón auxiliar "Llenar Totalidad" que precarga el faltante
 *    de todas las líneas (útil cuando se va a hacer una entrega completa).
 *  - El submit hace un INSERT batch (una fila por cada línea con
 *    cantidad > 0) y un único UPDATE incrementando
 *    `s_pcs_entregados_acumulado` con el total de la entrega.
 */
export function SublimationPartialDeliveryModal({
  orden,
  open,
  onClose,
  detalles,
  entregasPrevias,
  onSuccess,
}: SublimationPartialDeliveryModalProps) {
  // Map { lineaKey -> string ingresado por el usuario }. La clave es
  // `id2` (string) de DetalleOrden porque es el identificador único
  // legible; si `id2` estuviera vacío se usa `id` como fallback.
  // Usamos string para no perder el "" mientras el usuario tipea;
  // convertimos a número solo al validar/guardar.
  // IMPORTANTE: nunca usar `det.id` (número) directamente como clave de
  // Record porque en JS `Record<number,…>` coacciona las claves a string
  // y si dos líneas comparten el mismo `id` (bug en datos) comparten
  // el mismo slot. La clave compuesta nunca colisiona.
  const makeKey = (det: DetalleOrden): string =>
    det.id2 || String(det.id)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Usuario que está registrando la entrega. Se toma de la sesión para
  // auditar quién envió cada parcialidad.
  const { usuarioActual } = useAuth()
  const usuarioRegistro =
    usuarioActual?.nombre || usuarioActual?.email || "Desconocido"

  const totalPcs = orden.pcs ?? 0
  const acumuladoOrden = orden.s_pcs_entregados_acumulado ?? 0
  const pendienteOrden = Math.max(totalPcs - acumuladoOrden, 0)

  // Acumulado por línea (re-calculado cada vez que cambian las entregas
  // previas). Si `detalle_id` viene en null (movimientos legacy creados
  // antes del feature por línea) se ignoran para el conteo por línea —
  // el `acumuladoOrden` global sigue reflejando esos movimientos.
  const acumuladoPorLinea = useMemo(() => {
    const map: Record<number, number> = {}
    for (const ep of entregasPrevias) {
      if (ep.detalle_id == null) continue
      map[ep.detalle_id] =
        (map[ep.detalle_id] || 0) + (Number(ep.cantidad) || 0)
    }
    return map
  }, [entregasPrevias])

  // Reset inputs cada vez que se abre el modal para no arrastrar valores.
  useEffect(() => {
    if (open) setInputs({})
  }, [open])

  /**
   * Convierte el texto del input a número aceptando coma o punto como
   * separador decimal (planta usa ambos). Devuelve NaN si está vacío o
   * mal formado.
   */
  const parseInput = (value: string | undefined): number => {
    if (!value) return NaN
    return parseFloat(value.replace(",", "."))
  }

  /**
   * Calcula el pendiente real por línea: pcs totales menos lo entregado
   * en parcialidades anteriores. Nunca devuelve negativo.
   */
  const getPendienteLinea = (det: DetalleOrden): number => {
    const total = Number(det.pcs) || 0
    const entregado = acumuladoPorLinea[det.id] || 0
    return Math.max(total - entregado, 0)
  }

  // Suma de lo que se está por entregar en este movimiento (para mostrar
  // el total al usuario y validar contra el pendiente global).
  const totalEntregaActual = useMemo(() => {
    return detalles.reduce((sum, det) => {
      const v = parseInput(inputs[makeKey(det)])
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
  }, [inputs, detalles])

  // Líneas que tienen una cantidad > 0 ingresada (las que se persistirán).
  const lineasAEntregar = useMemo(() => {
    return detalles
      .map((det) => {
        const cantidad = parseInput(inputs[makeKey(det)])
        return { det, cantidad }
      })
      .filter(
        (row) => !isNaN(row.cantidad) && row.cantidad > 0
      )
  }, [inputs, detalles])

  /**
   * Validación global: revisa que cada cantidad ingresada sea válida
   * (>0 y <= pendiente de su línea). Devuelve un array de mensajes de
   * error legibles para mostrar al usuario.
   */
  const validationErrors = useMemo(() => {
    const errs: string[] = []
    for (const det of detalles) {
      const raw = inputs[makeKey(det)]
      if (!raw) continue // vacío = no entrega esa línea, OK
      const v = parseInput(raw)
      if (isNaN(v) || v < 0) {
        errs.push(
          `Línea "${det.nombre} - ${det.talla}": cantidad inválida.`
        )
        continue
      }
      const pendienteLinea = getPendienteLinea(det)
      if (v > pendienteLinea) {
        errs.push(
          `Línea "${det.nombre} - ${det.talla}": no puedes exceder ${formatPcs(
            pendienteLinea
          )} pcs.`
        )
      }
    }
    return errs
  }, [inputs, detalles, acumuladoPorLinea])

  // Formato amigable de piezas: hasta 2 decimales sin forzar ".00".
  function formatPcs(n: number) {
    return n.toLocaleString("es-CO", { maximumFractionDigits: 2 })
  }

  /**
   * Auto-fill: rellena cada input con el pendiente de su línea para
   * registrar la totalidad de lo faltante en un solo movimiento. El
   * usuario aún debe presionar "Registrar Entrega" para confirmar.
   */
  const handleFillTotal = () => {
    const next: Record<string, string> = {}
    for (const det of detalles) {
      const pend = getPendienteLinea(det)
      if (pend > 0) {
        next[makeKey(det)] = String(pend)
      }
    }
    setInputs(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase) {
      toast.error("Supabase no configurado", {
        description:
          "Faltan credenciales para registrar la entrega parcial.",
      })
      return
    }

    if (validationErrors.length > 0) {
      toast.error("Corrige las cantidades ingresadas", {
        description: validationErrors[0],
      })
      return
    }

    if (lineasAEntregar.length === 0) {
      toast.error("Sin cantidades a registrar", {
        description:
          "Ingresa la cantidad a entregar de al menos una línea o usa 'Llenar Totalidad'.",
      })
      return
    }

    if (totalEntregaActual > pendienteOrden) {
      toast.error("Excede el pendiente de la orden", {
        description: `El total ingresado (${formatPcs(
          totalEntregaActual
        )}) supera el pendiente global (${formatPcs(pendienteOrden)}).`,
      })
      return
    }

    setIsSubmitting(true)

    // 1. INSERT batch en entregas_parciales_sublimacion. Una fila por
    //    cada línea con cantidad > 0. `producto_detalle` lo armamos a
    //    partir del nombre + talla para que el historial siga siendo
    //    legible aunque la línea cambie de nombre en el futuro.
    const rows = lineasAEntregar.map(({ det, cantidad }) => ({
      pedido: orden.pedido,
      cantidad,
      detalle_id: det.id,
      producto_detalle: `${det.nombre}${det.talla ? ` - ${det.talla}` : ""}`,
      usuario: usuarioRegistro,
    }))

    const { error: insertError } = await supabase
      .schema("telas")
      .from("entregas_parciales_sublimacion")
      .insert(rows)

    if (insertError) {
      console.log(
        "[v0] Sublimation Partial - Insert error:",
        insertError
      )
      toast.error("Error al registrar entrega parcial", {
        description: insertError.message,
      })
      setIsSubmitting(false)
      return
    }

    // 2. UPDATE en cabecera: incrementar acumulado, marcar estado parcial
    //    y registrar la fecha de primera entrega parcial si aun no existe.
    const nuevoAcumulado = acumuladoOrden + totalEntregaActual
    const todayISO = new Date().toISOString().split("T")[0]
    const updatePayload: Record<string, unknown> = {
      s_pcs_entregados_acumulado: nuevoAcumulado,
      s_estado_entrega: "Parcial",
    }
    // Solo escribir la fecha de primera entrega si aun no estaba registrada.
    if (!orden.s_fecha_entrega_parcial) {
      updatePayload.s_fecha_entrega_parcial = todayISO
    }

    const { error: updateError } = await supabase
      .schema("telas")
      .from("cabecera")
      .update(updatePayload)
      .eq("pedido", orden.pedido)

    if (updateError) {
      console.log(
        "[v0] Sublimation Partial - Update error:",
        updateError
      )
      toast.error("Error al actualizar acumulado", {
        description: updateError.message,
      })
      setIsSubmitting(false)
      return
    }

    toast.success("Entrega parcial registrada", {
      description: `Se registraron ${formatPcs(
        totalEntregaActual
      )} pcs en ${rows.length} ${
        rows.length === 1 ? "línea" : "líneas"
      }. Acumulado: ${formatPcs(nuevoAcumulado)} / ${formatPcs(totalPcs)}.`,
    })

    setIsSubmitting(false)
    onSuccess(nuevoAcumulado)
    onClose()
  }

  const noHayPendiente = pendienteOrden === 0
  const submitDisabled =
    isSubmitting ||
    noHayPendiente ||
    lineasAEntregar.length === 0 ||
    validationErrors.length > 0 ||
    totalEntregaActual > pendienteOrden

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {/* sm:max-w-[95vw] anula el `sm:max-w-lg` por defecto del
          DialogContent de shadcn (que era lo que dejaba el modal angosto
          en pantallas grandes). Combinado con w-[95vw] el modal usa el
          95% del ancho del viewport en cualquier breakpoint, dejando
          espacio cómodo para nombre, chips y el input de cantidad en una
          sola fila. */}
      <DialogContent className="w-[95vw] sm:max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <div className="px-6 pt-6 pb-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <PackagePlus className="size-5 text-icon-coral" />
              Registrar Entrega Parcial
            </DialogTitle>
            <DialogDescription className="text-sm">
              Orden <strong>{orden.pedido}</strong> — {orden.cliente}. Indica
              cuánto se entrega de cada pieza en este movimiento. Puedes hacer
              varias entregas hasta completar el total.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-hidden flex flex-col gap-4 px-6"
        >
          {/* Resumen actual: Total / Entregado / Pendiente */}
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 shrink-0">
            <div className="space-y-0.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase text-muted-foreground">
                <Hash className="size-3" />
                Total Orden
              </div>
              <p className="text-lg font-bold">{formatPcs(totalPcs)}</p>
            </div>
            <div className="space-y-0.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-medium uppercase text-muted-foreground">
                <Layers className="size-3" />
                Ya Entregado
              </div>
              <p className="text-lg font-bold text-emerald-700">
                {formatPcs(acumuladoOrden)}
              </p>
            </div>
            <div className="space-y-0.5 text-center">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">
                Pendiente
              </div>
              <p className="text-lg font-bold text-amber-700">
                {formatPcs(pendienteOrden)}
              </p>
            </div>
          </div>

          {noHayPendiente ? (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 shrink-0">
              <AlertTriangle className="size-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900">
                Esta orden ya tiene el total de piezas entregadas. Procede a{" "}
                <strong>Terminar</strong> para cerrar y firmar.
              </AlertDescription>
            </Alert>
          ) : detalles.length === 0 ? (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 shrink-0">
              <AlertTriangle className="size-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                Esta orden no tiene líneas en{" "}
                <code className="text-xs">detalleorden</code>. No se puede
                registrar entrega parcial por línea.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Toolbar: helper para llenar la totalidad pendiente */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
                <Label className="text-sm flex items-center gap-1.5">
                  <ShirtIcon className="size-3.5 text-icon-magenta" />
                  Cantidad a entregar por línea
                  <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFillTotal}
                  disabled={isSubmitting}
                  className="text-xs gap-1.5"
                >
                  <Wand2 className="size-3.5" />
                  Llenar Totalidad Pendiente
                </Button>
              </div>

              {/* Lista vertical de líneas. Cada línea es una "card" con
                  los datos arriba (Pieza, Talla, Total, Entregado,
                  Pendiente) y el INPUT grande debajo. Esta estructura
                  garantiza que el campo de cantidad sea siempre visible
                  sin importar el ancho del modal — antes con tabla de 6
                  columnas la columna del input se salía del viewport en
                  pantallas medianas. */}
              <ScrollArea className="flex-1 rounded-md border bg-background">
                <div className="divide-y">
                  {detalles.map((det) => {
                    const total = Number(det.pcs) || 0
                    const entregado = acumuladoPorLinea[det.id] || 0
                    const pendiente = Math.max(total - entregado, 0)
                    const lineaCompleta = pendiente === 0 && total > 0
                    const key = makeKey(det)
                    const raw = inputs[key] || ""
                    const parsed = parseInput(raw)
                    const inputInvalido =
                      raw !== "" &&
                      (isNaN(parsed) || parsed < 0 || parsed > pendiente)

                    return (
                      // Fila ÚNICA por línea: nombre+talla a la izquierda,
                      // chips de totales en el centro y el input de
                      // cantidad alineado a la derecha. flex-wrap permite
                      // que en pantallas muy angostas (móvil) los chips
                      // bajen sin romper el input, pero en escritorio
                      // todo queda en la misma fila gracias al modal de
                      // 1300px.
                      <div
                        key={det.id}
                        className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                          lineaCompleta ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        {/* Identificación de la pieza */}
                        <div className="flex items-center gap-2 min-w-[200px] flex-1">
                          <span className="font-semibold text-sm truncate">
                            {det.nombre}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {det.talla || "-"}
                          </Badge>
                        </div>

                        {/* Chips de cantidades — anchos fijos para que
                            las columnas queden visualmente alineadas
                            entre filas a lo largo del listado. */}
                        <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
                          <span className="text-muted-foreground w-[90px] text-right">
                            Total:{" "}
                            <span className="font-semibold text-foreground">
                              {formatPcs(total)}
                            </span>
                          </span>
                          <span className="text-muted-foreground w-[110px] text-right">
                            Entregado:{" "}
                            <span className="font-semibold text-emerald-700">
                              {formatPcs(entregado)}
                            </span>
                          </span>
                          <span className="text-muted-foreground w-[110px] text-right">
                            Pendiente:{" "}
                            {lineaCompleta ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] h-4 px-1.5 border-transparent">
                                Completo
                              </Badge>
                            ) : (
                              <span className="font-semibold text-amber-700">
                                {formatPcs(pendiente)}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Input de cantidad en la misma línea, a la
                            derecha. Label compacto + input + mensaje de
                            error inline cuando aplica. */}
                        <div className="flex items-center gap-2 ml-auto shrink-0">
                          <Label
                            htmlFor={`cantidad-linea-${det.id}`}
                            className="text-xs font-medium text-muted-foreground whitespace-nowrap"
                          >
                            Entregar:
                          </Label>
                          <Input
                            id={`cantidad-linea-${det.id}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={pendiente}
                            step="any"
                            placeholder={
                              lineaCompleta
                                ? "Línea completa"
                                : `Máx ${formatPcs(pendiente)}`
                            }
                            value={raw}
                            disabled={lineaCompleta || isSubmitting}
                            onChange={(e) =>
                              setInputs((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className={`tabular-nums h-9 w-[160px] ${
                              inputInvalido
                                ? "border-destructive focus-visible:ring-destructive"
                                : ""
                            }`}
                          />
                          {inputInvalido && (
                            <span className="text-xs text-destructive whitespace-nowrap">
                              Excede pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Resumen de la entrega actual + usuario */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border bg-muted/20 px-3 py-2 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <UserCircle className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Registra:</span>
                  <span className="font-semibold truncate">
                    {usuarioRegistro}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Total a registrar:
                  </span>{" "}
                  <span
                    className={`font-bold ${
                      totalEntregaActual > pendienteOrden
                        ? "text-destructive"
                        : "text-icon-coral"
                    }`}
                  >
                    {formatPcs(totalEntregaActual)} pcs
                  </span>
                </div>
              </div>

              {/* Mensajes de error de validación */}
              {validationErrors.length > 0 && (
                <Alert
                  variant="destructive"
                  className="shrink-0"
                >
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-0.5 text-xs">
                      {validationErrors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {validationErrors.length > 3 && (
                        <li>
                          y {validationErrors.length - 3} error(es) más...
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0 shrink-0 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitDisabled}
              className="bg-icon-coral hover:bg-icon-coral/90 text-white disabled:bg-icon-coral/50"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Registrar Entrega
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
