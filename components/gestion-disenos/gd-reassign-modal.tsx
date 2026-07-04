"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, UserCog } from "lucide-react"
import { useGD } from "@/lib/gestion-disenos-context"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Disenador {
  nombre: string
  activos: number
}

interface GDReassignModalProps {
  gestion: GestionDiseno
  open: boolean
  onClose: () => void
}

export function GDReassignModal({ gestion, open, onClose }: GDReassignModalProps) {
  const { updateSolicitud } = useGD()
  const [disenadores, setDisenadores] = useState<Disenador[]>([])
  const [loadingDis, setLoadingDis] = useState(false)
  const [selected, setSelected] = useState(gestion.disenador ?? "")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(gestion.disenador ?? "")
    setLoadingDis(true)
    Promise.all([
      supabase.schema("telas").from("disenadores").select("nombre").order("nombre"),
      supabase
        .schema("telas")
        .from("gestion_disenos")
        .select("disenador")
        .not("disenador", "is", null)
        .not("estado", "in", '("Finalizado","Rechazado","Devuelto")'),
    ]).then(([disRes, casosRes]) => {
      const nombres: string[] = (disRes.data ?? []).map((d: { nombre: string }) => d.nombre)
      const carga = new Map<string, number>(nombres.map((n) => [n, 0]))
      for (const c of casosRes.data ?? []) {
        const n = c.disenador as string
        carga.set(n, (carga.get(n) ?? 0) + 1)
      }
      const lista: Disenador[] = nombres
        .map((n) => ({ nombre: n, activos: carga.get(n) ?? 0 }))
        .sort((a, b) => a.activos - b.activos)
      setDisenadores(lista)
      setLoadingDis(false)
    })
  }, [open, gestion.disenador])

  const handleSubmit = async () => {
    if (!selected) {
      toast.error("Selecciona un diseñador")
      return
    }
    if (selected === gestion.disenador) {
      toast.error("El diseñador seleccionado ya está asignado")
      return
    }
    setLoading(true)
    try {
      const res = await updateSolicitud(gestion.id, {
        disenador: selected,
        fecha_asignacion: new Date().toISOString(),
      })
      if (res.success) {
        toast.success("Diseñador reasignado", {
          description: `Ahora asignado a ${selected}.`,
        })
        onClose()
      } else {
        toast.error("Error al reasignar", { description: res.error })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reasignar Diseñador</DialogTitle>
          <DialogDescription>
            {gestion.numero} — actualmente asignado a {gestion.disenador ?? "nadie"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-sm flex items-center gap-1">
            <UserCog className="size-3.5" />
            Nuevo diseñador <span className="text-red-500">*</span>
          </Label>
          {loadingDis ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <Loader2 className="size-4 animate-spin" />
              Cargando diseñadores...
            </div>
          ) : disenadores.length === 0 ? (
            <p className="text-sm text-slate-400">No hay diseñadores disponibles.</p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {disenadores.map((d, i) => (
                <option key={d.nombre} value={d.nombre}>
                  {d.nombre} ({d.activos} activos){i === 0 ? " — Menor carga" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || loadingDis || !selected || selected === gestion.disenador}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <UserCog className="size-4" />
            {loading ? "Reasignando..." : "Reasignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
