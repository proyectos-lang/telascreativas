"use client"

/**
 * Plan Semanal — shell con pestañas.
 *
 *  - Global: el plan por fecha de entrega al cliente (vista original).
 *  - Un plan por proceso (Diseño, Impresión, Corte, Sublimación, Costura),
 *    organizado por la FECHA OBJETIVO de cada área: lo que ese proceso debe
 *    terminar en la semana.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlanSemanalGlobal } from "./plan-semanal-global"
import { PlanSemanalArea, AREAS_PLAN } from "./plan-semanal-area"

export function PlanSemanalContent() {
  return (
    <Tabs defaultValue="global" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="global">Global</TabsTrigger>
        {AREAS_PLAN.map((a) => (
          <TabsTrigger key={a.key} value={a.key}>
            {a.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="global" className="mt-4">
        <PlanSemanalGlobal />
      </TabsContent>
      {AREAS_PLAN.map((a) => (
        <TabsContent key={a.key} value={a.key} className="mt-4">
          <PlanSemanalArea area={a} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
