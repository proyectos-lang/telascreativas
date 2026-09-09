"use client"

/**
 * Estudio 3D — datos del módulo.
 *
 * Reúne lo que el editor necesita: los catálogos que ya alimentan Gestión
 * de Diseños (colores y texturas), los modelos GLB y los diseños
 * guardados del usuario.
 *
 * Los catálogos se leen de las MISMAS tablas que usa GD, no de copias:
 * el objetivo del módulo es diseñar con los colores y texturas reales de
 * la empresa, así que duplicarlos los dejaría desincronizados al primer
 * cambio del catálogo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { useAuth } from "@/lib/auth-context"
import type {
  CatalogoColor,
  CatalogoSimbolo,
} from "@/lib/gestion-disenos-types"
import type { AnalisisModelo } from "@/lib/estudio-3d/analisis"
import {
  normalizarDiseno,
  type DisenoEstudio,
  type DisenoGuardado,
  type ModeloEstudio,
} from "@/lib/estudio-3d/tipos"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Mismo bucket que Gestión de Diseños: los logos ya viven ahí. */
const BUCKET = "gd-archivos"
const MAX_BYTES = 50 * 1024 * 1024

interface Resultado {
  success: boolean
  error?: string
}

interface Estudio3DContextType {
  colores: CatalogoColor[]
  texturas: CatalogoSimbolo[]
  modelos: ModeloEstudio[]
  disenos: DisenoGuardado[]
  isLoading: boolean
  error: string | null
  refrescar: () => Promise<void>
  subirArchivo: (
    file: File,
    carpeta: string
  ) => Promise<{ success: boolean; url?: string; error?: string }>
  guardarDiseno: (input: {
    id?: number
    nombre: string
    modeloId: number | null
    documento: DisenoEstudio
    previewDataUrl?: string | null
    cliente?: string | null
    notas?: string | null
  }) => Promise<Resultado & { id?: number }>
  borrarDiseno: (id: number) => Promise<Resultado>
  registrarModelo: (input: {
    nombre: string
    archivoUrl: string
    categoria?: string | null
    notas?: string | null
    analisis: AnalisisModelo
  }) => Promise<Resultado>
  borrarModelo: (id: number) => Promise<Resultado>
}

const Ctx = createContext<Estudio3DContextType | undefined>(undefined)

export function Estudio3DProvider({ children }: { children: ReactNode }) {
  const { usuarioActual } = useAuth()
  const [colores, setColores] = useState<CatalogoColor[]>([])
  const [texturas, setTexturas] = useState<CatalogoSimbolo[]>([])
  const [modelos, setModelos] = useState<ModeloEstudio[]>([])
  const [disenos, setDisenos] = useState<DisenoGuardado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const email = usuarioActual?.email ?? null

  const refrescar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [c, t, m, d] = await Promise.all([
        supabase
          .schema("telas")
          .from("catalogo_colores")
          .select("*")
          .eq("activo", true)
          .order("orden"),
        supabase
          .schema("telas")
          .from("gd_catalogo_simbolos")
          .select("*")
          .eq("activo", true)
          .order("categoria")
          .order("orden"),
        supabase
          .schema("telas")
          .from("estudio_modelos")
          .select("*")
          .eq("activo", true)
          .order("orden"),
        // Cada quien ve sus diseños: el módulo es un espacio de trabajo
        // personal, no un repositorio compartido.
        email
          ? supabase
              .schema("telas")
              .from("estudio_disenos")
              .select("*")
              .eq("creado_por", email)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])

      setColores((c.data as CatalogoColor[]) ?? [])
      setTexturas((t.data as CatalogoSimbolo[]) ?? [])
      setModelos((m.data as ModeloEstudio[]) ?? [])
      setDisenos(
        ((d.data as DisenoGuardado[]) ?? []).map((x) => ({
          ...x,
          documento: normalizarDiseno(x.documento, x.modelo_id),
        }))
      )

      // Los modelos y los diseños son propios del módulo; si fallan, el
      // editor no puede trabajar y hay que decirlo.
      const fallo = m.error ?? d.error
      if (fallo) setError(fallo.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando el estudio")
    } finally {
      setIsLoading(false)
    }
  }, [email])

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  const subirArchivo = useCallback(
    async (file: File, carpeta: string) => {
      if (file.size > MAX_BYTES)
        return { success: false, error: "Archivo demasiado grande (máx. 50 MB)." }

      // El nombre se sanea: Storage rechaza rutas con caracteres raros y
      // los archivos que sube la gente traen tildes y espacios.
      const limpio = file.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `estudio-3d/${carpeta}/${Date.now()}_${limpio}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) return { success: false, error: upErr.message }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { success: true, url: data.publicUrl }
    },
    []
  )

  const guardarDiseno = useCallback(
    async (input: {
      id?: number
      nombre: string
      modeloId: number | null
      documento: DisenoEstudio
      previewDataUrl?: string | null
      cliente?: string | null
      notas?: string | null
    }): Promise<Resultado & { id?: number }> => {
      const nombre = input.nombre.trim()
      if (!nombre) return { success: false, error: "Ponle un nombre al diseño." }
      if (!email) return { success: false, error: "Sesión no identificada." }

      // El preview llega como data URL desde el canvas del visor; se sube
      // como archivo para no engordar la fila con un base64 enorme.
      let previewUrl: string | null = null
      if (input.previewDataUrl) {
        const blob = await (await fetch(input.previewDataUrl)).blob()
        const f = new File([blob], `preview_${Date.now()}.png`, {
          type: "image/png",
        })
        const r = await subirArchivo(f, "previews")
        if (r.success) previewUrl = r.url ?? null
      }

      const fila = {
        nombre,
        modelo_id: input.modeloId,
        documento: input.documento,
        cliente: input.cliente ?? null,
        notas: input.notas ?? null,
        ...(previewUrl ? { preview_url: previewUrl } : {}),
      }

      if (input.id) {
        const { error: e } = await supabase
          .schema("telas")
          .from("estudio_disenos")
          .update(fila)
          .eq("id", input.id)
        if (e) return { success: false, error: e.message }
        await refrescar()
        return { success: true, id: input.id }
      }

      const { data, error: e } = await supabase
        .schema("telas")
        .from("estudio_disenos")
        .insert({ ...fila, creado_por: email })
        .select("id")
        .single()
      if (e) return { success: false, error: e.message }
      await refrescar()
      return { success: true, id: (data as { id: number }).id }
    },
    [email, refrescar, subirArchivo]
  )

  const borrarDiseno = useCallback(
    async (id: number): Promise<Resultado> => {
      const { error: e } = await supabase
        .schema("telas")
        .from("estudio_disenos")
        .delete()
        .eq("id", id)
      if (e) return { success: false, error: e.message }
      await refrescar()
      return { success: true }
    },
    [refrescar]
  )

  const registrarModelo = useCallback(
    async (input: {
      nombre: string
      archivoUrl: string
      categoria?: string | null
      notas?: string | null
      analisis: AnalisisModelo
    }): Promise<Resultado> => {
      const nombre = input.nombre.trim()
      if (!nombre) return { success: false, error: "El modelo necesita nombre." }

      const a = input.analisis
      const { error: e } = await supabase
        .schema("telas")
        .from("estudio_modelos")
        .insert({
          nombre,
          archivo_url: input.archivoUrl,
          categoria: input.categoria ?? null,
          notas: input.notas ?? null,
          creado_por: email,
          // El analisis se hace al subir, no en cada carga del editor:
          // el visor solo aplica lo que aqui se decidio.
          mapeo: a.mapeo,
          escala: a.escala,
          centro_x: a.centro.x,
          centro_y: a.centro.y,
          centro_z: a.centro.z,
          materiales: a.materiales.length ? a.materiales : null,
          analisis: {
            mallas: a.mallas,
            vertices: a.vertices,
            uvUtilizables: a.uvUtilizables,
            avisos: a.avisos,
            analizadoEn: new Date().toISOString(),
          },
        })
      if (e) {
        const dup = /duplicate key|unique/i.test(e.message)
        return {
          success: false,
          error: dup ? `Ya existe un modelo llamado "${nombre}".` : e.message,
        }
      }
      await refrescar()
      return { success: true }
    },
    [email, refrescar]
  )

  const borrarModelo = useCallback(
    async (id: number): Promise<Resultado> => {
      const { error: e } = await supabase
        .schema("telas")
        .from("estudio_modelos")
        .delete()
        .eq("id", id)
      if (e) return { success: false, error: e.message }
      await refrescar()
      return { success: true }
    },
    [refrescar]
  )

  return (
    <Ctx.Provider
      value={{
        colores,
        texturas,
        modelos,
        disenos,
        isLoading,
        error,
        refrescar,
        subirArchivo,
        guardarDiseno,
        borrarDiseno,
        registrarModelo,
        borrarModelo,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useEstudio3D() {
  const c = useContext(Ctx)
  if (!c) throw new Error("useEstudio3D debe usarse dentro de Estudio3DProvider")
  return c
}
