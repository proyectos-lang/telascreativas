"use client"

/**
 * Modelos 3D: aquí se suben los .glb de las prendas.
 *
 * El módulo no trae modelos: cada prenda tiene su silueta y sus UVs, y
 * un modelo genérico haría que las texturas se vieran deformadas. Se
 * suben aquí y quedan disponibles para el editor.
 *
 * Un mismo modelo sirve para muchos tipos de prenda del catálogo: 150
 * tipos comparten unas pocas siluetas en 3D.
 */

import { useRef, useState } from "react"
import { Box, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useEstudio3D } from "@/lib/estudio-3d-context"

export function EstudioModelos() {
  const { modelos, subirArchivo, registrarModelo, borrarModelo } = useEstudio3D()
  const [nombre, setNombre] = useState("")
  const [categoria, setCategoria] = useState("")
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const subir = async (file: File) => {
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      toast.error("Formato no válido", {
        description: "El modelo debe ser un archivo .glb o .gltf.",
      })
      return
    }
    const nom = nombre.trim() || file.name.replace(/\.[^.]+$/, "")

    setSubiendo(true)
    const up = await subirArchivo(file, "modelos")
    if (!up.success || !up.url) {
      setSubiendo(false)
      toast.error("No se pudo subir el modelo", { description: up.error })
      return
    }
    const r = await registrarModelo({
      nombre: nom,
      archivoUrl: up.url,
      categoria: categoria.trim() || null,
    })
    setSubiendo(false)

    if (r.success) {
      toast.success(`Modelo "${nom}" disponible`)
      setNombre("")
      setCategoria("")
    } else {
      toast.error("No se pudo registrar", { description: r.error })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Upload className="size-4 text-icon-cyan" />
          Subir un modelo
        </h4>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="m3-nombre" className="text-xs">
              Nombre
            </Label>
            <Input
              id="m3-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Camiseta ATP manga corta"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m3-cat" className="text-xs">
              Categoría (opcional)
            </Label>
            <Input
              id="m3-cat"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej. Camiseta"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf,model/gltf-binary"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void subir(f)
            e.target.value = ""
          }}
        />
        <Button
          size="sm"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 size-3.5" />
          )}
          Seleccionar archivo .glb
        </Button>

        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          El modelo debe traer sus <strong>coordenadas UV</strong>: son las que
          dicen qué parte del diseño va en cada zona de la prenda. Sin ellas la
          textura se ve estirada o desplazada. Máximo 50 MB.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <Box className="size-4 text-icon-cyan" />
          <span className="font-semibold text-slate-800">
            Modelos disponibles
          </span>
          <Badge variant="outline" className="text-[11px]">
            {modelos.length}
          </Badge>
        </div>

        {modelos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay modelos. Sube un .glb para empezar.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {modelos.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
              >
                <Box className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {m.nombre}
                </span>
                {m.categoria && (
                  <Badge variant="outline" className="text-[10px]">
                    {m.categoria}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await borrarModelo(m.id)
                    if (r.success) toast.success("Modelo eliminado")
                    else toast.error("No se pudo eliminar", { description: r.error })
                  }}
                  className="h-7 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
