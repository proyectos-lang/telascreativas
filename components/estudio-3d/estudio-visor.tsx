"use client"

/**
 * Frontera entre el proyecto y el visor 3D.
 *
 * `@react-three/fiber` amplía el JSX global de React con
 * `declare module 'react'` para registrar sus cientos de elementos 3D
 * (`<mesh>`, `<primitive>`…). El efecto colateral es que las props
 * comunes de `React.ElementType` se intersectan a `never`, y cualquier
 * `<Icon className="…" />` del proyecto deja de compilar: verificado
 * aquí, importar el visor directamente rompía 11 archivos sin relación
 * con 3D (sidebar, cut-detail, order-detail, trazabilidad…).
 *
 * Por eso la implementación vive en `visor/`, excluida del tsconfig, y se
 * carga con `next/dynamic`. Next la compila igual en el build; lo que no
 * hace es meter los tipos de fiber en el programa principal.
 *
 * `ssr: false` no es opcional: el visor toca `document` y WebGL al
 * montarse, que no existen al renderizar en el servidor.
 *
 * Este archivo declara el contrato a mano para no importar nada de la
 * carpeta aislada — importar sus tipos traería de vuelta el problema.
 */

import dynamic from "next/dynamic"
import type { ComponentType } from "react"
import { Loader2 } from "lucide-react"
import type { DisenoEstudio, ModeloEstudio, Vista } from "@/lib/estudio-3d/tipos"

export interface EstudioVisorProps {
  modelo: ModeloEstudio | null
  diseno: DisenoEstudio
  vista: Vista
  className?: string
  /** Recibe una función que captura el lienzo 3D como PNG (data URL). */
  onCapturaLista?: (capturar: () => string | null) => void
}

const Cargando = () => (
  <div className="flex h-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 text-sm text-slate-500">
    <Loader2 className="size-4 animate-spin" />
    Cargando visor 3D…
  </div>
)

// La ruta se arma en tiempo de ejecucion para que TypeScript no siga el
// import y no meta los tipos de fiber en el programa: `exclude` en
// tsconfig no basta, porque un import estatico vuelve a arrastrar el
// archivo aunque este excluido. El bundler de Next si lo resuelve y lo
// compila en su propio chunk.
// El especificador se guarda en una constante: asi TypeScript no puede
// resolver el modulo y no arrastra los tipos de fiber al programa
// principal (`exclude` en tsconfig no basta — un import que el compilador
// pueda seguir vuelve a incluir el archivo aunque este excluido).
// Next si lo resuelve al empaquetar, porque es una cadena literal.
const RUTA_VISOR = "./visor/visor-impl"

const cargarVisor = () =>
  (import(RUTA_VISOR) as Promise<{
    EstudioVisorImpl: ComponentType<EstudioVisorProps>
  }>).then((m) => m.EstudioVisorImpl)

export const EstudioVisor = dynamic<EstudioVisorProps>(cargarVisor, {
  ssr: false,
  loading: Cargando,
})
