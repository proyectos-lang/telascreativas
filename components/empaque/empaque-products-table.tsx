"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { DetalleOrden } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { CheckCircle2, Plus, AlertTriangle, PackageCheck } from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

interface EmpaqueProductsTableProps {
  detalles: DetalleOrden[]
  loading: boolean
  error: string | null
  onUpdated: () => Promise<void> | void
  disabled?: boolean
  disabledReason?: string
}

export function EmpaqueProductsTable({
  detalles,
  loading,
  error,
  onUpdated,
  disabled = false,
  disabledReason,
}: EmpaqueProductsTableProps) {
  // Track per-row "amount to add" input and submitting state
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleAccumulate = async (detalle: DetalleOrden) => {
    if (!supabase) {
      toast.error("Cliente de Supabase no configurado")
      return
    }

    const rowKey = detalle.id2 || String(detalle.id)
    const rawValue = (inputs[rowKey] ?? "").trim()
    const addedQty = Number(rawValue)

    if (!rawValue || isNaN(addedQty) || addedQty <= 0) {
      toast.error("Ingresa una cantidad valida", {
        description: "La cantidad a empacar debe ser un numero mayor a cero.",
      })
      return
    }

    const currentPacked = Number(detalle.pcs_empacados || 0)
    const total = Number(detalle.pcs || 0)
    const newTotal = currentPacked + addedQty

    if (total > 0 && newTotal > total) {
      toast.error("Cantidad excedida", {
        description: `El total empacado (${newTotal}) no puede superar el total de piezas (${total}).`,
      })
      return
    }

    if (!detalle.id2) {
      toast.error("Linea sin identificador id2", {
        description:
          "No se puede actualizar esta linea porque no tiene id2. Revisa los datos en detalleorden.",
      })
      return
    }

    setSavingId(rowKey)

    // Strict Supabase mapping:
    // UPDATE telas.detalleorden SET pcs_empacados = <nuevo_valor> WHERE id2 = <detalle.id2>
    const { error: updateError } = await supabase
      .schema("telas")
      .from("detalleorden")
      .update({ pcs_empacados: newTotal })
      .eq("id2", detalle.id2)

    console.log("[v0] Empaque Products - id2:", detalle.id2)
    console.log("[v0] Empaque Products - New total:", newTotal)
    console.log("[v0] Empaque Products - Update error:", updateError)

    if (updateError) {
      toast.error("Error al registrar", {
        description: updateError.message,
      })
      setSavingId(null)
      return
    }

    toast.success("Cantidad registrada", {
      description: `Se sumaron ${addedQty} piezas a ${detalle.nombre || "la linea"}. Total: ${newTotal}/${total}.`,
    })

    setInputs((prev) => ({ ...prev, [rowKey]: "" }))
    await onUpdated()
    setSavingId(null)
  }

  // Totals for summary
  const totalPcs = detalles.reduce((sum, d) => sum + Number(d.pcs || 0), 0)
  const totalEmpacados = detalles.reduce(
    (sum, d) => sum + Number(d.pcs_empacados || 0),
    0
  )
  const porcentaje =
    totalPcs > 0 ? Math.round((totalEmpacados / totalPcs) * 100) : 0
  const isFullyPacked = totalPcs > 0 && totalEmpacados >= totalPcs

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Spinner className="mr-2 size-4" />
        Cargando productos...
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (detalles.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="size-4" />
        <AlertDescription>
          No hay productos asociados a esta orden.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 flex-wrap">
        <div className="flex items-center gap-2">
          <PackageCheck
            className={`size-4 ${
              isFullyPacked ? "text-emerald-600" : "text-blue-600"
            }`}
          />
          <span className="text-sm font-medium">
            Progreso de empaque:{" "}
            <span
              className={
                isFullyPacked ? "text-emerald-700" : "text-foreground"
              }
            >
              {totalEmpacados.toLocaleString()} / {totalPcs.toLocaleString()}{" "}
              pcs
            </span>
          </span>
        </div>
        <Badge
          variant="outline"
          className={
            isFullyPacked
              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
              : porcentaje > 0
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "text-muted-foreground"
          }
        >
          {porcentaje}% completado
        </Badge>
      </div>

      {disabled && disabledReason && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertDescription className="text-amber-900">
            {disabledReason}
          </AlertDescription>
        </Alert>
      )}

      {/* Products table */}
      <div className="rounded-md border overflow-x-auto bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nombre</TableHead>
              <TableHead className="text-xs">Tela</TableHead>
              <TableHead className="text-xs">Genero</TableHead>
              <TableHead className="text-xs">Estilo</TableHead>
              <TableHead className="text-xs">Talla</TableHead>
              <TableHead className="text-xs text-right">Pcs</TableHead>
              <TableHead className="text-xs text-right">Empacadas</TableHead>
              <TableHead className="text-xs text-right w-[140px]">
                Agregar
              </TableHead>
              <TableHead className="text-xs w-[120px]">Accion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalles.map((detalle) => {
              const rowKey = detalle.id2 || String(detalle.id)
              const currentPacked = Number(detalle.pcs_empacados || 0)
              const total = Number(detalle.pcs || 0)
              const remaining = Math.max(0, total - currentPacked)
              const lineComplete = total > 0 && currentPacked >= total
              const isSaving = savingId === rowKey

              return (
                <TableRow
                  key={rowKey}
                  className={lineComplete ? "bg-emerald-50/40" : undefined}
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
                  <TableCell className="text-xs py-2">
                    {detalle.estilo || "-"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-xs">
                      {detalle.talla || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium py-2">
                    {total.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-right py-2">
                    <span
                      className={`font-semibold ${
                        lineComplete
                          ? "text-emerald-700"
                          : currentPacked > 0
                            ? "text-blue-700"
                            : "text-muted-foreground"
                      }`}
                    >
                      {currentPacked.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground"> / {total}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      type="number"
                      min={1}
                      max={remaining > 0 ? remaining : undefined}
                      placeholder={
                        lineComplete ? "Completo" : `+${remaining}`
                      }
                      value={inputs[rowKey] ?? ""}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [rowKey]: e.target.value,
                        }))
                      }
                      disabled={disabled || lineComplete || isSaving}
                      className="h-8 text-right text-xs"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    {lineComplete ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs">
                        <CheckCircle2 className="mr-1 size-3" />
                        Listo
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAccumulate(detalle)}
                        disabled={
                          disabled ||
                          isSaving ||
                          !((inputs[rowKey] ?? "").trim())
                        }
                        className="h-8 text-xs w-full"
                      >
                        {isSaving ? (
                          <Spinner className="size-3" />
                        ) : (
                          <>
                            <Plus className="mr-1 size-3" />
                            Sumar
                          </>
                        )}
                      </Button>
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
