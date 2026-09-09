"use client"

/**
 * Visor 3D de la prenda.
 *
 * Carga el .glb y le aplica como mapa de color la textura compuesta por
 * `compositor.ts`. La textura se genera en un canvas fuera de pantalla y
 * se marca `needsUpdate` cuando el diseño cambia: recrear la textura en
 * cada cambio dispararía una subida a GPU por cada movimiento del ratón.
 *
 * Se usa la cara FRONTAL como mapa del modelo. La trasera se compone
 * igual y se muestra en el editor 2D; separar ambas caras sobre la malla
 * exige un GLB con UVs partidas, que es una condición del modelo y no algo
 * que el visor pueda inventar.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, OrbitControls, useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  LADO_TEXTURA,
  componerCara,
  disenoListo,
  precargarDiseno,
} from "@/lib/estudio-3d/compositor"
import type { DisenoEstudio, ModeloEstudio, Vista } from "@/lib/estudio-3d/tipos"

export interface Props {
  modelo: ModeloEstudio | null
  diseno: DisenoEstudio
  vista: Vista
  className?: string
  /** Recibe una función que captura el lienzo como PNG. */
  onCapturaLista?: (capturar: () => string | null) => void
}

/**
 * Textura viva: un canvas que se repinta cuando el diseño cambia.
 *
 * Devuelve siempre la MISMA instancia de THREE.CanvasTexture; lo que
 * cambia es su contenido. Así el material no se recompila en cada edición.
 */
function useTexturaDiseno(diseno: DisenoEstudio, vista: Vista) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = LADO_TEXTURA
    c.height = LADO_TEXTURA
    return c
  }, [])

  const textura = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false // convención de glTF
    return t
  }, [canvas])

  const pendiente = useRef(true)

  useEffect(() => {
    let vivo = true
    pendiente.current = true
    void precargarDiseno(diseno).then(() => {
      if (!vivo) return
      componerCara(canvas, diseno, vista)
      textura.needsUpdate = true
      pendiente.current = false
    })
    // Pintado inmediato con lo que ya esté cargado, para que la edición
    // se sienta instantánea aunque falte alguna imagen por llegar.
    componerCara(canvas, diseno, vista)
    textura.needsUpdate = true
    return () => {
      vivo = false
    }
  }, [canvas, textura, diseno, vista])

  // Mientras falten imágenes se sigue repintando: es la única forma de
  // que una capa que acaba de cargar aparezca sin tocar nada.
  useFrame(() => {
    if (pendiente.current && !disenoListo(diseno)) return
    if (pendiente.current) {
      componerCara(canvas, diseno, vista)
      textura.needsUpdate = true
      pendiente.current = false
    }
  })

  useEffect(() => () => textura.dispose(), [textura])

  return textura
}

function Prenda({
  modelo,
  diseno,
  vista,
}: {
  modelo: ModeloEstudio
  diseno: DisenoEstudio
  vista: Vista
}) {
  const { scene } = useGLTF(modelo.archivo_url)
  const textura = useTexturaDiseno(diseno, vista)

  // El GLB se clona: `useGLTF` cachea la escena y mutar sus materiales
  // afectaría a cualquier otro visor que cargue el mismo archivo.
  const clon = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const permitidos = modelo.materiales?.length
      ? new Set(modelo.materiales.map((m) => m.toLowerCase()))
      : null

    /** Crea el material del diseno conservando el nombre del original. */
    const pintar = (m: THREE.Material | undefined) => {
      // Partes que no se pintan (cremalleras, botones): se dejan como
      // vienen del modelo.
      if (permitidos && !permitidos.has((m?.name ?? "").toLowerCase()))
        return m as THREE.Material

      const nuevo = new THREE.MeshStandardMaterial({
        map: textura,
        roughness: 0.75,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
      nuevo.name = m?.name ?? ""
      return nuevo
    }

    clon.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      // Se conserva la FORMA del material: three solo interpreta un array
      // cuando la geometria tiene grupos, asi que envolver un material
      // unico en un array de uno lo dejaria sin dibujar.
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(pintar)
        : pintar(obj.material)
    })
  }, [clon, textura, modelo.materiales])

  /**
   * Normaliza el modelo a tamano ~1 y lo centra en el origen.
   *
   * Los .glb vienen en las unidades con que se exportaron: el primero que
   * se subio aqui media 68 unidades de ancho y estaba centrado a Y=136
   * (centimetros, no metros). Con una camara pensada para un objeto de
   * ~1 unidad, esta DENTRO de la prenda y solo se ve el gris de la cara
   * interna de la tela.
   *
   * Escalar aqui, y no en la camara, hace que el visor funcione con
   * cualquier modelo sin pedirle al usuario que ajuste nada.
   */
  const ajuste = useMemo(() => {
    const caja = new THREE.Box3().setFromObject(clon)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const mayor = Math.max(tam.x, tam.y, tam.z)
    // Un modelo vacio o degenerado no debe producir una escala infinita.
    const escala = mayor > 0 && Number.isFinite(mayor) ? 1 / mayor : 1
    return { escala, centro }
  }, [clon])

  return (
    <group
      rotation={[0, (modelo.rotacion_y * Math.PI) / 180, 0]}
      scale={ajuste.escala * (modelo.escala || 1)}
    >
      {/* Se desplaza el modelo para que su centro quede en el origen: asi
          la rotacion de OrbitControls gira alrededor de la prenda y no
          alrededor de un punto lejano. */}
      <group position={[-ajuste.centro.x, -ajuste.centro.y, -ajuste.centro.z]}>
        <primitive object={clon} />
      </group>
    </group>
  )
}

/** Expone al padre una función para capturar el lienzo como PNG. */
function Capturador({ onListo }: { onListo?: (f: () => string | null) => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!onListo) return
    onListo(() => {
      // Hay que renderizar justo antes: con `preserveDrawingBuffer` en
      // false el buffer ya está limpio cuando se lee.
      gl.render(scene, camera)
      return gl.domElement.toDataURL("image/png")
    })
  }, [gl, scene, camera, onListo])
  return null
}

function Cargando() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" />
      Cargando modelo…
    </div>
  )
}

export function EstudioVisorImpl({
  modelo,
  diseno,
  vista,
  className,
  onCapturaLista,
}: Props) {
  const [key, setKey] = useState(0)

  if (!modelo)
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center",
          className
        )}
      >
        <p className="text-sm font-medium text-slate-700">
          No hay ningún modelo 3D cargado
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Sube un archivo .glb en la pestaña Modelos para ver la prenda en 3D.
          Mientras tanto puedes seguir armando el diseño en el editor.
        </p>
      </div>
    )

  return (
    <div className={cn("relative h-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-200", className)}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setKey((k) => k + 1)}
        className="absolute right-2 top-2 z-10 h-7 bg-white/90 text-xs"
        title="Volver a la vista inicial"
      >
        <RotateCcw className="mr-1 size-3.5" />
        Centrar
      </Button>

      <Canvas
        key={key}
        camera={{ position: [0, 0, 1.9], fov: 35 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} />

        <Suspense fallback={null}>
          {/* El modelo llega ya normalizado a ~1 unidad y centrado en el
              origen, asi que no hace falta encuadrarlo: `Bounds` medía
              antes de que la malla estuviera lista y dejaba la camara
              dentro de la prenda. */}
          <Prenda modelo={modelo} diseno={diseno} vista={vista} />
          <Environment preset="studio" />
        </Suspense>

        {/* Margen amplio a proposito: el limite anterior (1.2-6) estaba
            pensado para un modelo de ~1 unidad e impedia alejarse lo
            suficiente cuando el .glb venia en otra escala. */}
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={0.6}
          maxDistance={5}
          target={[0, 0, 0]}
        />
        <Capturador onListo={onCapturaLista} />
      </Canvas>
    </div>
  )
}


