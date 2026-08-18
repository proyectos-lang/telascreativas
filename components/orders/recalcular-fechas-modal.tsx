"use client"

/**
 * Recálculo masivo de fechas objetivo (solo administradores).
 *
 * Aplica las reglas vigentes de `lib/fechas-objetivo.ts` a todas las órdenes
 * activas (aprobadas y aún sin empacar). Se usa cuando cambian las reglas de
 * negocio — p. ej. al pasar Corte/Impresión/Sublimación a jornada Lun–Vie o al
 * corregir el orden del flujo YARDAJE — para que las órdenes ya aprobadas
 * queden consistentes con las nuevas.
 *
 * NUNCA escribe sin confirmación: primero calcula y muestra el diff completo
 * (pedido · área · fecha actual → fecha nueva) y solo aplica al confirmar.
 */

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import {
  CalendarClock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchAll } from "@/lib/fetch-all"
import { getTodayISO } from "@/lib/date-utils"
import { calcularFechasObjetivo, type FechasObjetivo } from "@/lib/fechas-objetivo"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Campos objetivo y su etiqueta, en orden de flujo. */
const CAMPOS: { campo: keyof FechasObjetivo; label: string }[] = [
  { campo: "dfecha_objetivo_d", label: "Diseño" },
  { campo: "ifecha_objetivo_i", label: "Impresión" },
  { campo: "sfecha_objetivo_s", label: "Sublimación" },
  { campo: "cfecha_objetivo_c", label: "Corte" },
  { campo: "cosfecha_objetivo_cs", label: "Costura" },
  { campo: "efecha_objetivo_e", label: "Empaque" },
]

interface OrdenRecalc {
  pedido: string
  cliente: string | null
  fecha_programacion: string | null
  fecha_de_entrega: string | null
  es_urgente: boolean | null
  tipo_flujo_especial: string | null
  solo_corte_costura: boolean | null
  omite_corte_costura: boolean | null
  costura_si_no: boolean | string | null
  dfecha_objetivo_d: string | null
  cfecha_objetivo_c: string | null
  ifecha_objetivo_i: string | null
  sfecha_objetivo_s: string | null
  cosfecha_objetivo_cs: string | null
  efecha_objetivo_e: string | null
}

interface CambioArea {
  label: string
  campo: keyof FechasObjetivo
  antes: string | null
  despues: string | undefined
}

interface CambioOrden {
  pedido: string
  cliente: string | null
  flujo: string
  cambios: CambioArea[]
  updates: Partial<Record<keyof FechasObjetivo, string | null>>
}

const ymd = (v: string | null | undefined): string | null =>
  v ? String(v).slice(0, 10) : null

export function RecalcularFechasModal({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone?: () => void
}) {
  const [calculando, setCalculando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [analizadas, setAnalizadas] = useState<number | null>(null)
  const [cambios, setCambios] = useState<CambioOrden[] | null>(null)

  const analizar = async () => {
    setCalculando(true)
    setCambios(null)
    try {
      const { data, error } = await fetchAll<OrdenRecalc>((from, to) =>
        supabase
          .schema("telas")
          .from("cabecera")
          .select(
            "pedido, cliente, fecha_programacion, fecha_de_entrega, es_urgente, tipo_flujo_especial, solo_corte_costura, omite_corte_costura, costura_si_no, dfecha_objetivo_d, cfecha_objetivo_c, ifecha_objetivo_i, sfecha_objetivo_s, cosfecha_objetivo_cs, efecha_objetivo_e"
          )
          .eq("estado_aprobado_rechazado", "Aprobado")
          .is("efecha_de_empaque", null)
          .range(from, to) as never
      )
      if (error) {
        toast.error("No se pudieron cargar las órdenes", { description: error.message })
        return
      }
      const rows = data ?? []
      const out: CambioOrden[] = []
      for (const o of rows) {
        const fechaBase = ymd(o.fecha_programacion) || getTodayISO()
        const nuevas = calcularFechasObjetivo({
          fechaBase,
          esUrgente: o.es_urgente,
          fechaEntrega: o.fecha_de_entrega,
          soloCorteCostura: o.solo_corte_costura,
          omiteCorteCostura: o.omite_corte_costura,
          tipoFlujo: o.tipo_flujo_especial,
          costuraSiNo: o.costura_si_no,
        })
        const cambiosArea: CambioArea[] = []
        const updates: Partial<Record<keyof FechasObjetivo, string | null>> = {}
        for (const { campo, label } of CAMPOS) {
          const antes = ymd(o[campo as keyof OrdenRecalc] as string | null)
          const despues = nuevas[campo]
          if ((antes ?? null) !== (despues ?? null)) {
            cambiosArea.push({ label, campo, antes, despues })
            // `null` limpia la fecha de un área que la orden no atraviesa.
            updates[campo] = despues ?? null
          }
        }
        if (cambiosArea.length > 0) {
          out.push({
            pedido: o.pedido,
            cliente: o.cliente,
            flujo: (o.tipo_flujo_especial ?? "NORMAL").toString(),
            cambios: cambiosArea,
            updates,
          })
        }
      }
      setAnalizadas(rows.length)
      setCambios(out)
    } finally {
      setCalculando(false)
    }
  }

  const aplicar = async () => {
    if (!cambios?.length) return
    setAplicando(true)
    let ok = 0
    let fallos = 0
    try {
      for (const c of cambios) {
        const { error } = await supabase
          .schema("telas")
          .from("cabecera")
          .update(c.updates)
          .eq("pedido", c.pedido)
        if (error) fallos++
        else ok++
      }
      if (fallos === 0) {
        toast.success("Fechas objetivo recalculadas", {
          description: `${ok} orden${ok !== 1 ? "es" : ""} actualizada${ok !== 1 ? "s" : ""}.`,
        })
      } else {
        toast.warning("Recálculo parcial", {
          description: `${ok} actualizadas, ${fallos} con error.`,
        })
      }
      setCambios(null)
      setAnalizadas(null)
      onOpenChange(false)
      onDone?.()
    } finally {
      setAplicando(false)
    }
  }

  const totalAreas = cambios?.reduce((a, c) => a + c.cambios.length, 0) ?? 0

  return (
    <Dialog open={open} onOpenChange={(v) => !aplicando && onOpenChange(v)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-indigo-600" />
            Recalcular fechas objetivo
          </DialogTitle>
          <DialogDescription>
            Aplica las reglas vigentes a todas las órdenes activas: Corte,
            Impresión y Sublimación no caen en fin de semana (jornada Lun–Vie), y
            en YARDAJE el Corte va después de Sublimación. Verás el detalle antes
            de guardar.
          </DialogDescription>
        </DialogHeader>

        {!cambios && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-slate-600">
              Se revisarán las órdenes <strong>aprobadas y aún no empacadas</strong>.
              Nada se guarda hasta que confirmes.
            </p>
            <Button onClick={() => void analizar()} disabled={calculando}>
              {calculando ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 size-4" />
              )}
              Analizar órdenes
            </Button>
          </div>
        )}

        {cambios && cambios.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">
              Todas las fechas ya están correctas
            </p>
            <p className="text-xs text-slate-500">
              Se revisaron {analizadas} órdenes activas y ninguna requiere cambios.
            </p>
          </div>
        )}

        {cambios && cambios.length > 0 && (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>{cambios.length}</strong> de {analizadas} órdenes cambiarían
                ({totalAreas} fecha{totalAreas !== 1 ? "s" : ""} de área). Estas
                fechas ya están a la vista de la planta: revisa antes de aplicar.
              </p>
            </div>
            <div className="max-h-[46vh] overflow-auto rounded-lg border">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Flujo</TableHead>
                    <TableHead>Cambios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cambios.map((c) => (
                    <TableRow key={c.pedido}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {c.pedido}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate" title={c.cliente ?? ""}>
                        {c.cliente ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {c.flujo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {c.cambios.map((x) => (
                            <div key={x.campo} className="flex items-center gap-1.5">
                              <span className="w-20 shrink-0 text-slate-500">
                                {x.label}
                              </span>
                              <span className="text-slate-400 line-through">
                                {x.antes ?? "—"}
                              </span>
                              <ArrowRight className="size-3 shrink-0 text-slate-400" />
                              <span className="font-medium text-indigo-700">
                                {x.despues ?? "sin fecha"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={aplicando}
          >
            Cancelar
          </Button>
          {cambios && cambios.length > 0 && (
            <Button onClick={() => void aplicar()} disabled={aplicando}>
              {aplicando ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-4" />
              )}
              Aplicar a {cambios.length} orden{cambios.length !== 1 ? "es" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
