"use client"

import { useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IncidenciasTab } from "./incidencias-tab"
import type { Area } from "./modal-reporte-incidencia"
import { AlertOctagon, CalendarDays, ClipboardList } from "lucide-react"

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
}: ModuleTabsProps) {
  const [pendingCount, setPendingCount] = useState(0)

  const colCount = resumenContent ? 3 : 2

  return (
    <Tabs defaultValue="ordenes" className="w-full">
      <TabsList
        className={`grid w-full grid-cols-${colCount} sm:inline-flex sm:w-auto`}
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
