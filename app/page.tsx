"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar, type ActiveView } from "@/components/app-sidebar"
import { AuthProvider, useAuth, canViewForUser } from "@/lib/auth-context"
import { LoginScreen } from "@/components/auth/login-screen"
import { OrdersProvider } from "@/lib/orders-context"
import { DesignProvider } from "@/lib/design-context"
import { CutProvider } from "@/lib/cut-context"
import { PrintProvider } from "@/lib/print-context"
import { SublimationProvider } from "@/lib/sublimation-context"
import { CosturaProvider } from "@/lib/costura-context"
import { EmpaqueProvider } from "@/lib/empaque-context"
import { EntregasProvider } from "@/lib/entregas-context"
import { TrazabilidadProvider } from "@/lib/trazabilidad-context"
import { AppNavigationProvider } from "@/lib/app-navigation"
import { OrdersContent } from "@/components/orders/orders-content"
import { DesignContent } from "@/components/design/design-content"
import { CutContent } from "@/components/cut/cut-content"
import { PrintContent } from "@/components/print/print-content"
import { SublimationContent } from "@/components/sublimation/sublimation-content"
import { CosturaContent } from "@/components/costura/costura-content"
import { EmpaqueContent } from "@/components/empaque/empaque-content"
import { EntregasContent } from "@/components/entregas/entregas-content"
import { TrazabilidadContent } from "@/components/trazabilidad/trazabilidad-content"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { ResumenDiaContent } from "@/components/resumen-dia/resumen-dia-content"
import { IncidenciasReporteContent } from "@/components/incidencias-reporte/incidencias-reporte-content"
import { InventarioTelasContent } from "@/components/inventario/inventario-telas-content"
import { PlanSemanalContent } from "@/components/plan-semanal/plan-semanal-content"
import { IndicadoresContent } from "@/components/indicadores/indicadores-content"
import { GDContent } from "@/components/gestion-disenos/gd-content"
import { GestionDisenosProvider } from "@/lib/gestion-disenos-context"
import { Separator } from "@/components/ui/separator"
import { ShieldOff } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

const viewTitles: Record<ActiveView, string> = {
  dashboard: "Dashboard",
  programacion: "Programacion de Ordenes",
  diseno: "Diseno",
  corte: "Corte",
  impresion: "Impresion",
  sublimacion: "Sublimacion",
  costura: "Costura",
  empaque: "Empaque",
  entregas: "Entregas",
  trazabilidad: "Mis Pedidos",
  resumendia: "Resumen Dia",
  plansemanal: "Plan Semanal",
  incidencias: "Reporte de Incidencias",
  indicadores: "Dashboard de Indicadores",
  ordenes: "Ordenes",
  produccion: "Produccion",
  clientes: "Clientes",
  inventario: "Inventario de Telas",
  "gestion-disenos": "Gestion de Disenos",
}

/**
 * MainApp is the authenticated shell. It is only rendered after auth succeeds,
 * which keeps all the data-providers out of the login path (no useless fetches
 * to Supabase while the user is still unauthenticated).
 */
// Views rendered in sidebar order. Used to find the first accessible one.
const ORDERED_VIEWS: ActiveView[] = [
  "dashboard",
  "trazabilidad",
  "programacion",
  "diseno",
  "corte",
  "impresion",
  "sublimacion",
  "costura",
  "empaque",
  "entregas",
  "resumendia",
  "incidencias",
  "indicadores",
]

function MainApp() {
  const { usuarioActual } = useAuth()

  // Pick the first view the current user is actually allowed to see so the app
  // never opens on a blank / forbidden screen after login.
  const defaultView = useMemo<ActiveView>(() => {
    for (const v of ORDERED_VIEWS) {
      if (canViewForUser(usuarioActual, v)) return v
    }
    return "dashboard"
  }, [usuarioActual])

  const [activeView, setActiveView] = useState<ActiveView>(defaultView)

  const renderContent = () => {
    // Hard guard: even if someone sets activeView programmatically, they can
    // only see a module they have been granted access to.
    if (!canViewForUser(usuarioActual, activeView)) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
          <ShieldOff className="size-10 text-slate-300" />
          <p className="text-base font-medium text-slate-500">
            No tienes permiso para acceder a este modulo.
          </p>
          <p className="text-sm text-slate-400">
            Contacta al administrador si crees que esto es un error.
          </p>
        </div>
      )
    }

    switch (activeView) {
      case "dashboard":
        return <DashboardContent />
      case "programacion":
        return <OrdersContent />
      case "diseno":
        return <DesignContent />
      case "corte":
        return <CutContent />
      case "impresion":
        return <PrintContent />
      case "sublimacion":
        return <SublimationContent />
      case "costura":
        return <CosturaContent />
      case "empaque":
        return <EmpaqueContent />
      case "entregas":
        return <EntregasContent />
      case "trazabilidad":
        return <TrazabilidadContent />
      case "resumendia":
        return <ResumenDiaContent />
      case "incidencias":
        return <IncidenciasReporteContent />
      case "inventario":
        return <InventarioTelasContent />
      case "plansemanal":
        return <PlanSemanalContent />
      case "indicadores":
        return <IndicadoresContent />
      case "gestion-disenos":
        return <GDContent />
      default:
        return (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            El modulo &quot;{viewTitles[activeView]}&quot; estara disponible
            proximamente.
          </div>
        )
    }
  }

  return (
    <GestionDisenosProvider>
    <OrdersProvider>
      <DesignProvider>
        <CutProvider>
          <PrintProvider>
            <SublimationProvider>
              <CosturaProvider>
                <EmpaqueProvider>
                  <EntregasProvider>
                    <TrazabilidadProvider>
                      <AppNavigationProvider setActiveView={setActiveView}>
                        <SidebarProvider>
          <AppSidebar activeView={activeView} onViewChange={setActiveView} />
          <SidebarInset className="content-cmyk-gradient">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/5 px-4 bg-white/30 backdrop-blur-sm">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>{viewTitles[activeView]}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <main className="flex-1 p-4 md:p-6">{renderContent()}</main>
                        </SidebarInset>
                        </SidebarProvider>
                      </AppNavigationProvider>
                    </TrazabilidadProvider>
                  </EntregasProvider>
                </EmpaqueProvider>
              </CosturaProvider>
            </SublimationProvider>
          </PrintProvider>
        </CutProvider>
      </DesignProvider>
    </OrdersProvider>
    </GestionDisenosProvider>
  )
}

/**
 * Gate that decides between LoginScreen and MainApp based on auth state.
 * While the auth context is hydrating from localStorage we render a neutral
 * dark background to avoid the login screen flashing for already-logged users.
 */
function AuthGate() {
  const { usuarioActual, isHydrated } = useAuth()

  if (!isHydrated) {
    return (
      <div
        aria-hidden
        className="min-h-screen w-full bg-[#0a0f1c]"
      />
    )
  }

  return (
    <AnimatePresence mode="wait">
      {!usuarioActual ? (
        <motion.div
          key="login"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <LoginScreen />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <MainApp />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
