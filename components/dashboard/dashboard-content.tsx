"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context"
import { DashboardHero } from "./dashboard-hero"
import { DashboardKpis } from "./dashboard-kpis"
import { DashboardPipeline } from "./dashboard-pipeline"
import { DashboardWorkloadChart } from "./dashboard-workload-chart"
import { DashboardEfficiencyChart } from "./dashboard-efficiency-chart"
import { DashboardRiskRadar } from "./dashboard-risk-radar"
import { DashboardTrackingTable } from "./dashboard-tracking-table"

function DashboardInner() {
  const { error } = useDashboard()

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar los datos</AlertTitle>
          <AlertDescription className="text-xs">
            {error} - Verifica que la vista{" "}
            <code className="font-mono">telas.vista_control_produccion</code>{" "}
            existe y es accesible.
          </AlertDescription>
        </Alert>
      )}

      {/* 1) HERO - Dark command center banner with live pulse + health gauge */}
      <DashboardHero />

      {/* 2) KPIs - 4 cards with accent stripes */}
      <DashboardKpis />

      {/* 3) Pipeline - Horizontal flow of 6 production stages with bottleneck */}
      <DashboardPipeline />

      {/* 4) Charts + Risk radar - Bento 3 cols */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-3 md:grid-cols-2">
          <DashboardWorkloadChart />
          <DashboardEfficiencyChart />
        </div>
        <div className="lg:col-span-1">
          <DashboardRiskRadar />
        </div>
      </div>

      {/* 5) Master tracking table */}
      <DashboardTrackingTable />
    </div>
  )
}

export function DashboardContent() {
  return (
    <DashboardProvider>
      <DashboardInner />
    </DashboardProvider>
  )
}
