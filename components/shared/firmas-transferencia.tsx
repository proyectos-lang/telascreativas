"use client"

import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PenLine, ExternalLink } from "lucide-react"

/**
 * Una firma capturada en la transferencia entre dos procesos.
 * - `label`: texto descriptivo, ej. "Recibido por Costura".
 * - `url`: URL publica del PNG en el bucket `firmas-procesos`.
 *   Si esta vacio/undefined, el item se omite del render.
 */
export interface FirmaTransferenciaItem {
  label: string
  url?: string | null
}

interface FirmasTransferenciaProps {
  /** Lista de firmas a mostrar. Las que no tengan url se ignoran. */
  firmas: FirmaTransferenciaItem[]
  /** Titulo opcional de la card. Default: "Firmas de Transferencia". */
  title?: string
}

/**
 * Card que renderiza las firmas de transferencia entre procesos
 * productivos (ej. Sublimacion -> Costura). Cada firma se muestra como
 * una imagen sobre fondo blanco con un label y un enlace para abrirla en
 * una pestaña nueva. Si no hay firmas con URL, el componente no renderiza
 * nada para no generar ruido visual en el detalle.
 */
export function FirmasTransferencia({
  firmas,
  title = "Firmas de Transferencia",
}: FirmasTransferenciaProps) {
  // Filtramos solo las firmas con URL valida; si no queda ninguna, no
  // pintamos la card.
  const visibles = firmas.filter(
    (f) => typeof f.url === "string" && f.url.trim().length > 0
  )
  if (visibles.length === 0) return null

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="size-4 text-icon-magenta" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((firma) => (
            <div
              key={firma.label}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  {firma.label}
                </p>
                <a
                  href={firma.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] inline-flex items-center gap-1 text-icon-magenta hover:underline"
                  title="Abrir firma en pestaña nueva"
                >
                  Ver
                  <ExternalLink className="size-3" />
                </a>
              </div>
              {/*
                Usamos <Image unoptimized /> para evitar el cache global de
                imagenes de Next y porque la url es de Supabase Storage.
                El alt es descriptivo para accesibilidad (lectores de
                pantalla anuncian el contexto de la firma).
              */}
              <div className="relative aspect-[3/1] w-full overflow-hidden rounded border border-slate-100 bg-white">
                <Image
                  src={firma.url as string}
                  alt={`Firma: ${firma.label}`}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
