"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { DetalleOrden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle2, Loader2, Package } from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface TrazabilidadProductsProps {
  pedido: string
  // Total piezas de la orden (viene de telas.cabecera.pcs)
  totalPcsOrden?: number
}

export function TrazabilidadProducts({
  pedido,
  totalPcsOrden,
}: TrazabilidadProductsProps) {
  const [detalles, setDetalles] = useState<DetalleOrden[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)
      const { data, error: supabaseError } = await supabase
        .schema("telas")
        .from("detalleorden")
        .select("*")
        .eq("pedido", pedido)

      console.log("[v0] Trazabilidad Products - data:", data)
      console.log("[v0] Trazabilidad Products - error:", supabaseError)

      if (cancelled) return

      if (supabaseError) {
        setError(supabaseError.message)
        setDetalles([])
      } else {
        setDetalles((data || []) as DetalleOrden[])
      }
      setIsLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [pedido])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600 py-4">
        Error al cargar los productos: {error}
      </p>
    )
  }

  if (detalles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="size-8 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm">No hay productos asociados a este pedido.</p>
      </div>
    )
  }

  // "Total Piezas" proviene directamente de telas.cabecera.pcs (no se suma
  // desde detalleorden porque puede contener lineas de muestra/diferentes talleres).
  // Si por alguna razon el prop llega vacio caemos al calculo local como fallback.
  const sumDetalles = detalles.reduce((sum, d) => sum + (d.pcs || 0), 0)
  const totalPcs =
    typeof totalPcsOrden === "number" && totalPcsOrden > 0
      ? totalPcsOrden
      : sumDetalles
  const totalEmpacadas = detalles.reduce(
    (sum, d) => sum + (d.pcs_empacados || 0),
    0
  )
  const pct =
    totalPcs > 0 ? Math.round((totalEmpacadas / totalPcs) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground uppercase text-[10px] tracking-wide">
            Total Piezas
          </p>
          <p className="text-sm font-semibold text-foreground">
            {totalPcs.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground uppercase text-[10px] tracking-wide">
            Empacadas
          </p>
          <p className="text-sm font-semibold text-foreground">
            {totalEmpacadas.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground uppercase text-[10px] tracking-wide">
            Avance
          </p>
          <p className="text-sm font-semibold text-foreground">{pct}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nombre</TableHead>
              <TableHead className="text-xs">Tela</TableHead>
              <TableHead className="text-xs">Genero</TableHead>
              <TableHead className="text-xs">Talla</TableHead>
              <TableHead className="text-xs text-right">Pcs</TableHead>
              <TableHead className="text-xs text-right">Empacadas</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalles.map((d, index) => {
              const empacadas = d.pcs_empacados || 0
              const total = d.pcs || 0
              const complete = total > 0 && empacadas >= total
              return (
                <TableRow
                  key={d.id2 || `det-${index}`}
                  className={complete ? "bg-emerald-50/40" : undefined}
                >
                  <TableCell className="text-xs font-medium py-2">
                    {d.nombre || "-"}
                  </TableCell>
                  <TableCell className="text-xs py-2">{d.tela || "-"}</TableCell>
                  <TableCell className="text-xs py-2">
                    {d.genero || "-"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-xs">
                      {d.talla || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium py-2">
                    {total.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium py-2">
                    {empacadas.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2">
                    {complete ? (
                      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs">
                        <CheckCircle2 className="mr-1 size-3" />
                        Listo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
