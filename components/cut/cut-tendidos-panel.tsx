"use client"

/**
 * Corte de un marker, tendido por tendido.
 *
 * Un marker se corta por partes: se procesan unos tendidos y otros
 * quedan para después. Por eso cada uno se cierra por separado con sus
 * yardas reales, y el marker solo queda cortado cuando no falta ninguno.
 *
 * El descuento de inventario también va por tendido: un marker puede
 * mezclar telas —en la hoja MK-027 el tendido 6 es MAXXI y el resto
 * ANTIFLUIDO— y descontarlo todo contra una sola referencia movería
 * stock de la tela equivocada.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Check,
  Layers,
  Loader2,
  RotateCcw,
  Ruler,
  Scissors,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { registrarSalidaCorte } from "@/lib/inventario/salida-corte"
import {
  cargarTendidos,
  marcarTendidoCortado,
  resumirTendidos,
  revertirTendido,
  type Tendido,
} from "@/lib/marker/tendidos"
import { CutTelaInventario } from "./cut-tela-inventario"

interface Props {
  coreId: number
  coreNombre: string
  /** Se llama cuando cambia el avance, para refrescar la lista de Corte. */
  onCambio?: () => void
}

export function CutTendidosPanel({ coreId, coreNombre, onCambio }: Props) {
  const { usuarioActual } = useAuth()
  const [tendidos, setTendidos] = useState<Tendido[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<number | null>(null)

  const cargar = async () => {
    setCargando(true)
    setTendidos(await cargarTendidos(coreId))
    setCargando(false)
  }
  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreId])

  const r = useMemo(() => resumirTendidos(tendidos), [tendidos])

  if (cargando)
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando tendidos…
      </p>
    )

  if (tendidos.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-muted-foreground">
        Este marker no tiene tendidos capturados. Se cierra completo desde el
        botón de terminar corte.
      </p>
    )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-icon-cyan" />
        <span className="text-sm font-medium text-slate-800">
          Tendidos de {coreNombre}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[11px] tabular-nums",
            r.pendientes === 0
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          )}
        >
          {r.cortados} de {r.total} cortados
        </Badge>
        {r.yardasReales > 0 && (
          <Badge variant="outline" className="text-[11px] tabular-nums">
            {r.yardasReales} yd reales
          </Badge>
        )}
        {r.telas.length > 1 && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-[11px] text-amber-800"
            title="Este marker mezcla telas: cada tendido se descuenta contra la suya."
          >
            {r.telas.length} telas
          </Badge>
        )}
      </div>

      {tendidos.map((t) => (
        <FilaTendido
          key={t.id}
          tendido={t}
          abierto={abierto === t.id}
          onAbrir={() => setAbierto(abierto === t.id ? null : t.id)}
          onHecho={async () => {
            setAbierto(null)
            await cargar()
            onCambio?.()
          }}
          usuario={usuarioActual?.nombre ?? null}
        />
      ))}
    </div>
  )
}

function FilaTendido({
  tendido: t,
  abierto,
  onAbrir,
  onHecho,
  usuario,
}: {
  tendido: Tendido
  abierto: boolean
  onAbrir: () => void
  onHecho: () => Promise<void>
  usuario: string | null
}) {
  // El teórico se propone como punto de partida, pero el cortador lo
  // corrige: es su medición la que vale.
  const [yardas, setYardas] = useState(String(t.tendido_total ?? ""))
  const [piezas, setPiezas] = useState(String(t.total_pcs ?? ""))
  const [tela, setTela] = useState<number | null>(t.tela_inventario_id)
  const [guardando, setGuardando] = useState(false)

  const cerrar = async () => {
    const yd = Number(yardas)
    if (!Number.isFinite(yd) || yd <= 0) {
      toast.error("Yardas reales obligatorias")
      return
    }
    setGuardando(true)

    const res = await marcarTendidoCortado({
      tendidoId: t.id,
      yardasReales: yd,
      piezasCortadas: piezas === "" ? null : Number(piezas),
      cortadoPor: usuario,
    })
    if (!res.success) {
      setGuardando(false)
      toast.error("No se pudo cerrar el tendido", { description: res.error })
      return
    }

    // El descuento va contra la tela DE ESTE tendido, no la del marker.
    if (tela) {
      const inv = await registrarSalidaCorte({
        telaId: tela,
        yardas: yd,
        coreId: t.core_id,
        usuario,
        nota: `tendido ${t.numero}${t.nombre_mm ? ` · ${t.nombre_mm}` : ""}`,
      })
      if (inv.success) {
        toast.success(`Tendido ${t.numero} cortado · ${yd} yd descontadas`, {
          description: inv.quedoNegativo
            ? `Atención: el stock quedó en ${inv.stockFinalYardas} yd.`
            : undefined,
        })
      } else {
        toast.error("El tendido se cerró pero no se descontó el inventario", {
          description: inv.error,
        })
      }
    } else {
      toast.success(`Tendido ${t.numero} cortado`, {
        description: "Sin tela elegida no se descontó inventario.",
      })
    }

    setGuardando(false)
    await onHecho()
  }

  const revertir = async () => {
    setGuardando(true)
    const res = await revertirTendido(t.id)
    setGuardando(false)
    if (res.success) {
      toast.success(`Tendido ${t.numero} reabierto`, {
        description:
          "El movimiento de inventario NO se revierte: si sobró tela, regístrala como ingreso.",
      })
      await onHecho()
    } else {
      toast.error("No se pudo reabrir", { description: res.error })
    }
  }

  return (
    <Card
      className={cn(
        "overflow-hidden",
        t.cortado ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
        <Badge
          className={cn(
            "text-[10px]",
            t.cortado ? "bg-emerald-600 text-white" : "bg-slate-500 text-white"
          )}
        >
          Tendido {t.numero}
        </Badge>
        {t.nombre_mm && (
          <span className="font-mono text-[11px] text-slate-600">
            {t.nombre_mm}
          </span>
        )}
        <span className="text-slate-600">
          {[t.tela, t.color_tela, t.talla, t.genero].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto tabular-nums text-slate-500">
          {t.capas ?? "—"} capas · {t.total_pcs ?? "—"} pcs
        </span>
        <span className="tabular-nums font-medium text-slate-700">
          {t.tendido_total ?? "—"} yd
        </span>

        {t.cortado ? (
          <>
            <Badge
              variant="outline"
              className="border-emerald-300 bg-white text-[10px] tabular-nums text-emerald-800"
            >
              <Check className="mr-1 size-3" />
              {t.yardas_reales} yd reales
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={revertir}
              disabled={guardando}
              className="h-6 text-[11px] text-slate-500 hover:text-rose-600"
            >
              <RotateCcw className="mr-1 size-3" />
              Reabrir
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant={abierto ? "default" : "outline"}
            onClick={onAbrir}
            className="h-6 text-[11px]"
          >
            <Scissors className="mr-1 size-3" />
            {abierto ? "Cerrar" : "Cortar"}
          </Button>
        )}
      </div>

      {abierto && !t.cortado && (
        <div className="space-y-3 border-t border-slate-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px]">
                Yardas reales <span className="text-rose-600">*</span>
              </Label>
              <div className="relative">
                <Ruler className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={yardas}
                  onChange={(e) => setYardas(e.target.value)}
                  className="h-8 pl-7 text-sm"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Teórico: {t.tendido_total ?? "—"} yd
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Piezas cortadas</Label>
              <Input
                type="number"
                min={0}
                value={piezas}
                onChange={(e) => setPiezas(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <CutTelaInventario
            telaSugerida={t.tela}
            yardas={Number(yardas) || 0}
            valor={tela}
            onChange={setTela}
          />

          <Button
            onClick={cerrar}
            disabled={guardando}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            {guardando ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            Marcar tendido {t.numero} como cortado
          </Button>
        </div>
      )}
    </Card>
  )
}
