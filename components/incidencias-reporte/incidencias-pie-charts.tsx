"use client"

/**
 * IncidenciasPieCharts
 * --------------------------------------------------------------------------
 * Dos donas lado a lado:
 *   - Distribucion por parte a reponer (`partes_reposicion`, splitea CSV
 *     y cuenta cada parte como una unidad).
 *   - Distribucion por estado_reposicion (Pendiente / Procesado / Otro).
 *
 * Las dos series solo consideran incidencias con `genera_reposicion =
 * true`, lo cual mantiene el foco en trabajo real de reposicion.
 *
 * Diseno compacto: alturas reducidas y leyenda inline para minimizar
 * scroll vertical en el dashboard.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Cell, Pie, PieChart, Legend } from "recharts"
import { Layers, ListChecks } from "lucide-react"
import { useIncidenciasReporte } from "@/lib/incidencias-reporte-context"

// Paleta para "Partes": rotacion neutra cohesiva con el resto del modulo.
const PALETTE_PARTES = [
  "#e11d48", // rose-600
  "#f59e0b", // amber-500
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#64748b", // slate-500
  "#0d9488", // teal-600
]
const OTHERS_COLOR = "#cbd5e1" // slate-300

// Colores semanticos para "Estado": ambar = pendiente, verde = procesado.
// La lectura es inmediata sin tener que mirar la leyenda.
const COLOR_ESTADO: Record<string, string> = {
  Pendiente: "#f59e0b",
  Procesado: "#10b981",
  Otro: "#94a3b8",
}

const baseConfig: ChartConfig = {
  value: { label: "Incidencias" },
}

interface DonutCardProps {
  title: string
  description: string
  data: { name: string; value: number }[]
  icon: React.ReactNode
  isLoading: boolean
  /** Cuantas categorias mostrar antes de agrupar como "Otros". */
  topN?: number
  /** Resolver de color por categoria; permite paleta semantica. */
  colorFor: (name: string, idx: number) => string
}

function DonutCard({
  title,
  description,
  data,
  icon,
  isLoading,
  topN = 6,
  colorFor,
}: DonutCardProps) {
  // Top N + agrupado para no saturar el chart cuando hay demasiadas
  // categorias (caso "Por Parte a Reponer" con cuello+mangas+...).
  const limited = (() => {
    if (data.length <= topN) return data
    const head = data.slice(0, topN)
    const tail = data.slice(topN)
    const otrosValue = tail.reduce((sum, d) => sum + d.value, 0)
    return otrosValue > 0
      ? [...head, { name: "Otros", value: otrosValue }]
      : head
  })()

  const total = limited.reduce((s, d) => s + d.value, 0)

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-rose-100 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : total === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground italic">
            Sin reposiciones en el periodo seleccionado.
          </div>
        ) : (
          <ChartContainer config={baseConfig} className="h-[180px] w-full">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Pie
                data={limited}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={70}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {limited.map((entry, idx) => {
                  const color =
                    entry.name === "Otros"
                      ? OTHERS_COLOR
                      : colorFor(entry.name, idx)
                  return <Cell key={`cell-${idx}`} fill={color} />
                })}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ fontSize: 10 }}
                iconType="circle"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function IncidenciasPieCharts() {
  const { porPartesReposicion, porEstadoReposicion, isLoading } =
    useIncidenciasReporte()

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DonutCard
        title="Por Parte a Reponer"
        description="Top 6 partes (con reposicion)"
        data={porPartesReposicion}
        icon={<Layers className="size-3.5 text-rose-600" />}
        isLoading={isLoading}
        colorFor={(_name, idx) =>
          PALETTE_PARTES[idx % PALETTE_PARTES.length]
        }
      />
      <DonutCard
        title="Por Estado de Reposicion"
        description="Pendiente vs Procesado"
        data={porEstadoReposicion}
        icon={<ListChecks className="size-3.5 text-rose-600" />}
        isLoading={isLoading}
        colorFor={(name) => COLOR_ESTADO[name] ?? "#94a3b8"}
      />
    </div>
  )
}
