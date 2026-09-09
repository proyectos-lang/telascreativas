"use client"

/**
 * Diseños guardados del usuario.
 *
 * Cada tarjeta muestra el render que se capturó al guardar, para poder
 * reconocer un diseño sin abrirlo. Al abrir se carga el documento
 * completo y el editor queda exactamente como se dejó.
 */

import { FolderOpen, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useEstudio3D } from "@/lib/estudio-3d-context"
import type { DisenoEstudio } from "@/lib/estudio-3d/tipos"

interface Props {
  onAbrir: (d: DisenoEstudio, id: number, nombre: string) => void
}

function fmt(v: string): string {
  const [y, m, d] = String(v).slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : "—"
}

export function EstudioGuardados({ onAbrir }: Props) {
  const { disenos, isLoading, borrarDiseno } = useEstudio3D()

  if (isLoading)
    return (
      <p className="flex items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </p>
    )

  if (disenos.length === 0)
    return (
      <Card className="flex flex-col items-center gap-2 py-12 text-center">
        <FolderOpen className="size-6 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">
          Todavía no has guardado ningún diseño
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Arma uno en el editor y pulsa Guardar: se conserva con sus colores,
          texturas y logos para poder retomarlo.
        </p>
      </Card>
    )

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {disenos.map((d) => (
        <Card key={d.id} className="overflow-hidden">
          <button
            type="button"
            onClick={() => onAbrir(d.documento, d.id, d.nombre)}
            className="block w-full"
          >
            <div className="aspect-square bg-gradient-to-b from-slate-100 to-slate-200">
              {d.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.preview_url}
                  alt={d.nombre}
                  className="size-full object-contain"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-slate-400">
                  sin vista previa
                </div>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {d.nombre}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {fmt(d.updated_at)}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {d.documento.logos.length} logos
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await borrarDiseno(d.id)
                if (r.success) toast.success("Diseño eliminado")
                else toast.error("No se pudo eliminar", { description: r.error })
              }}
              className="size-7 shrink-0 p-0 text-slate-400 hover:text-rose-600"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
