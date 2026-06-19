export interface Orden {
  id: number
  pedido: string
  cliente: string
  origen: string
  vendedora: string
  fecha_de_ingreso: string
  fecha_de_entrega: string
  fecha_de_entreganueva?: string
  pcs: number
  ciudad: string
  es_urgente: boolean
  estado_aprobado_rechazado: "Pendiente" | "Aprobado" | "Rechazado" | "cancelado"
  // Motivo cuando el planner rechaza la orden
  motivo_rechazo?: string
  // Motivo cuando el planner revierte una orden rechazada a "Aprobado"
  motivo_reversion?: string
  // Si es true, la orden salta Diseno / Impresion / Sublimacion
  // (flujo reducido: solo Corte -> Costura -> Empaque)
  solo_corte_costura?: boolean
  // Si es true, la orden OMITE Corte y Costura (pero conserva Diseno,
  // Impresion, Sublimacion y Empaque). Las consultas de los modulos de
  // Corte y Costura excluyen estas ordenes para que no aparezcan en sus
  // listados. Mutuamente excluyente con solo_corte_costura.
  omite_corte_costura?: boolean
  // Tipo de flujo especial seleccionado por el planner al aprobar la orden.
  // Define que modulos de produccion deben mostrar la orden:
  //  - "PRODUCCION_NORMAL": flujo completo (default cuando es null/undefined).
  //  - "COMPRA_EXTERNA": el producto se compra terminado a un proveedor;
  //     no aparece en Diseno/Corte/Impresion/Sublimacion/Costura.
  //  - "VENTA_INVENTARIO": el producto sale de inventario terminado; aparece
  //     en Sublimacion solo si requiere aplicacion de accesorios
  //     (accesorios_inventario poblado), de lo contrario va directo a Empaque
  //     y Entregas.
  // En todos los casos la orden aparece en Entregas para que la vendedora
  // pueda gestionarla.
  tipo_flujo_especial?: TipoFlujoEspecial
  // Accesorios a aplicar cuando tipo_flujo_especial = "VENTA_INVENTARIO".
  // Se guarda como string CSV (p. ej. "DTF, VINYL, REFLECTIVO") tomado de
  // ACCESORIOS_INVENTARIO_OPTIONS. Si esta vacio o null, la orden de
  // inventario NO debe pasar por Sublimacion.
  accesorios_inventario?: string
  // Campos de informacion general
  estilo_de_la_prenda?: string
  etiqueta?: string
  empaque?: string
  accesorios?: string
  comentario_ventas?: string
  // Campos adicionales para la aprobacion
  fecha_programacion?: string
  embellecimiento?: string
  tipo_prediseno?: string
  es_marker_digital_si_no?: boolean
  personalizado_si_no?: boolean
  costura_si_no?: boolean
  maquina_costura?: string
  observaciones_planner?: string
  // Campos del modulo de Diseno
  dfecha_objetivo_d?: string
  dfecha_de_ingreso_diseno?: string
  dentrega_diseno?: string
  ddisenador?: string
  dmotivo_demora_recibido_d?: string
  dprueba_de_color_si_no?: boolean
  dlleva_cinta_si_no?: boolean
  dcheck_de_muestra_si_no?: boolean
  dcomentario_diseno?: string
  // Campos para registrar cambios (maximo 3)
  dfecha_cambio_1?: string
  dmotivo_cambio_1?: string
  dfecha_cambio_2?: string
  dmotivo_cambio_2?: string
  dfecha_cambio_3?: string
  dmotivo_cambio_3?: string
  // Campos para terminar diseno
  dmotivo_demora_terminado_d?: string
  dnota_terminado_d?: string
  // Campos del modulo de Corte
  cfecha_objetivo_c?: string
  cfecha_de_recepcion?: string
  cfecha_de_corte?: string
  cmotivo_demora_recibido_c?: string
  ccomentario_corte?: string
  // Campos para terminar corte
  cpiezas_cortadas?: number
  cpiezas_malas_o_errores?: number
  cyardas?: number
  cmotivo_demora_terminado_c?: string
  ctiempo_en_corte?: string
  csemana_de_corte?: number
  check_lleva_dtf_si_no?: boolean
  // Campos del modulo de Impresion
  ifecha_objetivo_i?: string
  ifecha_de_ingreso_imp?: string
  ientrega_impresion?: string
  iimpresora?: string
  iperfil_de_impresion?: string
  iinches?: number
  // Campos para recibir en Impresion
  icodigo_patron?: string
  ipapel?: string
  icantidad_de_la_orden?: number
  iyardas_impresion?: number
  imotivo_demora_recibido_i?: string
  icomentario_impresion?: string
  inombre_del_soporte_impresoras?: string
  // Campos para terminar impresion (entrega)
  imotivo_demora_terminado_i?: string
  icomentario_entrega_i?: string
  // Campos del modulo de Sublimacion
  sfecha_objetivo_s?: string
  sfecha_de_ingreso_sub?: string
  seta_sublimacion?: string
  // Campos para recibir en Sublimacion
  smotivo_demora_recibido_s?: string
  scomentario_sublimacion?: string
  // Campos para terminar sublimacion
  stiempo_sublimacion?: string
  stemperatura?: number
  svelocidad?: number
  scantidad_sublimada?: number
  serrores?: string
  saprobacion_cliente_si_no?: boolean
  smotivo_demora_terminado_s?: string
  scomentario_entrega_s?: string
  // URL publica de la firma virtual capturada cuando Costura recibe la
  // sublimacion (PNG almacenado en el bucket `firmas-procesos`).
  // Se llena al confirmar "Entregar Sublimacion" y se muestra en el
  // detalle de Sublimacion y Costura como evidencia de transferencia.
  s_firma_recibe_costura?: string
  // Total acumulado de piezas entregadas por Sublimacion via entregas
  // parciales (suma de cantidades en telas.entregas_parciales_sublimacion).
  // Se actualiza incrementalmente cada vez que se registra una entrega
  // parcial. Funciona como gate del boton "Terminar": solo cuando este
  // valor >= pcs (total de la orden) se habilita el cierre con firma.
  s_pcs_entregados_acumulado?: number
  // Estado del flujo de entregas de Sublimacion hacia Costura.
  //  - 'Pendiente': aun no se ha registrado ninguna entrega parcial.
  //  - 'Parcial': al menos una entrega parcial fue registrada pero el
  //    total aun no se ha completado.
  //  - 'Completado': el total de piezas fue entregado (se habilita
  //    "Recibir Completo" en Costura).
  s_estado_entrega?: "Pendiente" | "Parcial" | "Completado"
  // Fecha de la primera entrega parcial de Sublimacion a Costura.
  // Se registra automaticamente al guardar la primera entrega parcial.
  s_fecha_entrega_parcial?: string
  // Fecha en la que Costura recibe parcialmente desde Sublimacion.
  // Se actualiza al presionar "Recibir Parcial" en el modulo de Costura.
  cos_fecha_recibo_parcial?: string
  // Campos del modulo de Costura
  cosfecha_objetivo_cs?: string
  cosfecha_conteo?: string
  coseta_costura?: string
  cosnombre_de_persona_que_conto?: string
  cosnombre_maquilador?: string
  // Campos para recibir en Costura
  coscantidad_contada?: number
  // Motivo de demora / novedad capturado al RECIBIR la carga en Costura.
  // Las opciones vienen de telas.motivos_demora_costura_rec
  // (p. ej. "Recibiendo incompleto", "Recibiendo Parcial").
  cos_motivo_demora_rec?: string
  // Comentario libre del supervisor al momento de recibir la carga.
  // Se muestra en el detalle de Costura para dejar evidencia de las
  // condiciones bajo las cuales se acepto el trabajo.
  cos_comentario_recibo?: string
  cosfecha_entrega_a_maquilador?: string
  cosproceso_maquilado?: string
  cosfecha_recepcion_maquilador?: string
  cosnovedad_de_costura?: string
  coscantidad_costurada?: number
  cosmotivo_demora_recibido_cs?: string
  coscomentario_costura?: string
  // Campos para terminar costura (entrega)
  cosmotivo_demora_terminado_cs?: string
  coscomentario_entrega_cs?: string
  // Campos del modulo de Empaque
  efecha_objetivo_e?: string
  efecha_de_empaque?: string
  enombre_de_quien_empaca?: string
  // Campos para recibir en Empaque
  edia_de_entrega?: string
  emotivo_demora_recibido_e?: string
  // Comentario libre al momento de recibir la orden en Empaque.
  ecomentario_recibo_emp?: string
  // Campos para terminar empaque (entrega final)
  emotivo_demora_terminado_e?: string
  ecomentario_entrega_e?: string
  ecantidad_empacada?: number
  // URL publica de la firma virtual capturada cuando la vendedora recibe
  // el pedido empacado. Se almacena en el bucket `firmas-procesos` y se
  // muestra en el detalle de Empaque y Entregas como evidencia de la
  // transferencia Empaque -> Ventas.
  e_firma_recibe_vendedora?: string
  // Campos del modulo de Entregas (vendedoras)
  entregado_cliente_si_no?: boolean
  fecha_entrega_cliente?: string
  comentario_entrega_cliente?: string
  // URL publica de la firma virtual capturada al momento de la entrega
  // (imagen PNG almacenada en el bucket `firmas-entregas`).
  firma_url?: string
  // URL publica de la guia de envio opcional (imagen .jpg/.png o PDF)
  // almacenada en el bucket `guias-envio`. Se adjunta opcionalmente al
  // momento de registrar la entrega al cliente.
  guia_envio_url?: string
  // Campos provistos por la vista telas.vista_seguimiento_comercial
  porcentaje_avance?: number
  estado_produccion?: string
}

export const PAPEL_OPTIONS = ["Qualitex", "Orange", "Jet X"] as const

export interface Disenador {
  id?: number
  nombre: string
}

export interface MotivoDemora {
  id?: number
  motivo: string
}

export const EMBELLECIMIENTO_OPTIONS = [
  "Bordado",
  "DTF",
  "Reflectivo",
  "Velcro",
  "Vinyl",
  "Yardaje sin costura",
  "Serigrafia",
  "Logo plastificado",
] as const

export const TIPO_PREDISENO_OPTIONS = [
  "Diseno Nuevo",
  "Prediseno",
  "Diseno por el cliente - editable",
  "Recreacion del diseno",
  "Prediseno con Cambios",
  "Disenor de Propuesta",
  "N/A",
] as const

export const MAQUINA_COSTURA_OPTIONS = ["Plana", "Sorgete"] as const

/**
 * Tipos de flujo especial que el planner puede asignar al aprobar una
 * orden. El valor se almacena en cabecera.tipo_flujo_especial y los
 * contextos de produccion lo usan para decidir si la orden aparece o no
 * en sus listados.
 */
export type TipoFlujoEspecial =
  | "PRODUCCION_NORMAL"
  | "COMPRA_EXTERNA"
  | "VENTA_INVENTARIO"
  | "YARDAJE"

export const TIPO_FLUJO_ESPECIAL_OPTIONS: ReadonlyArray<{
  value: TipoFlujoEspecial
  label: string
  description: string
}> = [
  {
    value: "PRODUCCION_NORMAL",
    label: "Produccion Normal",
    description: "Flujo completo: Diseno, Corte, Impresion, Sublimacion, Costura, Empaque y Entregas.",
  },
  {
    value: "YARDAJE",
    label: "Yardaje",
    description: "Diseno, Impresion y Sublimacion primero; luego Corte, Costura, Empaque y Entrega.",
  },
  {
    value: "COMPRA_EXTERNA",
    label: "Compra Externa",
    description: "Producto comprado terminado a un proveedor. Solo aparece en Entregas.",
  },
  {
    value: "VENTA_INVENTARIO",
    label: "Venta de Inventario Terminado",
    description: "Producto desde inventario. Pasa por Sublimacion solo si requiere accesorios.",
  },
] as const

/**
 * Accesorios disponibles para aplicar a una orden de Venta de Inventario.
 * El planner marca uno o varios; se guardan como CSV en
 * cabecera.accesorios_inventario.
 */
export const ACCESORIOS_INVENTARIO_OPTIONS = [
  "DTF",
  "VINYL",
  "LOGO EMBLEMA 3R",
  "REFLECTIVO",
  "OTROS",
] as const

// Fila de la vista telas.vista_control_produccion
// Esta vista alimenta el Dashboard de Coordinacion de Produccion.
// Estados por area que emite la vista telas.vista_control_produccion.
//  - "Terminado": el area ya cerro la orden.
//  - "Recibido": el area tiene la orden en mesa trabajandola.
//  - "Pendiente": el area anterior ya entrego pero esta NO ha recibido aun
//    (cuello de botella tipico: el sublimador no ha presionado "Recibir").
//  - "En espera": la orden viene en camino; todavia esta en un area previa y
//    esta area no puede tocarla todavia.
export type StatusArea =
  | "Terminado"
  | "Recibido"
  | "Pendiente"
  | "En espera"
export type NivelRiesgo =
  | "Vencido"
  | "Riesgo Critico"
  | "Riesgo Medio"
  | "A Tiempo"

export interface VistaControlProduccion {
  pedido: string
  cliente: string
  pcs: number
  es_urgente: boolean
  fecha_de_entrega: string | null

  // Estados por area
  status_diseno?: StatusArea | null
  status_corte?: StatusArea | null
  status_impresion?: StatusArea | null
  status_sublimacion?: StatusArea | null
  status_costura?: StatusArea | null
  status_empaque?: StatusArea | null

  // Fechas de fin por area
  fecha_fin_diseno?: string | null
  fecha_fin_corte?: string | null
  fecha_fin_impresion?: string | null
  fecha_fin_sublimacion?: string | null
  fecha_fin_costura?: string | null
  fecha_fin_empaque?: string | null

  // Lead times por area (dias)
  dias_en_diseno?: number | null
  dias_en_corte?: number | null
  dias_en_impresion?: number | null
  dias_en_sublimacion?: number | null
  dias_en_costura?: number | null

  // Riesgo
  dias_para_entrega?: number | null
  nivel_riesgo?: NivelRiesgo | null

  // Estado de entrega al cliente. Cuando es "Completado" la orden ya
  // salio de la planta y no debe contar en KPIs activos del dashboard.
  s_estado_entrega?: "Pendiente" | "Parcial" | "Completado" | null
}

/**
 * Fila de la tabla telas.entregas_parciales_sublimacion.
 * Cada registro representa una entrega parcial de piezas por parte del
 * sublimador hacia Costura. Permite trazar el flujo "por partes" de una
 * orden grande que se entrega en multiples viajes durante el dia.
 *
 * Campos asumidos (segun convencion del sistema):
 *   - id: PK auto-generado por Supabase.
 *   - pedido: FK al numero de pedido en telas.cabecera.
 *   - cantidad: numero de piezas entregadas en este movimiento.
 *   - fecha: timestamp de la entrega (default now() en BD).
 */
export interface EntregaParcialSublimacion {
  id?: number
  pedido: string
  cantidad: number
  fecha?: string
}

export interface DetalleOrden {
  id: number
  id2: string
  pedido: string
  nombre: string
  tela: string
  genero: string
  estilo: string
  talla: string
  pcs: number
  comentarios: string | null
  pcs_empacados?: number | null
}
