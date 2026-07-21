"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GestionDiseno, EstadoGD, EstadoTurno } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS, ESTADO_TURNO_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

interface GDTableProps {
  solicitudes: GestionDiseno[]
  onSelect: (s: GestionDiseno) => void
  onNew?: () => void
  canCreate?: boolean
}

const ESTADO_FILTER_OPTIONS: (EstadoGD | "Todos")[] = [
  "Todos",
  "Borrador",
  "Pendiente Revision",
  "En Progreso",
  "Esperando Retroalimentacion",
  "Pendiente Aprobacion",
  "Aprobado",
  "Finalizando",
  "Finalizado",
  "Rechazado",
]

export function GDTable({ solicitudes, onSelect, onNew, canCreate }: GDTableProps) {
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<EstadoGD | "Todos">("Todos")
  const [turnoFilter, setTurnoFilter] = useState<EstadoTurno | "Todos">("Todos")

  const filtered = solicitudes.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.numero.toLowerCase().includes(q) ||
      s.cliente.toLowerCase().includes(q) ||
      s.vendedora.toLowerCase().includes(q) ||
      (s.disenador?.toLowerCase().includes(q) ?? false) ||
      (s.pedido_vinculado?.includes(q) ?? false)

    const matchEstado = estadoFilter === "Todos" || s.estado === estadoFilter
    const matchTurno = turnoFilter === "Todos" || s.estado_turno === turnoFilter

    return matchSearch && matchEstado && matchTurno
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por número, cliente, vendedora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EstadoGD | "Todos")}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {ESTADO_FILTER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <select
          value={turnoFilter}
          onChange={(e) => setTurnoFilter(e.target.value as EstadoTurno | "Todos")}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="Todos">Todos los turnos</option>
          <option value="En Ventas">En Ventas</option>
          <option value="En Diseño">En Diseño</option>
          <option value="En Cliente">En Cliente</option>
        </select>

        {canCreate && onNew && (
          <Button onClick={onNew} size="sm" className="h-8 gap-1 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="size-3.5" />
            Nueva solicitud
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">N°</th>
              <th className="px-3 py-2.5 text-left font-medium hidden sm:table-cell">Pedido</th>
              <th className="px-3 py-2.5 text-left font-medium">Cliente</th>
              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Tipo</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Vendedora</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Diseñador</th>
              <th className="px-3 py-2.5 text-left font-medium">Estado</th>
              <th className="px-3 py-2.5 text-left font-medium hidden sm:table-cell">Turno</th>
              <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  No se encontraron solicitudes
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-semibold text-indigo-700">{s.numero}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {s.pedido_vinculado ? (
                      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800">
                        {s.pedido_vinculado}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800 truncate max-w-32">{s.cliente}</p>
                    {s.tipos_prenda?.length ? (
                      <p className="text-xs text-slate-400 truncate max-w-32">
                        {s.tipos_prenda.join(", ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    {s.tipo_diseno ? (
                      <span className="text-xs font-medium text-slate-600">{s.tipo_diseno}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-600 text-xs">
                    {s.vendedora}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-600 text-xs">
                    {s.disenador ?? <span className="text-slate-300">Sin asignar</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                        ESTADO_GD_COLORS[s.estado]
                      )}
                    >
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                        ESTADO_TURNO_COLORS[s.estado_turno]
                      )}
                    >
                      {s.estado_turno}
                    </span>
                    {s.total_propuestas >= 4 && (
                      <span
                        className={cn(
                          "ml-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                          s.total_propuestas >= 5
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {s.total_propuestas}/5
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-slate-400">
                    {format(new Date(s.fecha_creacion), "dd MMM yy", { locale: es })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length} de {solicitudes.length} solicitudes
      </p>
    </div>
  )
}
