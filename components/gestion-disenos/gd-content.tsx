"use client"

import { useState } from "react"
import { Loader2, AlertCircle, ArrowLeft, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGD } from "@/lib/gestion-disenos-context"
import { useAuth } from "@/lib/auth-context"
import type { GestionDiseno } from "@/lib/gestion-disenos-types"
import { GDTable } from "./gd-table"
import { GDDetail } from "./gd-detail"
import { GDAdminCatalogo } from "./gd-admin-catalogo"
import { GDSchematicForm } from "./gd-schematic-form"
import { GDDashboard } from "./gd-dashboard"
import { GDNotificationBanner } from "./gd-notification-banner"

type RoleView = "admin" | "ventas" | "diseno"

const ROLE_PASSWORDS: Record<"ventas" | "diseno", string> = {
  ventas: "Vendedora123",
  diseno: "Disenador123",
}

const ROLE_LABELS: Record<RoleView, string> = {
  admin: "Admin",
  ventas: "Vendedora",
  diseno: "Diseñador",
}

export function GDContent() {
  const { solicitudes, isLoading, error, createSolicitud } = useGD()
  const { usuarioActual } = useAuth()

  const esVentas = !!usuarioActual?.gd_ventas
  const esDiseno = !!usuarioActual?.gd_diseno
  const esAdmin = !!usuarioActual?.gd_admin

  const [roleView, setRoleView] = useState<RoleView>("admin")
  const [passwordModalFor, setPasswordModalFor] = useState<"ventas" | "diseno" | null>(null)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const [selected, setSelected] = useState<GestionDiseno | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newCliente, setNewCliente] = useState("")
  const [newFormData, setNewFormData] = useState<Partial<GestionDiseno>>({})
  const [saving, setSaving] = useState(false)

  const effectiveVentas = roleView === "ventas"
  const effectiveDiseno = roleView === "diseno"
  const effectiveAdmin = roleView === "admin"
  const usuarioRol =
    roleView === "admin"
      ? { esVentas, esDiseno, esAdmin }
      : roleView === "ventas"
      ? { esVentas: true, esDiseno: false, esAdmin: false }
      : { esVentas: false, esDiseno: true, esAdmin: false }

  // All views see all solicitudes — the difference is in available action buttons (usuarioRol)
  const solicitudesFiltradas = solicitudes

  const selectedLive = selected
    ? solicitudes.find((s) => s.id === selected.id) ?? selected
    : null

  const handleSelectFromNotification = (id: number) => {
    const s = solicitudes.find((sol) => sol.id === id)
    if (s) setSelected(s)
  }

  const switchView = (view: RoleView) => {
    setRoleView(view)
    setSelected(null)
  }

  const openPasswordModal = (role: "ventas" | "diseno") => {
    if (roleView === role) return
    setPasswordModalFor(role)
    setPasswordInput("")
    setPasswordError("")
  }

  const handlePasswordSubmit = () => {
    if (!passwordModalFor) return
    if (passwordInput === ROLE_PASSWORDS[passwordModalFor]) {
      switchView(passwordModalFor)
      setPasswordModalFor(null)
      setPasswordInput("")
      setPasswordError("")
    } else {
      setPasswordError("Contraseña incorrecta")
    }
  }

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
        <GDNotificationBanner onSelectSolicitud={handleSelectFromNotification} />
      </div>
    )
  }

  if (newModalOpen) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setNewModalOpen(false)
              setNewCliente("")
              setNewFormData({})
            }}
          >
            <ArrowLeft className="size-4 mr-1" />
            Volver
          </Button>
          <h2 className="text-base font-semibold text-slate-800">
            Nueva Solicitud de Diseño
          </h2>
        </div>

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
            <GDSchematicForm onChange={setNewFormData} />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 pt-3 flex justify-end gap-2">
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
        </div>
      </div>
    )
  }

  // View switcher bar
  const viewSwitcher = (
    <div className="flex items-center gap-1 mb-3 p-1 bg-slate-50 rounded-lg border border-slate-200 w-fit shrink-0 text-xs">
      <span className="flex items-center gap-1 px-2 text-slate-400 font-medium">
        <Lock className="size-3" />
        Vista:
      </span>
      {(["admin", "ventas", "diseno"] as RoleView[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() =>
            v === "admin" ? switchView("admin") : openPasswordModal(v as "ventas" | "diseno")
          }
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            roleView === v
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          {ROLE_LABELS[v]}
        </button>
      ))}
    </div>
  )

  const canCreate = effectiveAdmin
    ? esVentas || esAdmin
    : effectiveVentas

  const tabs = [
    {
      id: "solicitudes",
      label: effectiveDiseno ? "Diseños" : "Solicitudes",
      show: true,
    },
    { id: "dashboard", label: "Control Gerencia", show: effectiveAdmin },
    { id: "catalogo", label: "Catálogos de Diseño", show: effectiveAdmin },
  ]
  const visibleTabs = tabs.filter((t) => t.show)

  if (visibleTabs.length > 1) {
    return (
      <div className="flex flex-col h-full">
        {viewSwitcher}
        <Tabs defaultValue="solicitudes" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="shrink-0">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="solicitudes" className="flex-1 overflow-auto mt-3">
            <GDTable
              solicitudes={solicitudesFiltradas}
              onSelect={setSelected}
              onNew={() => setNewModalOpen(true)}
              canCreate={canCreate}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="flex-1 overflow-auto mt-3">
            <GDDashboard solicitudes={solicitudes} onSelect={setSelected} />
          </TabsContent>

          <TabsContent value="catalogo" className="flex-1 overflow-auto mt-3">
            <GDAdminCatalogo />
          </TabsContent>
        </Tabs>

        <GDNotificationBanner onSelectSolicitud={handleSelectFromNotification} />

        {/* Password modal */}
        <Dialog
          open={!!passwordModalFor}
          onOpenChange={(open) => {
            if (!open) {
              setPasswordModalFor(null)
              setPasswordInput("")
              setPasswordError("")
            }
          }}
        >
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="size-4 text-indigo-600" />
                Vista {passwordModalFor ? ROLE_LABELS[passwordModalFor] : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Ingresa la contraseña para acceder a esta vista.</p>
              <Input
                type="password"
                placeholder="Contraseña..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value)
                  setPasswordError("")
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-red-600">{passwordError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPasswordModalFor(null)
                    setPasswordInput("")
                    setPasswordError("")
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handlePasswordSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={!passwordInput}
                >
                  Entrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {viewSwitcher}
      <div className="flex-1 overflow-auto">
        <GDTable
          solicitudes={solicitudesFiltradas}
          onSelect={setSelected}
          onNew={() => setNewModalOpen(true)}
          canCreate={canCreate}
        />
      </div>

      <GDNotificationBanner onSelectSolicitud={handleSelectFromNotification} />

      {/* Password modal */}
      <Dialog
        open={!!passwordModalFor}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordModalFor(null)
            setPasswordInput("")
            setPasswordError("")
          }
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-4 text-indigo-600" />
              Vista {passwordModalFor ? ROLE_LABELS[passwordModalFor] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Ingresa la contraseña para acceder a esta vista.</p>
            <Input
              type="password"
              placeholder="Contraseña..."
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value)
                setPasswordError("")
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              autoFocus
            />
            {passwordError && (
              <p className="text-xs text-red-600">{passwordError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPasswordModalFor(null)
                  setPasswordInput("")
                  setPasswordError("")
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handlePasswordSubmit}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={!passwordInput}
              >
                Entrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
