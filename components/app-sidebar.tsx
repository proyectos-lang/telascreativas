"use client"

import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  AlertOctagon,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  Flame,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Palette,
  Printer,
  Route,
  Scissors,
  Shirt,
  Truck,
  User,
  Layers,
  Brush,
  Sparkles,
  MessageSquare,
  ClipboardList,
  Newspaper,
  Settings,
  ChevronDown,
  Search,
} from "lucide-react"
import { useAuth, canViewForUser } from "@/lib/auth-context"
import { useGD } from "@/lib/gestion-disenos-context"
import { useComunicaciones } from "@/lib/comunicaciones-context"
import { UserAvatar } from "@/components/comunicaciones/user-avatar"
import { PerfilModal } from "@/components/comunicaciones/perfil-modal"

export type ActiveView =
  | "dashboard"
  | "programacion"
  | "diseno"
  | "gestion-disenos"
  | "corte"
  | "impresion"
  | "sublimacion"
  | "costura"
  | "empaque"
  | "entregas"
  | "trazabilidad"
  | "resumendia"
  | "plansemanal"
  | "incidencias"
  | "indicadores"
  | "ordenes"
  | "produccion"
  | "clientes"
  | "inventario"
  | "asistente-ia"
  | "comunicaciones"
  | "com-tareas"
  | "com-noticias"
  | "configuracion"

interface AppSidebarProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

const menuItems: {
  title: string
  key: ActiveView
  icon: React.ElementType
  iconColor: string
  group?: "administrativo" | "operaciones" | "comunicaciones"
}[] = [
  {
    title: "Dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    iconColor: "text-icon-cyan",
    group: "administrativo",
  },
  {
    title: "Mis Pedidos",
    key: "trazabilidad",
    icon: Route,
    iconColor: "text-icon-magenta",
  },
  // Resumen Dia y Reporte de Incidencias se ubican aqui (justo despues
  // de Mis Pedidos) para dar acceso rapido a las vistas analiticas /
  // transversales antes de los modulos operativos por area.
  {
    title: "Resumen Dia",
    key: "resumendia",
    icon: CalendarCheck2,
    iconColor: "text-icon-teal",
    group: "administrativo",
  },
  {
    title: "Plan Semanal",
    key: "plansemanal",
    icon: CalendarRange,
    iconColor: "text-icon-cyan",
    group: "administrativo",
  },
  {
    title: "Reporte de Incidencias",
    key: "incidencias",
    icon: AlertOctagon,
    // Color rosa coherente con el lenguaje visual de incidencias en los
    // demas modulos (badges rojos del IncidenciasTab por area).
    iconColor: "text-rose-500",
    group: "administrativo",
  },
  {
    title: "Indicadores",
    key: "indicadores",
    icon: BarChart3,
    iconColor: "text-icon-green",
    group: "administrativo",
  },
  {
    title: "Programacion de ordenes",
    key: "programacion",
    icon: CalendarDays,
    iconColor: "text-icon-magenta",
  },
  {
    title: "Diseno",
    key: "diseno",
    icon: Palette,
    iconColor: "text-icon-yellow",
  },
  {
    title: "Gestion de Disenos",
    key: "gestion-disenos",
    icon: Brush,
    iconColor: "text-indigo-400",
  },
  {
    title: "Corte",
    key: "corte",
    icon: Scissors,
    iconColor: "text-icon-green",
  },
  {
    title: "Impresion",
    key: "impresion",
    icon: Printer,
    iconColor: "text-icon-cyan",
  },
  {
    title: "Sublimacion",
    key: "sublimacion",
    icon: Flame,
    iconColor: "text-icon-coral",
  },
  {
    title: "Costura",
    key: "costura",
    icon: Shirt,
    iconColor: "text-icon-purple",
  },
  {
    title: "Empaque",
    key: "empaque",
    icon: PackageCheck,
    iconColor: "text-icon-teal",
  },
  {
    title: "Entregas",
    key: "entregas",
    icon: Truck,
    iconColor: "text-icon-magenta",
  },
  {
    title: "Inventario de Telas",
    key: "inventario",
    icon: Layers,
    iconColor: "text-icon-teal",
    group: "administrativo",
  },
  {
    title: "Configuración",
    key: "configuracion",
    icon: Settings,
    iconColor: "text-slate-400",
    group: "administrativo",
  },
  {
    title: "Asistente IA",
    key: "asistente-ia",
    icon: Sparkles,
    iconColor: "text-icon-purple",
    group: "administrativo",
  },
  {
    title: "Mensajería",
    key: "comunicaciones",
    icon: MessageSquare,
    iconColor: "text-icon-cyan",
    group: "comunicaciones",
  },
  {
    title: "Tareas",
    key: "com-tareas",
    icon: ClipboardList,
    iconColor: "text-icon-green",
    group: "comunicaciones",
  },
  {
    title: "Noticias",
    key: "com-noticias",
    icon: Newspaper,
    iconColor: "text-icon-magenta",
    group: "comunicaciones",
  },
]

function AuthSidebarFooter() {
  const { usuarioActual, logout } = useAuth()
  const [perfilOpen, setPerfilOpen] = useState(false)
  const displayName =
    (usuarioActual?.nombre as string) ||
    (usuarioActual?.usuario as string) ||
    (usuarioActual?.email
      ? String(usuarioActual.email).split("@")[0]
      : "Invitado")
  const emailLabel = (usuarioActual?.email as string) || ""

  return (
    <>
      <SidebarMenuItem>
        <button
          onClick={() => setPerfilOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-white/80 hover:bg-white/10"
          title="Mi perfil"
        >
          <UserAvatar
            nombre={displayName}
            email={emailLabel}
            fotoUrl={usuarioActual?.foto_url as string | undefined}
            className="size-7"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium capitalize text-white">
              {displayName}
            </p>
            {emailLabel && (
              <p className="truncate text-[10px] text-white/50">
                {emailLabel}
              </p>
            )}
          </div>
        </button>
      </SidebarMenuItem>
      <PerfilModal open={perfilOpen} onOpenChange={setPerfilOpen} />
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={logout}
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          <LogOut className="size-4 text-white/60" />
          <span>Cerrar sesion</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

// Normaliza texto para búsqueda: minúsculas + sin acentos/diacríticos.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  const { usuarioActual } = useAuth()
  const { solicitudes } = useGD()
  const { unreadTotal, noticiasPendientes } = useComunicaciones()

  // Solicitudes activas (ni Finalizado ni Rechazado) — alimentan el badge.
  const gdBadgeCount = solicitudes.filter(
    (s) => s.estado_turno !== "Finalizado" && s.estado !== "Rechazado"
  ).length

  // Solo mostrar los items de menu que el usuario tiene permiso para ver.
  const allowedItems = menuItems.filter((item) =>
    canViewForUser(usuarioActual, item.key)
  )
  // Definición de los grandes grupos del sidebar (en orden de aparición).
  // Cada item sin `group` explícito se considera "operaciones".
  const GRUPOS: { key: "administrativo" | "operaciones" | "comunicaciones"; label: string }[] = [
    { key: "administrativo", label: "Administrativo" },
    { key: "operaciones", label: "Operaciones" },
    { key: "comunicaciones", label: "Comunicaciones Internas" },
  ]
  // Buscador de módulos. Cuando hay texto, filtra por título (sin acentos) y
  // fuerza a que todos los grupos se muestren expandidos.
  const [filtro, setFiltro] = useState("")
  const filtroNorm = normalizar(filtro)
  const buscando = filtroNorm.length > 0

  const itemsDeGrupo = (g: string) =>
    allowedItems.filter(
      (i) =>
        (i.group ?? "operaciones") === g &&
        (!buscando || normalizar(i.title).includes(filtroNorm))
    )
  const totalCoincidencias = allowedItems.filter(
    (i) => !buscando || normalizar(i.title).includes(filtroNorm)
  ).length

  // Estado de expandido/colapsado por grupo (todos abiertos por defecto).
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({
    administrativo: true,
    operaciones: true,
    comunicaciones: true,
  })
  const toggleGrupo = (key: string) =>
    setGruposAbiertos((prev) => ({ ...prev, [key]: !prev[key] }))

  const badgeDe = (key: ActiveView): number => {
    if (key === "gestion-disenos") return gdBadgeCount
    if (key === "comunicaciones") return unreadTotal
    if (key === "com-noticias") return noticiasPendientes
    return 0
  }

  const renderItem = (item: (typeof menuItems)[number]) => {
    const badge = badgeDe(item.key)
    return (
      <SidebarMenuItem key={item.key}>
        <SidebarMenuButton
          isActive={activeView === item.key}
          onClick={() => onViewChange(item.key)}
          className="text-white/80 hover:text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white"
        >
          <item.icon className={`size-4 ${item.iconColor}`} />
          <span className="flex-1">{item.title}</span>
          {badge > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold leading-none text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-white/10 p-2">
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/90 backdrop-blur-md"
          style={{
            boxShadow:
              "0 10px 30px -10px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
            style={{
              background:
                "radial-gradient(120% 120% at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0) 80%)",
            }}
          />
          <img
            src="/images/telas-creativas-logo.png"
            alt="Telas Creativas"
            className="relative block h-10 w-auto object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Buscador de módulos */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar módulo..."
              aria-label="Buscar módulo"
              className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-7 pr-2 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/30 focus:bg-white/10"
            />
          </div>
        </div>

        {buscando && totalCoincidencias === 0 && (
          <p className="px-4 py-2 text-xs text-white/40">
            Sin módulos que coincidan con “{filtro}”.
          </p>
        )}

        {GRUPOS.map((grupo) => {
          const items = itemsDeGrupo(grupo.key)
          if (items.length === 0) return null
          // Al buscar, todos los grupos con coincidencias se muestran abiertos.
          const abierto = buscando ? true : gruposAbiertos[grupo.key] ?? true
          // Suma de badges del grupo — se muestra junto al título cuando está
          // colapsado, para no perder de vista mensajes/pendientes.
          const grupoBadge = items.reduce((acc, it) => acc + badgeDe(it.key), 0)
          return (
            <SidebarGroup key={grupo.key}>
              <SidebarGroupLabel
                asChild
                className="text-white/50 hover:text-white/80"
              >
                <button
                  type="button"
                  onClick={() => toggleGrupo(grupo.key)}
                  className="flex w-full items-center gap-1"
                  aria-expanded={abierto}
                >
                  <ChevronDown
                    className={`size-3.5 shrink-0 transition-transform duration-200 ${
                      abierto ? "" : "-rotate-90"
                    }`}
                  />
                  <span className="flex-1 text-left">{grupo.label}</span>
                  {!abierto && grupoBadge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold leading-none text-white">
                      {grupoBadge > 99 ? "99+" : grupoBadge}
                    </span>
                  )}
                </button>
              </SidebarGroupLabel>
              {/* Contenedor animado: grid-rows 0fr↔1fr para una transición
                  suave de alto (colapso/expansión) + fade. */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  abierto
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <SidebarGroupContent>
                    <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10">
        <SidebarMenu>
          <AuthSidebarFooter />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
