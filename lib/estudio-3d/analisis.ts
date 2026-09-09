/**
 * Análisis de un modelo GLB al subirlo.
 *
 * Antes, el visor improvisaba en cada carga: medía la escala y regeneraba
 * las UVs cada vez que se abría el editor. Eso funciona, pero deja al
 * usuario sin saber si su archivo sirve hasta que ve el resultado — y el
 * primer modelo que se subió aquí tenía UVs de -387 a 298, lo que hacía
 * que un logo se promediara hasta convertirse en un tinte plano.
 *
 * Ahora el modelo se examina UNA vez, al subirlo: se mide, se comprueba
 * si su mapeo sirve para colocar un diseño y se guarda el veredicto. El
 * visor lee esa decisión en vez de recalcularla, y el usuario recibe el
 * diagnóstico en el momento en que sube el archivo, cuando todavía puede
 * cambiarlo.
 *
 * Solo se ejecuta en el navegador: usa GLTFLoader, que necesita fetch y
 * las APIs de DOM.
 */

import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

/** Cómo se le aplica el diseño a un modelo. */
export type Mapeo =
  /** Las UVs del archivo sirven: se usan tal cual. */
  | "original"
  /** Las UVs no sirven para un diseño; se proyectan de frente. */
  | "proyeccion"

export interface AnalisisModelo {
  ok: boolean
  /** Motivo por el que el archivo no se puede usar. */
  error?: string

  mapeo: Mapeo
  /** Escala para llevar el modelo a ~1 unidad. */
  escala: number
  /** Desplazamiento que lleva su centro al origen. */
  centro: { x: number; y: number; z: number }

  /** Materiales que se pintan con el diseño. */
  materiales: string[]
  mallas: number
  vertices: number

  /** Qué porcentaje de vértices tenía UVs utilizables. */
  uvUtilizables: number
  /** Avisos que no impiden usar el modelo pero conviene conocer. */
  avisos: string[]
}

/**
 * Un modelo con menos de este porcentaje de UVs dentro de [0,1] no se
 * puede usar tal cual: se reproyecta.
 *
 * No se exige el 100% porque es normal que algún vértice se salga por
 * costuras o por islas que rebasan el borde; pero por debajo de esto el
 * mapeo es de patrón repetido, no de diseño.
 */
const UMBRAL_UV = 90

/** Descarga y analiza un .glb. */
export async function analizarModelo(
  archivo: File | ArrayBuffer
): Promise<AnalisisModelo> {
  const vacio: AnalisisModelo = {
    ok: false,
    mapeo: "proyeccion",
    escala: 1,
    centro: { x: 0, y: 0, z: 0 },
    materiales: [],
    mallas: 0,
    vertices: 0,
    uvUtilizables: 0,
    avisos: [],
  }

  let buffer: ArrayBuffer
  try {
    buffer =
      archivo instanceof ArrayBuffer ? archivo : await archivo.arrayBuffer()
  } catch {
    return { ...vacio, error: "No se pudo leer el archivo." }
  }

  // Comprobación barata antes de invocar al cargador: un archivo que no
  // empieza por "glTF" no es un GLB y el error del loader es críptico.
  const magia = new TextDecoder().decode(new Uint8Array(buffer, 0, 4))
  if (magia !== "glTF")
    return {
      ...vacio,
      error:
        "El archivo no es un .glb válido (no empieza por la firma glTF).",
    }

  let escena: THREE.Group
  try {
    escena = await new Promise<THREE.Group>((resolve, reject) => {
      new GLTFLoader().parse(
        buffer,
        "",
        (gltf) => resolve(gltf.scene),
        (e) => reject(e)
      )
    })
  } catch (e) {
    return {
      ...vacio,
      error:
        e instanceof Error
          ? `No se pudo abrir el modelo: ${e.message}`
          : "No se pudo abrir el modelo.",
    }
  }

  const avisos: string[] = []
  const materiales: string[] = []
  let mallas = 0
  let vertices = 0
  let conUV = 0
  let sinAtributoUV = 0

  escena.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    mallas++

    for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      const nombre = (m as THREE.Material | undefined)?.name
      if (nombre && !materiales.includes(nombre)) materiales.push(nombre)
    }

    const geo = obj.geometry as THREE.BufferGeometry
    const pos = geo.attributes.position
    const uv = geo.attributes.uv
    if (!pos) return
    vertices += pos.count

    if (!uv) {
      sinAtributoUV += pos.count
      return
    }
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i)
      const v = uv.getY(i)
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) conUV++
    }
  })

  if (mallas === 0)
    return { ...vacio, error: "El modelo no contiene ninguna malla." }
  if (vertices === 0)
    return { ...vacio, error: "Las mallas del modelo están vacías." }

  const caja = new THREE.Box3().setFromObject(escena)
  const tam = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  const mayor = Math.max(tam.x, tam.y, tam.z)
  if (!(mayor > 0) || !Number.isFinite(mayor))
    return { ...vacio, error: "El modelo no tiene volumen medible." }

  const uvUtilizables = (conUV / vertices) * 100
  const mapeo: Mapeo = uvUtilizables >= UMBRAL_UV ? "original" : "proyeccion"

  if (mapeo === "proyeccion") {
    avisos.push(
      sinAtributoUV === vertices
        ? "El modelo no trae coordenadas UV; el diseño se proyecta de frente."
        : `Solo el ${uvUtilizables.toFixed(0)}% de las UVs sirve para colocar un diseño (el resto está fuera del rango). Se proyecta de frente.`
    )
  }

  // Una prenda muy plana suele ser un modelo de una sola cara: el diseño
  // de la espalda no se vería en ningún sitio.
  if (tam.z < mayor * 0.05)
    avisos.push(
      "El modelo es casi plano: puede que no tenga espalda y solo se vea el frente."
    )

  if (mallas > 40)
    avisos.push(
      `El modelo tiene ${mallas} mallas; los muy detallados pueden ir lentos en tablet.`
    )

  return {
    ok: true,
    mapeo,
    escala: 1 / mayor,
    centro: { x: centro.x, y: centro.y, z: centro.z },
    materiales,
    mallas,
    vertices,
    uvUtilizables,
    avisos,
  }
}

/**
 * Aplica a un modelo ya cargado lo que decidió el análisis.
 *
 * Centraliza aquí la regeneración de UVs para que el visor no tenga que
 * repetir el criterio: si el análisis dijo "original", no se toca nada.
 *
 * La proyección es planar frontal (X→U, Y→V, normalizada por la caja) y
 * usa la normal en Z para separar frente de espalda, mandando cada cara a
 * su mitad del atlas frente|espalda que compone el editor.
 */
export function aplicarMapeo(raiz: THREE.Object3D, mapeo: Mapeo): void {
  if (mapeo === "original") return

  const caja = new THREE.Box3().setFromObject(raiz)
  const min = caja.min
  const tam = caja.getSize(new THREE.Vector3())
  const anchoX = tam.x > 0 ? tam.x : 1
  const altoY = tam.y > 0 ? tam.y : 1

  raiz.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const geo = obj.geometry as THREE.BufferGeometry
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    if (!pos) return

    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      const alFrente = !nor || nor.getZ(i) >= 0
      const u = (pos.getX(i) - min.x) / anchoX
      // Atlas frente|espalda: [0,0.5) el frente, [0.5,1] la espalda. La
      // espalda se refleja en U porque se mira desde el otro lado; sin
      // reflejarla, un texto saldría al revés.
      uv[i * 2] = alFrente ? u * 0.5 : 1 - u * 0.5
      uv[i * 2 + 1] = (pos.getY(i) - min.y) / altoY
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  })
}
