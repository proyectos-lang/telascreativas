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
import { Box, CheckCircle2, Info, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useEstudio3D } from "@/lib/estudio-3d-context"
import { analizarModelo, type AnalisisModelo } from "@/lib/estudio-3d/analisis"

export function EstudioModelos() {
  const { modelos, subirArchivo, registrarModelo, borrarModelo } = useEstudio3D()
  const [nombre, setNombre] = useState("")
  const [categoria, setCategoria] = useState("")
  const [subiendo, setSubiendo] = useState(false)
  const [diagnostico, setDiagnostico] = useState<{
    nombre: string
    analisis: AnalisisModelo
  } | null>(null)
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
    setDiagnostico(null)

    // Se analiza ANTES de subir: si el archivo no sirve, no tiene sentido
    // dejarlo en el bucket ni crear un registro que habria que borrar.
    const a = await analizarModelo(file)
    if (!a.ok) {
      setSubiendo(false)
      toast.error("El modelo no se puede usar", { description: a.error })
      return
    }

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
      analisis: a,
    })
    setSubiendo(false)

    if (r.success) {
      setDiagnostico({ nombre: nom, analisis: a })
      toast.success(`Modelo "${nom}" listo para usar`, {
        description:
          a.mapeo === "original"
            ? "Su mapeo original sirve para colocar el diseño."
            : "Se le generó un mapeo propio para colocar el diseño.",
      })
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
          Al subirlo se revisa el modelo y se le prepara el mapeo del diseño.
          Si su mapeo original no sirve para colocar un diseño —lo habitual en
          modelos pensados para telas estampadas— el sistema le genera uno
          propio. Máximo 50 MB.
        </p>

        {/* Diagnostico del ultimo modelo subido: es lo que le dice al
            usuario si su archivo quedo bien, en el momento en que todavia
            puede cambiarlo. */}
        {diagnostico && (
          <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="size-3.5" />
              {diagnostico.nombre} · analizado
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="bg-white text-[10px]">
                {diagnostico.analisis.mallas} mallas
              </Badge>
              <Badge variant="outline" className="bg-white text-[10px] tabular-nums">
                {diagnostico.analisis.vertices.toLocaleString("es")} vértices
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  diagnostico.analisis.mapeo === "original"
                    ? "border-emerald-300 bg-white text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                )}
              >
                {diagnostico.analisis.mapeo === "original"
                  ? "mapeo propio del modelo"
                  : "mapeo generado"}
              </Badge>
              {diagnostico.analisis.materiales.map((m) => (
                <Badge key={m} variant="outline" className="bg-white text-[10px]">
                  {m}
                </Badge>
              ))}
            </div>
            {diagnostico.analisis.avisos.map((a, i) => (
              <p
                key={i}
                className="flex gap-1.5 text-[11px] text-emerald-900/80"
              >
                <Info className="mt-0.5 size-3 shrink-0" />
                {a}
              </p>
            ))}
          </div>
        )}
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
