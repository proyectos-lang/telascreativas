"use client"

/**
 * Entrega del trazo de una orden SUELTA.
 *
 * Toda orden necesita un marker para pasar a Corte, aunque se corte sola:
 * Corte lista markers, no órdenes. Antes había que ir a crearlo a la otra
 * pestaña y volver; ahora, si la orden todavía no tiene marker, el nombre
 * se pide AQUÍ y el marker se crea y se entrega en un solo paso. Crear
 * primero desde Creación de Marker sigue siendo válido: en ese caso este
 * cuadro solo entrega.
 *
 * Registra las yardas teóricas y, al entregar, recalcula el objetivo de
 * Corte a 4 días hábiles contados DESDE ESTA ENTREGA: Corte no podía
 * empezar sin el trazo, así que su plazo arranca aquí. No se toca ninguna
 * otra fecha objetivo ni el compromiso con el cliente.
 *
 * Las órdenes agrupadas en un core no pasan por aquí: las entrega el core
 * completo desde Creación de Marker.
 */

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Boxes, CheckCircle2, Info, Loader2, Ruler } from "lucide-react"
import { toast } from "sonner"
import { Orden } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { useMarker } from "@/lib/marker-context"
import { telasPorPedido } from "@/lib/marker/cores"
import { toPcs } from "@/lib/capacidad/fechas"
import {
  objetivoCorteDesdeMarker,
  DIAS_OBJETIVO_CORTE,
} from "@/lib/fechas-objetivo"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  orden: Orden
  open: boolean
  onClose: () => void
}

const hoyISO = () => new Date().toISOString().split("T")[0]

function fmt(v: string | undefined) {
  if (!v) return "-"
  const [y, m, d] = v.split("-")
  return `${d}/${m}/${y}`
}

export function MarkerFinishModal({ orden, open, onClose }: Props) {
  const { updateOrden, crearCore, entregarCore, cores, lineas } = useMarker()
  const { usuarioActual } = useAuth()
  const [motivos, setMotivos] = useState<string[]>([])
  const [nombre, setNombre] = useState("")
  const [yardas, setYardas] = useState("")
  const [responsable, setResponsable] = useState("")
  const [motivo, setMotivo] = useState("")
  const [comentario, setComentario] = useState("")
  const [guardando, setGuardando] = useState(false)

  const entrega = hoyISO()
  const nuevoObjetivoCorte = objetivoCorteDesdeMarker(entrega)

  /** Marker que ya tenga la orden; si no hay, se crea con el nombre de aqui. */
  const coreExistente = useMemo(
    () => cores.find((c) => c.id === orden.mdcore_id) ?? null,
    [cores, orden.mdcore_id]
  )

  /** Telas de la orden: definen la tela principal del marker que se cree. */
  const tela = useMemo(
    () => telasPorPedido(lineas).get(orden.pedido) ?? null,
    [lineas, orden.pedido]
  )

  useEffect(() => {
    if (!open) return
    setNombre("")
    setYardas("")
    setResponsable(orden.mdresponsable ?? "")
    setMotivo("")
    setComentario("")
    void (async () => {
      const { data } = await supabase
        .schema("telas")
        .from("motivos_demora")
        .select("*")
      const lista = ((data ?? []) as Record<string, unknown>[])
        .map((r) => String(r.motivo ?? r.nombre ?? "").trim())
        .filter(Boolean)
      setMotivos([...new Set(lista)].sort())
    })()
  }, [open, orden.mdresponsable])

  const guardar = async () => {
    const yd = Number(yardas)
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas teóricas obligatorias", {
        description: "Se comparan luego contra el consumo real de Corte.",
      })
      return
    }
    if (!coreExistente && !nombre.trim()) {
      toast.error("Nombre del marker obligatorio", {
        description: "Corte lista markers: sin nombre la orden no aparecería.",
      })
      return
    }

    setGuardando(true)

    // Sin marker previo se crea aquí mismo, con esta única orden. Las
    // yardas del formulario son las del marker completo; al ser una sola
    // orden le quedan íntegras.
    if (!coreExistente) {
      const creado = await crearCore({
        nombre: nombre.trim(),
        telaPrincipal: tela?.principal || "SIN TELA",
        yardasTeoricas: yd,
        ordenes: [
          {
            pedido: orden.pedido,
            cliente: orden.cliente ?? null,
            fecha_de_entrega: orden.fecha_de_entrega ?? null,
            pcs: toPcs(orden.pcs),
            es_urgente: orden.es_urgente ?? null,
            telaPrincipal: tela?.principal ?? "",
            telasSecundarias: tela?.secundarias ?? [],
            desgloseTelas: tela?.desglose ?? [],
            piezas: tela && tela.pcs > 0 ? tela.pcs : toPcs(orden.pcs),
          },
        ],
        creadoPor: usuarioActual?.nombre ?? null,
      })
      if (!creado.success || !creado.id) {
        setGuardando(false)
        toast.error("No se pudo crear el marker", { description: creado.error })
        return
      }

      // La entrega la hace el core: así el marker queda Entregado y no
      // Abierto con su orden ya en Corte, que fue un fallo real antes.
      const ent = await entregarCore(creado.id, entrega)
      if (!ent.success) {
        setGuardando(false)
        toast.error("El marker se creó pero no se pudo entregar", {
          description: ent.error,
        })
        return
      }

      // Los datos que solo viven en la orden no los escribe entregarCore.
      await updateOrden(orden.pedido, {
        mdresponsable: responsable.trim() || undefined,
        mdmotivo_demora_terminado_md: motivo || undefined,
        mdcomentario_entrega_md: comentario.trim() || undefined,
      })

      setGuardando(false)
      toast.success(`Marker ${nombre.trim()} creado y entregado`, {
        description: `Corte tiene hasta el ${fmt(nuevoObjetivoCorte)}.`,
      })
      onClose()
      return
    }

    // Ya tenía marker (creado desde Creación de Marker): solo se entrega.
    const ent = await entregarCore(coreExistente.id, entrega)
    if (!ent.success) {
      setGuardando(false)
      toast.error("No se pudo entregar", { description: ent.error })
      return
    }
    await updateOrden(orden.pedido, {
      mdyardas_teoricas: yd,
      mdresponsable: responsable.trim() || undefined,
      mdmotivo_demora_terminado_md: motivo || undefined,
      mdcomentario_entrega_md: comentario.trim() || undefined,
    })
    setGuardando(false)
    toast.success("Trazo entregado", {
      description: `Corte tiene hasta el ${fmt(nuevoObjetivoCorte)}.`,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Entregar trazo
          </DialogTitle>
          <DialogDescription>
            Pedido {orden.pedido} — {orden.cliente || "sin cliente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sin marker previo se pide el nombre aquí: es lo único que
              falta para crearlo, y obligar a ir a otra pestaña por un
              campo no aportaba nada. */}
          {coreExistente ? (
            <p className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <Boxes className="size-3.5 shrink-0 text-indigo-600" />
              Se entrega dentro del marker{" "}
              <strong>{coreExistente.nombre}</strong>.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="mk-nombre" className="text-sm">
                Nombre del marker <span className="text-rose-600">*</span>
              </Label>
              <div className="relative">
                <Boxes className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mk-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="pl-8"
                  placeholder={`Ej. MK-${orden.pedido}`}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se crea un marker con esta sola orden
                {tela?.principal ? ` · ${tela.principal}` : ""}. Corte lista
                markers, no órdenes sueltas.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mk-yd" className="text-sm">
              Yardas teóricas <span className="text-rose-600">*</span>
            </Label>
            <div className="relative">
              <Ruler className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="mk-yd"
                type="number"
                min={0}
                step="0.01"
                value={yardas}
                onChange={(e) => setYardas(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                autoFocus={!!coreExistente}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mk-resp" className="text-sm">
              Responsable
            </Label>
            <Input
              id="mk-resp"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Quién hizo el trazo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Motivo de demora (opcional)</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Sin demora" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mk-cm" className="text-sm">
              Comentario de entrega (opcional)
            </Label>
            <Textarea
              id="mk-cm"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
            />
          </div>

          <p className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Al entregar, Corte recibe {DIAS_OBJETIVO_CORTE} días hábiles desde
            hoy: su fecha objetivo pasa a{" "}
            <strong>{fmt(nuevoObjetivoCorte)}</strong>. El resto de las fechas
            no cambia.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {guardando ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            Entregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
