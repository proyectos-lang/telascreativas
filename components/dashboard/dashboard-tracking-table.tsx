"use client"

import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
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
import {
  ChevronLeft,
  ChevronRight,
  Factory,
  Search,
} from "lucide-react"
import { FlowStepper } from "./dashboard-flow-stepper"
import { useDashboard } from "@/lib/dashboard-context"
import type { NivelRiesgo, VistaControlProduccion } from "@/lib/types"

const PAGE_SIZE = 10

function formatDate(d?: string | null): string {
  if (!d) return "-"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function riskBadge(n?: NivelRiesgo | null) {
  switch (n) {
    case "Vencido":
      return (
        <Badge className="bg-rose-600 hover:bg-rose-600 text-white border-0">
          Vencido
        </Badge>
      )
    case "Riesgo Critico":
      return (
        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border border-rose-200">
          Critico
        </Badge>
      )
    case "Riesgo Medio":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">
          Medio
        </Badge>
      )
    case "A Tiempo":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
          A Tiempo
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          -
        </Badge>
      )
  }
}

export function DashboardTrackingTable() {
  const { rows, isLoading } = useDashboard()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo<VistaControlProduccion[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.pedido || "").toLowerCase().includes(q) ||
        (r.cliente || "").toLowerCase().includes(q)
    )
  }, [rows, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  )

  return (
    <Card className="bg-white/80 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Factory className="size-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Master Tracking</CardTitle>
              <CardDescription className="text-xs">
                Flujo en planta por pedido (DIS - COR - IMP - SUB - COS - EMP)
              </CardDescription>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Buscar pedido o cliente..."
              className="pl-9 h-9 bg-white"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold">
                      Pedido
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      PCS
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Riesgo
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Entrega
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Flujo en Planta
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No se encontraron pedidos con los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row) => (
                      <TableRow key={row.pedido} className="text-xs">
                        <TableCell className="font-semibold text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {row.pedido}
                            {row.es_urgente && (
                              <Badge
                                variant="outline"
                                className="border-rose-300 bg-rose-100 text-rose-700 h-4 px-1 text-[9px]"
                              >
                                U
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {row.cliente}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {new Intl.NumberFormat("es-CO").format(
                            Number(row.pcs) || 0
                          )}
                        </TableCell>
                        <TableCell>{riskBadge(row.nivel_riesgo)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(row.fecha_de_entrega)}
                        </TableCell>
                        <TableCell>
                          <FlowStepper row={row} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <p>
                Mostrando{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length === 0 ? 0 : current * PAGE_SIZE + 1}
                </span>
                -
                <span className="font-semibold text-foreground">
                  {Math.min((current + 1) * PAGE_SIZE, filtered.length)}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length}
                </span>{" "}
                pedidos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={current === 0}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-xs px-2">
                  Pag. {current + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={current >= totalPages - 1}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
