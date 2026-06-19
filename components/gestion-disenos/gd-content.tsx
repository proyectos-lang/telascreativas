"use client"

import { useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGD } from "@/lib/gestion-disenos-context"
import { useAuth } from "@/lib/auth-context"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { GDTable } from "./gd-table"
import { GDDetail } from "./gd-detail"
import { GDAdminCatalogo } from "./gd-admin-catalogo"
import { GDSchematicForm } from "./gd-schematic-form"

export function GDContent() {
  const { solicitudes, isLoading, error, createSolicitud } = useGD()
  const { usuarioActual } = useAuth()

  const esVentas = !!usuarioActual?.gd_ventas
  const esDiseno = !!usuarioActual?.gd_diseno
  const esAdmin = !!usuarioActual?.gd_admin
  const usuarioRol = { esVentas, esDiseno, esAdmin }

  const [selected, setSelected] = useState<GestionDiseno | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newCliente, setNewCliente] = useState("")
  const [newFormData, setNewFormData] = useState<Partial<GestionDiseno>>({})
  const [saving, setSaving] = useState(false)

  // Sync selected with latest data after updates
  const selectedLive = selected
    ? solicitudes.find((s) => s.id === selected.id) ?? selected
    : null

  const handleCreate = async () => {
    if (!newCliente.trim()) {
      toast.error("El nombre del cliente es obligatorio")
      return
    }
    if (!usuarioActual?.nombre) {
      toast.error("No se pudo identificar la vendedora")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...newFormData,
        cliente: newCliente.trim(),
        vendedora: usuarioActual.nombre,
        disenador: null,
        fecha_asignacion: null,
        motivo_rechazo_diseno: null,
        aprobacion_ventas: null,
        imagen_aprobada_url: null,
        comentario_aprobacion: null,
        fecha_aprobacion: null,
        pedido_vinculado: null,
        segunda_prenda_activa: newFormData.segunda_prenda_activa ?? false,
        lleva_logos: newFormData.lleva_logos ?? false,
        lleva_patrocinadores: newFormData.lleva_patrocinadores ?? false,
        segunda_bolsas: newFormData.segunda_bolsas ?? false,
      } as Omit<GestionDiseno, "id" | "numero" | "fecha_creacion" | "estado" | "estado_turno" | "total_propuestas" | "propuestas">

      const res = await createSolicitud(payload)
      if (res.success) {
        toast.success("Solicitud creada como Borrador")
        setNewModalOpen(false)
        setNewCliente("")
        setNewFormData({})
      } else {
        toast.error("Error al crear solicitud", { description: res.error })
      }
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        <span>Cargando solicitudes de diseño...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-red-500">
        <AlertCircle className="size-6" />
        <p className="text-sm">{error}</p>
        <p className="text-xs text-slate-400">
          Verifica que las tablas del módulo GD existan en Supabase.
        </p>
      </div>
    )
  }

  if (selectedLive) {
    return (
      <div className="h-full">
        <GDDetail
          gestion={selectedLive}
          usuarioRol={usuarioRol}
          onBack={() => setSelected(null)}
        />
      </div>
    )
  }

  const tabs: { id: string; label: string; show: boolean }[] = [
    { id: "solicitudes", label: "Solicitudes", show: true },
    { id: "catalogo", label: "Catálogo", show: esAdmin },
  ]

  const visibleTabs = tabs.filter((t) => t.show)

  return (
    <>
      {visibleTabs.length > 1 ? (
        <Tabs defaultValue="solicitudes" className="h-full flex flex-col">
          <TabsList className="shrink-0">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="solicitudes" className="flex-1 overflow-auto mt-3">
            <GDTable
              solicitudes={solicitudes}
              onSelect={setSelected}
              onNew={() => setNewModalOpen(true)}
              canCreate={esVentas || esAdmin}
            />
          </TabsContent>

          <TabsContent value="catalogo" className="flex-1 overflow-auto mt-3">
            <GDAdminCatalogo />
          </TabsContent>
        </Tabs>
      ) : (
        <GDTable
          solicitudes={solicitudes}
          onSelect={setSelected}
          onNew={() => setNewModalOpen(true)}
          canCreate={esVentas || esAdmin}
        />
      )}

      {/* New solicitud modal */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Diseño</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Cliente <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newCliente}
                onChange={(e) => setNewCliente(e.target.value)}
                placeholder="Nombre del cliente o empresa..."
                autoFocus
              />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Esquemático (puedes completarlo después)
              </p>
              <GDSchematicForm
                onChange={setNewFormData}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setNewModalOpen(false)
                setNewCliente("")
                setNewFormData({})
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !newCliente.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? "Creando..." : "Crear solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
