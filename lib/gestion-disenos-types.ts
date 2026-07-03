export type EstadoGD =
  | "Borrador"
  | "Pendiente Revision"
  | "En Progreso"
  | "Esperando Retroalimentacion"
  | "Pendiente Aprobacion"
  | "Aprobado"
  | "Finalizando"
  | "Finalizado"
  | "Rechazado"

export type EstadoTurno = "En Ventas" | "En Diseño" | "En Cliente" | "Finalizado"

export type TipoDiseno = "Nuevo" | "Recreacion" | "Editable"

export type SegundaPrendaRelacion = "Relacionado" | "Diferente"

export type EstadoPropuesta =
  | "Pendiente"
  | "En Cliente"
  | "Con Cambios"
  | "Aprobada"
  | "No Aprobada"

export interface LogoPosition {
  logo: number
  x: number
  y: number
  vista: "frontal" | "trasera"
  label?: string
  size?: number  // scale multiplier 0.5–3.0, default 1.0
}

export interface CatalogoPrenda {
  id: number
  nombre: string
  categoria: string   // 'ATP' | 'Conjunto ATP' | 'TC' | 'Conjunto TC' | 'Promocionales'
  genero: string | null
  mangas: string | null
  medidas: string | null
  activo: boolean
  orden: number
}

export interface CatalogoColor {
  id: number
  nombre: string    // "C=0 M=0 Y=100 K=0"
  hex: string       // "#FFED00"
  r: number
  g: number
  b: number
  c?: number
  m?: number
  y?: number
  k?: number
  familia?: string
  activo: boolean
  orden: number
}

export interface CatalogoSimbolo {
  id: number
  nombre: string
  categoria: string
  imagen_url: string
  activo: boolean
  orden: number
}

export interface GestionDisenoProposal {
  id: number
  gestion_id: number
  numero_propuesta: number
  imagen_mockup_url: string | null
  comentario_diseno: string | null
  fecha_subida: string | null
  estado: EstadoPropuesta
  cliente_token: string | null
  cliente_token_creado: string | null
  respuesta_cliente: string | null
  comentario_cliente: string | null
  fecha_respuesta_cliente: string | null
  respuesta_ventas: string | null
  comentario_ventas: string | null
  imagen_cambio_url: string | null
  fecha_respuesta_ventas: string | null
  archivos_finales_urls: string[] | null
  fecha_archivos_finales: string | null
  created_at: string
}

export interface GestionDiseno {
  id: number
  numero: string
  cliente: string
  vendedora: string
  fecha_creacion: string
  tipo_diseno: TipoDiseno | null
  tematica: string | null
  tipos_prenda: string[] | null
  segunda_prenda_activa: boolean
  segunda_prenda_relacion: SegundaPrendaRelacion | null
  tipo_manga: "Corta" | "Larga" | null
  color_fondo: string | null
  color_secundario: string | null
  simbolos_seleccionados: number[] | null
  lleva_logos: boolean
  cantidad_logos: number | null
  posiciones_logos_prenda1: LogoPosition[] | null
  posiciones_logos_prenda2: LogoPosition[] | null
  lleva_patrocinadores: boolean
  cantidad_patrocinadores: number | null
  diseno_base: string | null
  imagenes_simbolos: string | null
  accesorios: string | null
  tipografia: string | null
  otros_detalles: string | null
  segunda_tipo_prenda: string | null
  segunda_color_fondo: string | null
  segunda_color_secundario: string | null
  segunda_simbolos: number[] | null
  segunda_diseno_base: string | null
  segunda_imagenes_simbolos: string | null
  segunda_posiciones_logos: LogoPosition[] | null
  segunda_otros_detalles: string | null
  segunda_bolsas: boolean
  urls_prototipo_prenda: string[] | null
  urls_prototipo_segunda: string[] | null
  urls_diseno_base: string[] | null
  urls_imagenes_simbolos: string[] | null
  urls_recreacion: string[] | null
  estado: EstadoGD
  estado_turno: EstadoTurno
  disenador: string | null
  fecha_asignacion: string | null
  motivo_rechazo_diseno: string | null
  aprobacion_ventas: "APROBADO" | "NO APROBADO" | null
  imagen_aprobada_url: string | null
  comentario_aprobacion: string | null
  fecha_aprobacion: string | null
  pedido_vinculado: string | null
  total_propuestas: number
  propuestas?: GestionDisenoProposal[]
}

export const TIPOS_PRENDA_OPTIONS = [
  "Camiseta Básica",
  "Camiseta Polo",
  "Camisa",
  "Short",
  "Pantaloneta",
  "Chaqueta",
  "Sudadera",
  "Leggins",
  "Calentador",
  "Buzo",
  "Jersey",
  "Medias",
  "Otro",
] as const

export const ACCESORIOS_GD_OPTIONS = [
  "DTF",
  "VINYL",
  "Bordado",
  "Reflectivo",
  "Logo Plastificado",
  "Velcro",
  "Serigrafia",
  "Ninguno",
] as const

export const TIPOGRAFIA_GD_OPTIONS = [
  "VINYL",
  "DTF",
  "Bordado",
  "Serigrafia",
  "Ninguna",
] as const

export const ESTADO_TURNO_COLORS: Record<EstadoTurno, string> = {
  "En Ventas": "bg-blue-100 text-blue-700 border-blue-200",
  "En Diseño": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "En Cliente": "bg-purple-100 text-purple-700 border-purple-200",
  "Finalizado": "bg-emerald-100 text-emerald-700 border-emerald-200",
}

export const ESTADO_GD_COLORS: Record<EstadoGD, string> = {
  Borrador: "bg-slate-100 text-slate-600",
  "Pendiente Revision": "bg-orange-100 text-orange-700",
  "En Progreso": "bg-blue-100 text-blue-700",
  "Esperando Retroalimentacion": "bg-yellow-100 text-yellow-700",
  "Pendiente Aprobacion": "bg-indigo-100 text-indigo-700",
  Aprobado: "bg-green-100 text-green-700",
  Finalizando: "bg-teal-100 text-teal-700",
  Finalizado: "bg-emerald-100 text-emerald-700",
  Rechazado: "bg-red-100 text-red-700",
}
