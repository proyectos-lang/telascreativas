"use client"

import { useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IncidenciasTab } from "./incidencias-tab"
import type { Area } from "./modal-reporte-incidencia"
import {
  AlertOctagon,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  type LucideIcon,
} from "lucide-react"
import { PlanSemanalArea, AREAS_PLAN } from "@/components/plan-semanal/plan-semanal-area"

interface ModuleTabsProps {
  /** Nombre del area productiva (Diseno, Corte, Impresion, etc.) */
  area: Area
  /**
   * Contenido de la pestana "Ordenes Activas" (la tabla de pedidos principal
   * del modulo + sus filtros y mensajes de estado).
   */
  ordenesContent: ReactNode
  /**
   * Contenido de la pestana "Resumen del Dia". Si no se pasa, el tab
   * no se renderiza (retrocompatibilidad).
   */
  resumenContent?: ReactNode
  /** Clase de acento para iconos del modulo */
  accentClass?: string
  /**
   * Pestana adicional propia del modulo, antes de Incidencias. La usa
   * Marker Digital para la agrupacion de cores; el resto de los modulos no
   * la pasa y el comportamiento no cambia.
   */
  extraTab?: {
    value: string
    label: string
    icon: LucideIcon
    content: ReactNode
  }
  /** Pestanas adicionales, ademas de `extraTab`. */
  extraTabs?: {
    value: string
    label: string
    icon: LucideIcon
    content: ReactNode
  }[]
}

/**
 * Mapea el area del modulo a su plan semanal. Empaque y Entregas no tienen
 * plan por proceso (no estan en AREAS_PLAN), asi que esa pestana no aparece.
 */
function planDeArea(area: Area) {
  const key = area
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
  return AREAS_PLAN.find((a) => a.key === key) ?? null
}

/**
 * Sistema de pestanas comun para los modulos de produccion.
 * Tab 1: "Ordenes Activas" (se recibe por children-equivalent)
 * Tab 2: "Reposiciones e Incidencias" con badge rojo cuando hay reposiciones
 *        en estado Pendiente sobre el area actual.
 *
 * El conteo pendiente vive aqui para que el badge pueda renderizarse en el
 * TabsTrigger sin forzar al consumidor a duplicar la logica.
 */
export function ModuleTabs({
  area,
  ordenesContent,
  resumenContent,
  accentClass,
  extraTab,
  extraTabs,
}: ModuleTabsProps) {
  const [pendingCount, setPendingCount] = useState(0)

  // Plan semanal propio del area (si aplica).
  const planArea = planDeArea(area)

  // Todas las pestanas adicionales en una sola lista, para no duplicar el
  // renderizado ni el conteo de columnas.
  const extras = [...(extraTab ? [extraTab] : []), ...(extraTabs ?? [])]
  const colCount =
    (resumenContent ? 3 : 2) + (planArea ? 1 : 0) + extras.length

  return (
    <Tabs defaultValue="ordenes" className="w-full">
      {/* Clases explicitas: Tailwind no genera `grid-cols-${n}` dinamico. */}
      <TabsList
        className={[
          "grid w-full sm:inline-flex sm:w-auto",
          colCount >= 6
            ? "grid-cols-6"
            : colCount === 5
            ? "grid-cols-5"
            : colCount === 4
            ? "grid-cols-4"
            : colCount === 3
            ? "grid-cols-3"
            : "grid-cols-2",
        ].join(" ")}
      >
        <TabsTrigger value="ordenes" className="gap-2">
          <ClipboardList className="size-4" />
          Ordenes Activas
        </TabsTrigger>
        {resumenContent && (
          <TabsTrigger value="resumen" className="gap-2">
            <CalendarDays className="size-4" />
            Resumen del Dia
          </TabsTrigger>
        )}
        {planArea && (
          <TabsTrigger value="plan" className="gap-2">
            <CalendarRange className="size-4" />
            Plan Semanal
          </TabsTrigger>
        )}
        {extras.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="gap-2">
            <t.icon className="size-4" />
            {t.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="incidencias" className="gap-2">
          <AlertOctagon className="size-4" />
          <span>Reposiciones e Incidencias</span>
          {pendingCount > 0 && (
            <Badge className="ml-1 bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0 text-[10px]">
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ordenes" className="mt-4 space-y-4">
        {ordenesContent}
      </TabsContent>

      {resumenContent && (
        <TabsContent value="resumen" className="mt-4">
          {resumenContent}
        </TabsContent>
      )}

      {planArea && (
        <TabsContent value="plan" className="mt-4">
          <PlanSemanalArea area={planArea} />
        </TabsContent>
      )}

      {extras.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          {t.content}
        </TabsContent>
      ))}

      <TabsContent value="incidencias" className="mt-4">
        <IncidenciasTab
          area={area}
          onPendingCountChange={setPendingCount}
          accentClass={accentClass}
        />
      </TabsContent>
    </Tabs>
  )
}
