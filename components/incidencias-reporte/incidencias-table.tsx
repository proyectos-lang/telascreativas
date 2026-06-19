"use client"

/**
 * Tabla principal del Reporte de Incidencias.
 *
 * Soporta dos modos de visualizacion controlados por el ToggleGroup del
 * header:
 *
 *   1. "Agrupada por area" (DEFAULT): cada `area_genera` se muestra como
 *      una fila colapsable con un resumen (total, pendientes,
 *      procesadas, sin reposicion). Al expandir, despliega una mini
 *      tabla con el detalle de incidencias de esa area. Es el modo
 *      pensado para que un Planner identifique rapidamente que area
 *      esta generando mas reposiciones y revise el detalle sin perder
 *      contexto.
 *
 *   2. "Plana": tabla tradicional con todas las incidencias del set
 *      filtrado, util para exportar/auditar.
 *
 * Reglas comunes:
 *   - El boton "Procesar" SOLO se renderiza si el usuario tiene rol
 *     Planner (`isPlanner`). Para el resto la fila es de lectura.
 *   - `genera_reposicion=false` se pinta con badge neutro "Sin
 *     reposicion".
 *   - Si el set filtrado supera 200 filas, se virtualiza simplemente
 *     cortando la salida y mostrando un aviso.
 */

import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Inbox,
  Layers,
  List,
  Lock,
  PlayCircle,
} from "lucide-react"
import { formatDateShort, formatDateTimeLong } from "@/lib/date-utils"
import { useAuth, isPlanner } from "@/lib/auth-context"
import {
  useIncidenciasReporte,
  type IncidenciaReporte,
} from "@/lib/incidencias-reporte-context"
import { IncidenciasProcesarModal } from "./incidencias-procesar-modal"

const HARD_LIMIT = 200
const UNASSIGNED_AREA = "Sin asignar"

type ViewMode = "grouped" | "flat"

function EstadoBadge({ inc }: { inc: IncidenciaReporte }) {
  if (!inc.genera_reposicion) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        Sin reposicion
      </Badge>
    )
  }
  const estado = (inc.estado_reposicion ?? "Pendiente").toLowerCase()
  if (estado === "procesado") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
        <CheckCircle2 className="mr-1 size-3" />
        Procesado
      </Badge>
    )
  }
  return (
    <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
      <AlertOctagon className="mr-1 size-3" />
      Pendiente
    </Badge>
  )
}

/**
 * Sub-tabla con el detalle de incidencias dentro de un grupo (cuando la
 * vista esta en modo "agrupada por area"). No repite la columna
 * "Responsable" porque ya esta en el header del grupo.
 */
function GroupDetailTable({
  rows,
  canEdit,
  onProcess,
}: {
  rows: IncidenciaReporte[]
  canEdit: boolean
  onProcess: (inc: IncidenciaReporte) => void
}) {
  return (
    <div className="rounded-md border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="whitespace-nowrap text-xs h-9">
              Pedido
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Estado
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Reporta
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Motivo
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Partes
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Talla
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Genero
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Fecha reporte
            </TableHead>
            <TableHead className="whitespace-nowrap text-xs h-9">
              Fecha procesado
            </TableHead>
            {canEdit && (
              <TableHead className="whitespace-nowrap text-xs h-9 text-right">
                Accion
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inc) => {
            const isPending =
              inc.genera_reposicion === true &&
              (inc.estado_reposicion ?? "").toLowerCase() === "pendiente"
            return (
              <TableRow
                key={inc.id}
                className={
                  isPending
                    ? "bg-rose-50/40 hover:bg-rose-50"
                    : "hover:bg-muted/40"
                }
              >
                <TableCell className="font-medium whitespace-nowrap text-sm py-2">
                  {inc.pedido}
                </TableCell>
                <TableCell className="whitespace-nowrap py-2">
                  <EstadoBadge inc={inc} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm py-2">
                  <Badge variant="outline" className="text-xs">
                    {inc.area_reporta || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm py-2">
                  <span className="line-clamp-2 max-w-[220px] block">
                    {inc.motivo_especifico ?? (
                      <span className="text-muted-foreground italic">
                        Sin motivo
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm py-2">
                  <span className="line-clamp-2 max-w-[180px] block text-xs">
                    {inc.partes_reposicion ? (
                      inc.partes_reposicion
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm py-2">
                  {inc.talla || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm py-2">
                  {inc.genero || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground py-2">
                  {formatDateShort(inc.fecha_reporte || inc.created_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground py-2">
                  {inc.fecha_procesado
                    ? formatDateTimeLong(inc.fecha_procesado)
                    : "—"}
                </TableCell>
                {canEdit && (
                  <TableCell className="whitespace-nowrap text-right py-2">
                    {isPending ? (
                      <Button
                        size="sm"
                        onClick={() => onProcess(inc)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2"
                      >
                        <PlayCircle className="mr-1 size-3.5" />
                        Procesar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function IncidenciasTable() {
  const { filteredIncidencias, isLoading } = useIncidenciasReporte()
  const { usuarioActual } = useAuth()
  const canEdit = isPlanner(usuarioActual)

  const [toProcess, setToProcess] = useState<IncidenciaReporte | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("grouped")
  // Areas expandidas en modo agrupado. Set para O(1) toggling. El default
  // es vacio = todas colapsadas, asi el usuario ve un overview limpio y
  // expande lo que le interesa.
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set())

  // Cap defensive: en modo plano cortamos a HARD_LIMIT. En modo agrupado
  // NO cortamos porque el agrupado es justamente la herramienta para
  // navegar conjuntos grandes; el render esta atenuado por el colapso.
  const { rows, truncated } = useMemo(() => {
    if (viewMode === "flat" && filteredIncidencias.length > HARD_LIMIT) {
      return {
        rows: filteredIncidencias.slice(0, HARD_LIMIT),
        truncated: filteredIncidencias.length - HARD_LIMIT,
      }
    }
    return { rows: filteredIncidencias, truncated: 0 }
  }, [filteredIncidencias, viewMode])

  /**
   * Agrupacion por `area_genera` (area responsable). Cada grupo trae sus
   * filas, totales por estado y se ordena por: areas con mas pendientes
   * primero (foco operativo), luego por total descendente.
   */
  const grupos = useMemo(() => {
    const map = new Map<
      string,
      {
        area: string
        rows: IncidenciaReporte[]
        total: number
        pendientes: number
        procesadas: number
        sinReposicion: number
      }
    >()
    for (const inc of filteredIncidencias) {
      const area = (inc.area_genera || "").trim() || UNASSIGNED_AREA
      let g = map.get(area)
      if (!g) {
        g = {
          area,
          rows: [],
          total: 0,
          pendientes: 0,
          procesadas: 0,
          sinReposicion: 0,
        }
        map.set(area, g)
      }
      g.rows.push(inc)
      g.total += 1
      if (!inc.genera_reposicion) {
        g.sinReposicion += 1
      } else if (
        (inc.estado_reposicion ?? "").toLowerCase() === "procesado"
      ) {
        g.procesadas += 1
      } else {
        g.pendientes += 1
      }
    }
    // Orden: pendientes desc, luego total desc, luego nombre asc.
    return Array.from(map.values()).sort((a, b) => {
      if (b.pendientes !== a.pendientes) return b.pendientes - a.pendientes
      if (b.total !== a.total) return b.total - a.total
      return a.area.localeCompare(b.area)
    })
  }, [filteredIncidencias])

  const toggleArea = (area: string) => {
    setOpenAreas((prev) => {
      const next = new Set(prev)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      return next
    })
  }

  const expandAll = () => {
    setOpenAreas(new Set(grupos.map((g) => g.area)))
  }
  const collapseAll = () => setOpenAreas(new Set())

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <ClipboardList className="size-4 text-slate-700" />
            </div>
            <div>
              <CardTitle className="text-base">
                Listado de Incidencias
              </CardTitle>
              <CardDescription className="text-xs">
                {filteredIncidencias.length} resultado
                {filteredIncidencias.length === 1 ? "" : "s"} segun los filtros
                actuales
                {viewMode === "grouped" && grupos.length > 0 && (
                  <>
                    {" "}
                    · agrupados en <strong>{grupos.length}</strong> area
                    {grupos.length === 1 ? "" : "s"}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!canEdit && (
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] h-5"
              >
                <Lock className="mr-1 size-3" />
                Solo lectura
              </Badge>
            )}
            {viewMode === "grouped" && grupos.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={expandAll}
                >
                  Expandir todo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={collapseAll}
                >
                  Colapsar todo
                </Button>
              </div>
            )}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                if (v === "grouped" || v === "flat") setViewMode(v)
              }}
              className="border rounded-md"
              size="sm"
            >
              <ToggleGroupItem
                value="grouped"
                aria-label="Vista agrupada por area"
                className="h-7 text-xs px-2 gap-1 data-[state=on]:bg-rose-100 data-[state=on]:text-rose-700"
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Agrupada</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="flat"
                aria-label="Vista plana"
                className="h-7 text-xs px-2 gap-1 data-[state=on]:bg-rose-100 data-[state=on]:text-rose-700"
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline">Plana</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {truncated > 0 && (
          <Alert className="mb-3 border-amber-200 bg-amber-50 text-amber-900">
            <AlertOctagon className="size-4 text-amber-700" />
            <AlertDescription className="text-xs">
              Se muestran las primeras <strong>{HARD_LIMIT}</strong> filas. Hay{" "}
              <strong>{truncated}</strong> registros adicionales — refina los
              filtros o usa la vista <strong>Agrupada</strong> para ver todo.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredIncidencias.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="size-8 text-slate-300" />
            <p className="text-sm">
              No hay incidencias que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : viewMode === "grouped" ? (
          /* ----------------------- VISTA AGRUPADA ----------------------- */
          <div className="space-y-2">
            {grupos.map((g) => {
              const isOpen = openAreas.has(g.area)
              return (
                <div
                  key={g.area}
                  className="rounded-md border bg-white overflow-hidden"
                >
                  {/* Header del grupo: clickeable, muestra contadores */}
                  <button
                    type="button"
                    onClick={() => toggleArea(g.area)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-sm truncate">
                        {g.area}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 shrink-0"
                      >
                        {g.total} total
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {g.pendientes > 0 && (
                        <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] h-5">
                          <AlertOctagon className="mr-1 size-3" />
                          {g.pendientes} pend.
                        </Badge>
                      )}
                      {g.procesadas > 0 && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-5">
                          <CheckCircle2 className="mr-1 size-3" />
                          {g.procesadas} proc.
                        </Badge>
                      )}
                      {g.sinReposicion > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 text-muted-foreground"
                        >
                          {g.sinReposicion} s/repo.
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Detalle del grupo (mini tabla). Se monta solo cuando
                      esta expandido para evitar render innecesario en
                      conjuntos grandes con muchas areas. */}
                  {isOpen && (
                    <div className="border-t bg-muted/20 p-2">
                      <GroupDetailTable
                        rows={g.rows}
                        canEdit={canEdit}
                        onProcess={(inc) => setToProcess(inc)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ------------------------- VISTA PLANA ------------------------ */
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Pedido</TableHead>
                  <TableHead className="whitespace-nowrap">Estado</TableHead>
                  <TableHead className="whitespace-nowrap">Reporta</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Responsable
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Motivo</TableHead>
                  <TableHead className="whitespace-nowrap">Partes</TableHead>
                  <TableHead className="whitespace-nowrap">Talla</TableHead>
                  <TableHead className="whitespace-nowrap">Genero</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Fecha reporte
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Fecha procesado
                  </TableHead>
                  {canEdit && (
                    <TableHead className="whitespace-nowrap text-right">
                      Accion
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inc) => {
                  const isPending =
                    inc.genera_reposicion === true &&
                    (inc.estado_reposicion ?? "").toLowerCase() === "pendiente"
                  return (
                    <TableRow
                      key={inc.id}
                      className={
                        isPending
                          ? "bg-rose-50/50 hover:bg-rose-50"
                          : "hover:bg-muted/40"
                      }
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {inc.pedido}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EstadoBadge inc={inc} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <Badge variant="outline" className="text-xs">
                          {inc.area_reporta || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-200 bg-amber-50 text-amber-800"
                        >
                          {inc.area_genera || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="line-clamp-2 max-w-[220px]">
                          {inc.motivo_especifico ?? (
                            <span className="text-muted-foreground italic">
                              Sin motivo
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="line-clamp-2 max-w-[180px] block text-xs">
                          {inc.partes_reposicion ? (
                            inc.partes_reposicion
                          ) : (
                            <span className="text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {inc.talla || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {inc.genero || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateShort(inc.fecha_reporte || inc.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {inc.fecha_procesado
                          ? formatDateTimeLong(inc.fecha_procesado)
                          : "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="whitespace-nowrap text-right">
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => setToProcess(inc)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <PlayCircle className="mr-1 size-3.5" />
                              Procesar
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <IncidenciasProcesarModal
        incidencia={toProcess}
        onClose={() => setToProcess(null)}
      />
    </Card>
  )
}
