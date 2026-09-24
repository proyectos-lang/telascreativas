"use client"

/**
 * Captura de los tendidos de un marker.
 *
 * Replica la hoja de corte en papel: cada tendido es un trazo con su
 * tela, talla, género, color, longitud, capas y piezas. El orden de los
 * campos sigue el de la hoja para que quien la tenga delante pueda
 * teclear de corrido sin buscar.
 *
 * El "tendido total" se calcula solo (yardas de una capa × capas) pero
 * se puede corregir: la hoja redondea y su cifra impresa es la que se
 * usa en planta.
 */

import { useMemo } from "react"
import { Copy, Layers, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  calcularTendidoTotal,
  type TendidoNuevo,
} from "@/lib/marker/tendidos"

interface Props {
  tendidos: TendidoNuevo[]
  onChange: (t: TendidoNuevo[]) => void
  /** Tela del core, para proponerla en los tendidos nuevos. */
  telaSugerida?: string | null
  disabled?: boolean
}

const vacio = (numero: number, tela?: string | null): TendidoNuevo => ({
  numero,
  nombre_mm: "",
  tela: tela ?? "",
  color_tela: "",
  talla: "",
  genero: "",
  largo_trazo_in: null,
  yardas: null,
  capas: null,
  total_pcs: null,
  pcs_extra: 0,
  tendido_total: null,
})

export function MarkerTendidosEditor({
  tendidos,
  onChange,
  telaSugerida,
  disabled,
}: Props) {
  const resumen = useMemo(() => {
    const yardas = tendidos.reduce(
      (s, t) =>
        s + (t.tendido_total ?? calcularTendidoTotal(t.yardas, t.capas) ?? 0),
      0
    )
    const pcs = tendidos.reduce((s, t) => s + (Number(t.total_pcs) || 0), 0)
    const extra = tendidos.reduce((s, t) => s + (Number(t.pcs_extra) || 0), 0)
    const telas = [
      ...new Set(tendidos.map((t) => t.tela?.trim()).filter(Boolean)),
    ] as string[]
    return {
      yardas: Math.round(yardas * 100) / 100,
      pcs,
      extra,
      telas,
    }
  }, [tendidos])

  const set = (i: number, campo: keyof TendidoNuevo, valor: unknown) => {
    const copia = [...tendidos]
    copia[i] = { ...copia[i], [campo]: valor }
    // El total se recalcula al tocar yardas o capas, salvo que el usuario
    // lo haya escrito a mano: ahí manda lo que él puso.
    if (campo === "yardas" || campo === "capas") {
      copia[i].tendido_total = calcularTendidoTotal(
        campo === "yardas" ? (valor as number) : copia[i].yardas,
        campo === "capas" ? (valor as number) : copia[i].capas
      )
    }
    onChange(copia)
  }

  const agregar = () =>
    onChange([
      ...tendidos,
      vacio(
        tendidos.reduce((m, t) => Math.max(m, t.numero), 0) + 1,
        telaSugerida
      ),
    ])

  /** Duplicar ahorra retecleo: los tendidos de un marker se parecen. */
  const duplicar = (i: number) => {
    const base = tendidos[i]
    onChange([
      ...tendidos,
      {
        ...base,
        numero: tendidos.reduce((m, t) => Math.max(m, t.numero), 0) + 1,
        nombre_mm: "",
        talla: "",
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-icon-cyan" />
        <Label className="text-sm font-medium">Tendidos del marker</Label>
        {tendidos.length > 0 && (
          <>
            <Badge variant="outline" className="text-[11px] tabular-nums">
              {tendidos.length} tendido{tendidos.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[11px] tabular-nums">
              {resumen.yardas} yd
            </Badge>
            <Badge variant="outline" className="text-[11px] tabular-nums">
              {resumen.pcs} pcs
              {resumen.extra > 0 ? ` (+${resumen.extra})` : ""}
            </Badge>
            {resumen.telas.length > 1 && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-[11px] text-amber-800"
                title="Este marker mezcla telas: el consumo se descuenta por tendido, contra la tela de cada uno."
              >
                {resumen.telas.length} telas
              </Badge>
            )}
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={agregar}
          disabled={disabled}
          className="ml-auto h-7 text-xs"
        >
          <Plus className="mr-1 size-3.5" />
          Agregar tendido
        </Button>
      </div>

      {tendidos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-muted-foreground">
          Sin tendidos, el marker se corta como una sola pieza. Agrega uno por
          cada trazo de la hoja de corte para poder cortarlos por separado.
        </p>
      ) : (
        <div className="space-y-2">
          {tendidos.map((t, i) => {
            const total =
              t.tendido_total ?? calcularTendidoTotal(t.yardas, t.capas)
            return (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/40 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-600 text-[10px] text-white">
                    Tendido {t.numero}
                  </Badge>
                  <Input
                    value={t.nombre_mm ?? ""}
                    onChange={(e) => set(i, "nombre_mm", e.target.value)}
                    placeholder="Nombre MM (ej. MARKER12-T1)"
                    disabled={disabled}
                    className="h-7 flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => duplicar(i)}
                    disabled={disabled}
                    title="Duplicar este tendido"
                    className="size-7 text-slate-400 hover:text-slate-700"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      onChange(tendidos.filter((_, j) => j !== i))
                    }
                    disabled={disabled}
                    className="size-7 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Mismo orden que la hoja de corte, para teclear de corrido */}
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <Campo label="Tela">
                    <Input
                      value={t.tela ?? ""}
                      onChange={(e) => set(i, "tela", e.target.value)}
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Talla">
                    <Input
                      value={t.talla ?? ""}
                      onChange={(e) => set(i, "talla", e.target.value)}
                      placeholder="XS-S"
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Género">
                    <Input
                      value={t.genero ?? ""}
                      onChange={(e) => set(i, "genero", e.target.value)}
                      placeholder="UNISEX"
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Color">
                    <Input
                      value={t.color_tela ?? ""}
                      onChange={(e) => set(i, "color_tela", e.target.value)}
                      placeholder="BLANCA"
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>

                  <Campo label="L. trazo (in)">
                    <Input
                      type="number"
                      step="0.01"
                      value={t.largo_trazo_in ?? ""}
                      onChange={(e) =>
                        set(i, "largo_trazo_in", e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Yardas (1 capa)">
                    <Input
                      type="number"
                      step="0.01"
                      value={t.yardas ?? ""}
                      onChange={(e) =>
                        set(i, "yardas", e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="N. de capas">
                    <Input
                      type="number"
                      min={0}
                      value={t.capas ?? ""}
                      onChange={(e) =>
                        set(i, "capas", e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Total pcs">
                    <Input
                      type="number"
                      min={0}
                      value={t.total_pcs ?? ""}
                      onChange={(e) =>
                        set(i, "total_pcs", e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>

                  <Campo label="Pcs extra">
                    <Input
                      type="number"
                      min={0}
                      value={t.pcs_extra ?? 0}
                      onChange={(e) =>
                        set(i, "pcs_extra", Number(e.target.value) || 0)
                      }
                      disabled={disabled}
                      className="h-7 text-xs"
                    />
                  </Campo>
                  <Campo label="Tendido total (yd)">
                    <Input
                      type="number"
                      step="0.01"
                      value={t.tendido_total ?? total ?? ""}
                      onChange={(e) =>
                        set(i, "tendido_total", e.target.value === "" ? null : Number(e.target.value))
                      }
                      disabled={disabled}
                      className={cn(
                        "h-7 text-xs font-medium",
                        total !== null && "bg-yellow-50"
                      )}
                      title="Se calcula solo (yardas × capas); se puede corregir para que cuadre con la hoja."
                    />
                  </Campo>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-slate-500">{label}</Label>
      {children}
    </div>
  )
}
