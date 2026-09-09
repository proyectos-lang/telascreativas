"use client"

/**
 * Estudio 3D — generador de diseños.
 *
 * Editor 2D a la izquierda, prenda en 3D a la derecha: se coloca con
 * precisión sobre el plano y se comprueba al lado cómo queda puesto. La
 * misma textura alimenta a los dos, así que no pueden divergir.
 *
 * Módulo experimental restringido por `mod_estudio_3d`; el gate real está
 * en `canViewForUser`, aquí solo se decide qué mostrar.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Box,
  Eye,
  FolderOpen,
  Loader2,
  Redo2,
  RotateCw,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useEstudio3D } from "@/lib/estudio-3d-context"
import {
  disenoVacio,
  VISTAS,
  type CapaLogo,
  type CapaTextura,
  type DisenoEstudio,
  type Vista,
} from "@/lib/estudio-3d/tipos"
import { EstudioVisor } from "./estudio-visor"
import { EstudioLienzo } from "./estudio-lienzo"
import { EstudioPanel } from "./estudio-panel"
import { EstudioModelos } from "./estudio-modelos"
import { EstudioGuardados } from "./estudio-guardados"

/** Profundidad del historial. Suficiente para deshacer una tanda de ajustes. */
const MAX_HISTORIAL = 50

export function EstudioContent() {
  const { modelos, isLoading, error, guardarDiseno } = useEstudio3D()

  const [diseno, setDisenoRaw] = useState<DisenoEstudio>(() => disenoVacio())
  const [historial, setHistorial] = useState<DisenoEstudio[]>([])
  const [futuro, setFuturo] = useState<DisenoEstudio[]>([])
  const [vista, setVista] = useState<Vista>("frontal")
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [nombre, setNombre] = useState("")
  const [idAbierto, setIdAbierto] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const capturarRef = useRef<(() => string | null) | null>(null)

  const modelo = useMemo(
    () => modelos.find((m) => m.id === diseno.modeloId) ?? modelos[0] ?? null,
    [modelos, diseno.modeloId]
  )

  /**
   * Toda edición pasa por aquí para que el historial sea completo: si
   * algún cambio escribiera el estado directamente, quedaría fuera de
   * deshacer y el usuario perdería justo lo que quiso revertir.
   */
  const editar = useCallback(
    (f: (d: DisenoEstudio) => DisenoEstudio) => {
      setDisenoRaw((actual) => {
        setHistorial((h) => [...h, actual].slice(-MAX_HISTORIAL))
        setFuturo([])
        return f(actual)
      })
    },
    []
  )

  const deshacer = useCallback(() => {
    setHistorial((h) => {
      if (h.length === 0) return h
      const previo = h[h.length - 1]
      setDisenoRaw((actual) => {
        setFuturo((fu) => [actual, ...fu].slice(0, MAX_HISTORIAL))
        return previo
      })
      return h.slice(0, -1)
    })
  }, [])

  const rehacer = useCallback(() => {
    setFuturo((fu) => {
      if (fu.length === 0) return fu
      const siguiente = fu[0]
      setDisenoRaw((actual) => {
        setHistorial((h) => [...h, actual].slice(-MAX_HISTORIAL))
        return siguiente
      })
      return fu.slice(1)
    })
  }, [])

  const cambiarColor = useCallback(
    (hex: string) =>
      editar((d) => ({
        ...d,
        caras: { ...d.caras, [vista]: { ...d.caras[vista], color: hex } },
      })),
    [editar, vista]
  )

  const cambiarTextura = useCallback(
    (t: CapaTextura | null) =>
      editar((d) => ({
        ...d,
        caras: { ...d.caras, [vista]: { ...d.caras[vista], textura: t } },
      })),
    [editar, vista]
  )

  const agregarLogo = useCallback(
    (url: string, nombreLogo: string) =>
      editar((d) => {
        const z = d.logos.reduce((m, l) => Math.max(m, l.z), 0) + 1
        const nuevo: CapaLogo = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url,
          nombre: nombreLogo,
          vista,
          // Centrado y a un cuarto del ancho: un tamaño de partida que se
          // ve sin tapar la prenda.
          x: 50,
          y: 40,
          ancho: 25,
          rotacion: 0,
          opacidad: 1,
          z,
        }
        return { ...d, logos: [...d.logos, nuevo] }
      }),
    [editar, vista]
  )

  const editarLogo = useCallback(
    (id: string, cambios: Partial<CapaLogo>) =>
      editar((d) => ({
        ...d,
        logos: d.logos.map((l) => (l.id === id ? { ...l, ...cambios } : l)),
      })),
    [editar]
  )

  /**
   * Mover no entra al historial en cada píxel: un arrastre generaría
   * decenas de estados y deshacer se volvería inútil. Se escribe directo
   * y el punto de partida ya quedó guardado al seleccionar.
   */
  const moverLogo = useCallback(
    (id: string, x: number, y: number) =>
      setDisenoRaw((d) => ({
        ...d,
        logos: d.logos.map((l) => (l.id === id ? { ...l, x, y } : l)),
      })),
    []
  )

  const borrarLogo = useCallback(
    (id: string) => {
      editar((d) => ({ ...d, logos: d.logos.filter((l) => l.id !== id) }))
      setSeleccionado((s) => (s === id ? null : s))
    },
    [editar]
  )

  const abrir = useCallback(
    (d: DisenoEstudio, id: number, nombreDiseno: string) => {
      setDisenoRaw(d)
      setIdAbierto(id)
      setNombre(nombreDiseno)
      setHistorial([])
      setFuturo([])
      setSeleccionado(null)
      toast.success(`Diseño "${nombreDiseno}" abierto`)
    },
    []
  )

  const nuevo = useCallback(() => {
    setDisenoRaw(disenoVacio(modelo?.id ?? null))
    setIdAbierto(null)
    setNombre("")
    setHistorial([])
    setFuturo([])
    setSeleccionado(null)
  }, [modelo])

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.error("Ponle un nombre al diseño")
      return
    }
    setGuardando(true)
    const r = await guardarDiseno({
      id: idAbierto ?? undefined,
      nombre: nombre.trim(),
      modeloId: modelo?.id ?? null,
      documento: { ...diseno, modeloId: modelo?.id ?? null },
      previewDataUrl: capturarRef.current?.() ?? null,
    })
    setGuardando(false)
    if (r.success) {
      setIdAbierto(r.id ?? idAbierto)
      toast.success(idAbierto ? "Diseño actualizado" : "Diseño guardado")
    } else {
      toast.error("No se pudo guardar", { description: r.error })
    }
  }

  const exportar = () => {
    const png = capturarRef.current?.()
    if (!png) {
      toast.error("No hay nada que exportar", {
        description: "Carga un modelo 3D para poder capturar la vista.",
      })
      return
    }
    const a = document.createElement("a")
    a.href = png
    a.download = `${nombre.trim() || "diseno"}.png`
    a.click()
  }

  if (isLoading)
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
      </div>
    )

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-5 text-icon-cyan" />
        <h2 className="text-xl font-bold text-foreground">Estudio 3D</h2>
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
        >
          Experimental
        </Badge>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </Card>
      )}

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">
            <Sparkles className="mr-1.5 size-3.5" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="guardados">
            <FolderOpen className="mr-1.5 size-3.5" />
            Mis diseños
          </TabsTrigger>
          <TabsTrigger value="modelos">
            <Box className="mr-1.5 size-3.5" />
            Modelos 3D
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4 space-y-3">
          {/* Barra de acciones */}
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del diseño"
              className="h-8 w-56 text-sm"
            />
            {/* Elegir prenda. Antes se tomaba modelos[0] en silencio: con
                mas de un modelo cargado no habia forma de cambiarlo. */}
            {modelos.length > 0 && (
              <select
                value={modelo?.id ?? ""}
                onChange={(e) =>
                  editar((d) => ({ ...d, modeloId: Number(e.target.value) }))
                }
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                title="Modelo 3D de la prenda"
              >
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.categoria ? ` · ${m.categoria}` : ""}
                  </option>
                ))}
              </select>
            )}
            {idAbierto && (
              <Badge variant="outline" className="text-[10px]">
                editando #{idAbierto}
              </Badge>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={deshacer}
                disabled={historial.length === 0}
                className="h-8"
                title="Deshacer"
              >
                <Undo2 className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={rehacer}
                disabled={futuro.length === 0}
                className="h-8"
                title="Rehacer"
              >
                <Redo2 className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={nuevo} className="h-8">
                <RotateCw className="mr-1.5 size-3.5" />
                Nuevo
              </Button>
              <Button size="sm" variant="outline" onClick={exportar} className="h-8">
                <Eye className="mr-1.5 size-3.5" />
                Exportar PNG
              </Button>
              <Button
                size="sm"
                onClick={guardar}
                disabled={guardando}
                className="h-8 bg-emerald-600 hover:bg-emerald-700"
              >
                {guardando ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-3.5" />
                )}
                Guardar
              </Button>
            </div>
          </Card>

          {/* Frente / espalda */}
          <div className="flex items-center gap-1.5">
            {VISTAS.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={vista === v ? "default" : "outline"}
                onClick={() => {
                  setVista(v)
                  setSeleccionado(null)
                }}
                className={cn("h-8", vista === v && "bg-slate-800")}
              >
                {v === "frontal" ? "Frente" : "Espalda"}
              </Button>
            ))}
            <span className="ml-2 text-[11px] text-muted-foreground">
              Cada cara tiene su propio color, textura y logos
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_20rem]">
            <EstudioLienzo
              diseno={diseno}
              vista={vista}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
              onMoverLogo={moverLogo}
            />

            <div className="aspect-square">
              <EstudioVisor
                modelo={modelo}
                diseno={diseno}
                vista={vista}
                onCapturaLista={(f) => {
                  capturarRef.current = f
                }}
              />
            </div>

            <Card className="max-h-[calc(100dvh-16rem)] overflow-y-auto p-3">
              <EstudioPanel
                diseno={diseno}
                vista={vista}
                seleccionado={seleccionado}
                onSeleccionar={setSeleccionado}
                onCambiarColor={cambiarColor}
                onCambiarTextura={cambiarTextura}
                onAgregarLogo={agregarLogo}
                onEditarLogo={editarLogo}
                onBorrarLogo={borrarLogo}
              />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="guardados" className="mt-4">
          <EstudioGuardados onAbrir={abrir} />
        </TabsContent>

        <TabsContent value="modelos" className="mt-4">
          <EstudioModelos />
        </TabsContent>
      </Tabs>
    </div>
  )
}
