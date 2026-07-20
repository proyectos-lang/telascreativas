"use client"

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
} from "lucide-react"
import { useAuth, canViewForUser } from "@/lib/auth-context"
import { useGD } from "@/lib/gestion-disenos-context"

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

interface AppSidebarProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
}

const menuItems: {
  title: string
  key: ActiveView
  icon: React.ElementType
  iconColor: string
}[] = [
  {
    title: "Dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    iconColor: "text-icon-cyan",
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
  },
  {
    title: "Plan Semanal",
    key: "plansemanal",
    icon: CalendarRange,
    iconColor: "text-icon-cyan",
  },
  {
    title: "Reporte de Incidencias",
    key: "incidencias",
    icon: AlertOctagon,
    // Color rosa coherente con el lenguaje visual de incidencias en los
    // demas modulos (badges rojos del IncidenciasTab por area).
    iconColor: "text-rose-500",
  },
  {
    title: "Indicadores",
    key: "indicadores",
    icon: BarChart3,
    iconColor: "text-icon-green",
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
  },
]

function AuthSidebarFooter() {
  const { usuarioActual, logout } = useAuth()
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
        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-white/80">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10">
            <User className="size-3.5 text-white/80" />
          </div>
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
        </div>
      </SidebarMenuItem>
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

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  const { usuarioActual } = useAuth()
  const { solicitudes } = useGD()

  // Solicitudes activas (ni Finalizado ni Rechazado) — alimentan el badge.
  const gdBadgeCount = solicitudes.filter(
    (s) => s.estado_turno !== "Finalizado" && s.estado !== "Rechazado"
  ).length

  // Solo mostrar los items de menu que el usuario tiene permiso para ver.
  const allowedItems = menuItems.filter((item) =>
    canViewForUser(usuarioActual, item.key)
  )

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
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allowedItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={activeView === item.key}
                    onClick={() => onViewChange(item.key)}
                    className="text-white/80 hover:text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white"
                  >
                    <item.icon className={`size-4 ${item.iconColor}`} />
                    <span className="flex-1">{item.title}</span>
                    {item.key === "gestion-disenos" && gdBadgeCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold leading-none text-white">
                        {gdBadgeCount > 99 ? "99+" : gdBadgeCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10">
        <SidebarMenu>
          <AuthSidebarFooter />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
