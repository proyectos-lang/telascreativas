/**
 * Estudio 3D — modelo de datos del editor.
 *
 * Un diseño es un DOCUMENTO de capas, no una imagen: se guarda lo que el
 * usuario decidió (este color, esta textura, este logo aquí a este tamaño)
 * y la imagen se vuelve a componer al abrirlo. Guardar solo el PNG haría
 * el diseño imposible de retomar.
 *
 * Las coordenadas de los logos son PORCENTAJES 0–100 sobre la vista, no
 * píxeles: es la misma convención que ya usa `LogoPosition` en Gestión de
 * Diseños, y hace que el documento no dependa de a qué resolución se
 * compuso la textura.
 */

/** Cara de la prenda. El modelo 3D recibe una textura por cada una. */
export type Vista = "frontal" | "trasera"

export const VISTAS: Vista[] = ["frontal", "trasera"]

/**
 * Una imagen colocada sobre la prenda: logo, símbolo del catálogo o
 * cualquier archivo que suba el usuario.
 */
export interface CapaLogo {
  id: string
  url: string
  /** Nombre visible en la lista de capas. */
  nombre: string
  vista: Vista
  /** Centro de la imagen, en % del ancho/alto de la vista. */
  x: number
  y: number
  /** Ancho en % del ancho de la vista; el alto sale de la proporción. */
  ancho: number
  /** Grados. */
  rotacion: number
  opacidad: number
  /** Orden de apilado: mayor va encima. */
  z: number
}

/**
 * Textura o patrón de fondo, del catálogo de símbolos o subida.
 *
 * Se repite en mosaico sobre toda la prenda; `escala` controla el tamaño
 * del mosaico y `opacidad` cuánto deja ver el color base debajo.
 */
export interface CapaTextura {
  url: string
  nombre: string
  escala: number
  opacidad: number
  rotacion: number
}

/** Lo que define una cara de la prenda. */
export interface CaraDiseno {
  /** Color base en hex. Es el fondo sobre el que va todo lo demás. */
  color: string
  textura: CapaTextura | null
}

export interface DisenoEstudio {
  version: 1
  modeloId: number | null
  /** Cada cara tiene su propio color y textura. */
  caras: Record<Vista, CaraDiseno>
  /** Todas las capas, de ambas vistas; se filtran por `vista` al pintar. */
  logos: CapaLogo[]
}

/** Diseño guardado, tal como vuelve de `telas.estudio_disenos`. */
export interface DisenoGuardado {
  id: number
  nombre: string
  modelo_id: number | null
  documento: DisenoEstudio
  preview_url: string | null
  creado_por: string
  cliente: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

/** Modelo GLB, tal como vuelve de `telas.estudio_modelos`. */
export interface ModeloEstudio {
  id: number
  nombre: string
  archivo_url: string
  categoria: string | null
  tipos_prenda: string[] | null
  /** Materiales del GLB que reciben el diseño; null = todos. */
  materiales: string[] | null
  rotacion_y: number
  escala: number
  /** Como se aplica el diseno; lo decide el analisis al subir el modelo. */
  mapeo: "original" | "proyeccion"
  /** Diagnostico completo del analisis, para poder revisarlo despues. */
  analisis: unknown | null
  centro_x: number
  centro_y: number
  centro_z: number
  activo: boolean
  orden: number
  notas: string | null
  creado_por: string | null
  created_at: string
}

/** Diseño en blanco. Blanco por defecto: es sobre lo que se dibuja. */
export function disenoVacio(modeloId: number | null = null): DisenoEstudio {
  return {
    version: 1,
    modeloId,
    caras: {
      frontal: { color: "#FFFFFF", textura: null },
      trasera: { color: "#FFFFFF", textura: null },
    },
    logos: [],
  }
}

/**
 * Normaliza un documento que viene de la base.
 *
 * Un diseño guardado hace semanas puede no tener campos que se agregaron
 * después. Sin este paso, abrirlo reventaría el editor con `undefined`
 * en vez de mostrar el diseño que el usuario sí guardó.
 */
export function normalizarDiseno(
  raw: unknown,
  modeloId: number | null = null
): DisenoEstudio {
  const base = disenoVacio(modeloId)
  if (!raw || typeof raw !== "object") return base

  const d = raw as Partial<DisenoEstudio>
  const caras = { ...base.caras }
  for (const v of VISTAS) {
    const c = d.caras?.[v]
    if (c && typeof c === "object") {
      caras[v] = {
        color: typeof c.color === "string" ? c.color : base.caras[v].color,
        textura: c.textura ?? null,
      }
    }
  }

  return {
    version: 1,
    modeloId: d.modeloId ?? modeloId,
    caras,
    logos: Array.isArray(d.logos)
      ? d.logos.filter((l): l is CapaLogo => !!l && typeof l.url === "string")
      : [],
  }
}
