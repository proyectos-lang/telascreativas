"use client"

/**
 * IncidenciasReporteContent
 * --------------------------------------------------------------------------
 * Modulo "Reporte de Incidencias" — punto de entrada renderizado por
 * `app/page.tsx` cuando el usuario navega a la vista `incidencias`.
 *
 * Capa de seguridad (defensa en profundidad):
 *   1. El sidebar solo muestra el item si `reporte_incidencias = true`
 *      (filtrado en `AppSidebar` via canViewForUser).
 *   2. `app/page.tsx` ya tiene un guard generico que redirige a un
 *      "no tienes permiso" si el usuario fuerza la vista programaticamente.
 *   3. Aqui igual reaplicamos un guard explicito de `reporte_incidencias`
 *      con un mensaje contextual "Acceso denegado" mas amigable que el
 *      generico, y aprovechamos para detectar ausencia de sesion.
 *
 * El rol "Planner" (`cargo === "Planner"`) NO bloquea la vista; solo
 * habilita las acciones de edicion (boton Procesar). El resto del
 * personal autorizado puede consultar el dashboard en modo solo-lectura.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertOctagon, ShieldOff, ShieldCheck, Lock } from "lucide-react"
import { useAuth, isPlanner } from "@/lib/auth-context"
import {
  IncidenciasReporteProvider,
  useIncidenciasReporte,
} from "@/lib/incidencias-reporte-context"
import { IncidenciasKpis } from "./incidencias-kpis"
import { IncidenciasBarChart } from "./incidencias-bar-chart"
import { IncidenciasLineChart } from "./incidencias-line-chart"
import { IncidenciasPieCharts } from "./incidencias-pie-charts"
import { IncidenciasFilters } from "./incidencias-filters"
import { IncidenciasTable } from "./incidencias-table"

/**
 * Pantalla de "Acceso Denegado". Se muestra cuando el usuario esta
 * autenticado pero la columna `reporte_incidencias` no esta habilitada
 * para el. Se evita exponer detalles tecnicos (no decimos "RLS" ni
 * "columna X"); solo invitamos a contactar al admin.
 */
function AccessDenied() {
  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="size-14 rounded-full bg-rose-100 flex items-center justify-center">
          <ShieldOff className="size-7 text-rose-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Acceso denegado
        </h2>
        <p className="max-w-md text-sm text-muted-foreground text-balance">
          No tienes permisos para consultar el{" "}
          <strong className="text-foreground">Reporte de Incidencias</strong>.
          Si crees que deberias tener acceso, contacta al administrador para
          que habilite el permiso correspondiente en tu cuenta.
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Cabecera con titulo, subtitulo y badge de modo (Solo lectura / Planner).
 * El badge ayuda al usuario a entender de un vistazo que puede o no hacer.
 */
function ReporteHeader({ canEdit }: { canEdit: boolean }) {
  const { filteredIncidencias, incidencias, isLoading } =
    useIncidenciasReporte()

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        <div className="size-12 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm shrink-0">
          <AlertOctagon className="size-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Reporte de Incidencias
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Indicadores, tendencias y gestion centralizada de incidencias y
            reposiciones a nivel de toda la operacion.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {!isLoading && (
          <Badge
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 text-xs"
          >
            <span className="font-semibold mr-1">
              {filteredIncidencias.length}
            </span>
            de {incidencias.length} incidencias
          </Badge>
        )}
        {canEdit ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <ShieldCheck className="mr-1 size-3" />
            Modo Planner
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-slate-50 border-slate-200 text-slate-700 text-xs"
          >
            <Lock className="mr-1 size-3" />
            Solo lectura
          </Badge>
        )}
      </div>
    </div>
  )
}

function ReporteInner({ canEdit }: { canEdit: boolean }) {
  const { error } = useIncidenciasReporte()

  return (
    <div className="space-y-4">
      <ReporteHeader canEdit={canEdit} />

      {error && (
        <Alert variant="destructive">
          <AlertOctagon className="size-4" />
          <AlertTitle>No se pudieron cargar las incidencias</AlertTitle>
          <AlertDescription className="text-xs">
            {error} — Verifica conectividad y que la tabla{" "}
            <code className="font-mono">telas.incidencias</code> sea accesible.
          </AlertDescription>
        </Alert>
      )}

      <IncidenciasKpis />

      <IncidenciasFilters />

      {/* Charts: tendencia historica primero (full width) para tener
          contexto temporal, luego barras por area y finalmente las dos
          donas (parte / estado). Layout compacto con menores alturas
          para que toda la informacion clave entre con minimo scroll. */}
      <IncidenciasLineChart />
      <IncidenciasBarChart />
      <IncidenciasPieCharts />

      <IncidenciasTable />
    </div>
  )
}

export function IncidenciasReporteContent() {
  const { usuarioActual } = useAuth()

  // Guard explicito por columna `reporte_incidencias`. Hacemos esta
  // verificacion antes de montar el provider para no disparar la query
  // a Supabase si el usuario no tiene permiso.
  const hasAccess = usuarioActual?.reporte_incidencias === true
  if (!hasAccess) {
    return <AccessDenied />
  }

  const canEdit = isPlanner(usuarioActual)

  return (
    <IncidenciasReporteProvider>
      <ReporteInner canEdit={canEdit} />
    </IncidenciasReporteProvider>
  )
}
