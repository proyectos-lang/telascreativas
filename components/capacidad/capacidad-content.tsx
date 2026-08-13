"use client"

/**
 * Módulo "Capacidad" — shell con pestañas.
 *
 * Sistema integral de análisis de capacidad en planta:
 *  - Semanas: carga programada por semana vs capacidad + ocupación por máquina.
 *  - Disponibilidad (ATP): heatmap área × día, cuello de botella.
 *  - Simulador: fecha de entrega por etapas según la matriz de tiempos.
 *  - Capacidad real: calibración histórica (P50/P85/P95) vs parámetros.
 *  - Parámetros: capacidad por área, excepciones, matriz y máquinas (admin).
 *
 * Requiere ejecutar scripts/capacidad-motor.sql en Supabase (tablas del motor).
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CapacidadSemanas } from "./capacidad-semanas"
import { CapacidadATP } from "./capacidad-atp"
import { CapacidadSimulador } from "./capacidad-simulador"
import { CapacidadReal } from "./capacidad-real"
import { CapacidadParametros } from "./capacidad-parametros"

export function CapacidadContent() {
  return (
    <Tabs defaultValue="semanas" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="semanas">Semanas</TabsTrigger>
        <TabsTrigger value="atp">Disponibilidad (ATP)</TabsTrigger>
        <TabsTrigger value="simulador">Simulador</TabsTrigger>
        <TabsTrigger value="real">Capacidad real</TabsTrigger>
        <TabsTrigger value="parametros">Parámetros</TabsTrigger>
      </TabsList>

      <TabsContent value="semanas" className="mt-4">
        <CapacidadSemanas />
      </TabsContent>
      <TabsContent value="atp" className="mt-4">
        <CapacidadATP />
      </TabsContent>
      <TabsContent value="simulador" className="mt-4">
        <CapacidadSimulador />
      </TabsContent>
      <TabsContent value="real" className="mt-4">
        <CapacidadReal />
      </TabsContent>
      <TabsContent value="parametros" className="mt-4">
        <CapacidadParametros />
      </TabsContent>
    </Tabs>
  )
}
