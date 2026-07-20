"use client"

import { useState } from "react"
import { Search, History } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { ESTADO_GD_COLORS } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"

interface GDSourcePickerProps {
  open: boolean
  onClose: () => void
  clienteNombre: string
  solicitudes: GestionDiseno[]
  onSelect: (design: GestionDiseno) => void
}

export function GDSourcePicker({
  open,
  onClose,
  clienteNombre,
  solicitudes,
  onSelect,
}: GDSourcePickerProps) {
  const [search, setSearch] = useState("")

  const q = search.toLowerCase().trim()
  const clienteLower = clienteNombre.toLowerCase().trim()

  const filtered = q
    ? solicitudes.filter(
        (s) =>
          s.numero.toLowerCase().includes(q) ||
          s.cliente.toLowerCase().includes(q) ||
          (s.tematica?.toLowerCase().includes(q) ?? false) ||
          (s.tipos_prenda?.some((p) => p.toLowerCase().includes(q)) ?? false)
      )
    : clienteLower
    ? solicitudes.filter((s) => s.cliente.toLowerCase().includes(clienteLower))
    : solicitudes

  const clienteHasDesigns =
    !clienteLower ||
    solicitudes.some((s) => s.cliente.toLowerCase().includes(clienteLower))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSearch("")
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-indigo-600" />
            Seleccionar diseño base
          </DialogTitle>
          <DialogDescription>
            {q
              ? "Buscando en todos los diseños"
              : clienteNombre
              ? `Diseños anteriores de "${clienteNombre}"`
              : "Todos los diseños"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, temática o prenda..."
            className="pl-8"
            autoFocus
          />
        </div>

        {!q && !clienteHasDesigns ? (
          <div className="rounded-lg bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-600">
              No hay diseños anteriores para{" "}
              <strong>{clienteNombre}</strong>.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Usa la búsqueda para encontrar diseños de otro cliente.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-2">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Sin resultados para &ldquo;{search}&rdquo;
                </p>
              ) : (
                filtered.map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => {
                      setSearch("")
                      onSelect(design)
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Header: numero + badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-indigo-700">
                            {design.numero}
                          </span>
                          <Badge
                            className={cn(
                              "text-[10px]",
                              ESTADO_GD_COLORS[design.estado]
                            )}
                          >
                            {design.estado}
                          </Badge>
                          {design.tipo_diseno && (
                            <span className="text-[10px] font-medium text-slate-500">
                              {design.tipo_diseno}
                            </span>
                          )}
                        </div>

                        {/* Client name (when searching across all clients) */}
                        {q && (
                          <p className="text-xs font-medium text-slate-600">
                            {design.cliente}
                          </p>
                        )}

                        {/* Prendas + manga */}
                        {design.tipos_prenda?.length ? (
                          <p className="text-xs text-slate-500">
                            {design.tipos_prenda.join(" · ")}
                            {design.tipo_manga
                              ? ` · ${design.tipo_manga}`
                              : ""}
                          </p>
                        ) : null}

                        {/* Tematica */}
                        {design.tematica && (
                          <p className="truncate text-xs text-slate-400">
                            {design.tematica}
                          </p>
                        )}

                        {/* Date */}
                        <p className="text-[10px] text-slate-400">
                          {format(
                            new Date(design.fecha_creacion),
                            "dd MMM yyyy",
                            { locale: es }
                          )}
                        </p>
                      </div>

                      {/* Color swatches + call to action */}
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {(design.color_fondo || design.color_secundario) && (
                          <div className="flex gap-1">
                            {design.color_fondo && (
                              <div
                                className="size-5 rounded-full border border-slate-200 shadow-inner"
                                style={{ backgroundColor: design.color_fondo }}
                                title={design.color_fondo}
                              />
                            )}
                            {design.color_secundario && (
                              <div
                                className="size-5 rounded-full border border-slate-200 shadow-inner"
                                style={{
                                  backgroundColor: design.color_secundario,
                                }}
                                title={design.color_secundario}
                              />
                            )}
                          </div>
                        )}
                        <span className="text-[10px] font-medium text-indigo-600">
                          Usar este →
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-slate-400">
          {filtered.length} diseño{filtered.length !== 1 ? "s" : ""}
          {!q && clienteNombre ? ` de ${clienteNombre}` : " encontrados"}
        </p>
      </DialogContent>
    </Dialog>
  )
}
