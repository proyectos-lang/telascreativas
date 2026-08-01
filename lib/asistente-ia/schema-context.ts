/**
 * Contexto de esquema (data dictionary condensado) que se inyecta al agente
 * de IA como parte del system prompt. Derivado de SUPABASE_SCHEMA.md.
 *
 * IMPORTANTE: NO incluye la tabla `usuarios` (contiene password en texto plano
 * y está bloqueada en la función ia_run_select).
 *
 * Todo vive en el schema Postgres `telas`. En las consultas SELECT se debe
 * referenciar con el prefijo del schema, p. ej. `telas.cabecera`,
 * `telas.vista_control_produccion`.
 */
export const SCHEMA_CONTEXT = `
# Esquema de datos — Telas Creativas (schema Postgres: telas)

Todas las consultas van contra el schema \`telas\`. Usa SIEMPRE el prefijo del
schema: \`telas.<tabla_o_vista>\`. Solo puedes hacer SELECT (lectura).

## Vistas de reporte (PREFIERE ESTAS para estado y eficiencia)

### telas.vista_control_produccion — estado de coordinación por pedido
Columnas: pedido, cliente, fecha_de_entrega (date), pcs (numeric), es_urgente (bool),
solo_corte_costura, omite_corte_costura, tipo_flujo_especial, accesorios_inventario,
s_estado_entrega, status_diseno, status_impresion, status_sublimacion, status_corte,
status_costura, status_empaque (cada status: "Terminado"/"Recibido"/"Pendiente"/"En espera"),
fecha_fin_diseno/corte/impresion/sublimacion/costura/empaque (date),
dias_en_diseno/corte/impresion/sublimacion/costura (int), dias_para_entrega (int),
nivel_riesgo ("Vencido"/"Riesgo Crítico"/"Riesgo Medio"/"A Tiempo").
Uso típico: "¿qué pedidos están pendientes / en riesgo / vencidos?", cuellos de botella por área.

### telas.vista_plan_semanal — plan por semana de entrega
Columnas: ano_entrega (int), semana_ano (int), fecha_de_entrega, pedido, cliente, vendedora,
disenador, maquina_costura, estilo_de_la_prenda, pcs, tipo_flujo_especial, costura_si_no,
solo_corte_costura, omite_corte_costura, accesorios_inventario, estado_aprobado_rechazado,
fin_diseno/impresion/sublimacion/corte/costura/empaque (date), fin_entrega_cliente,
estatus_actual.

### telas.vista_lead_times_unificado — una fila por pedido, eficiencia de tiempos
Columnas: pedido, cliente, vendedora, ciudad, estilo_de_la_prenda, pcs, es_urgente,
entregado_cliente_si_no, estado_aprobado_rechazado, s_estado_entrega,
fecha_de_ingreso, fecha_de_entrega, fecha_entrega_cliente,
dias_en_diseno/corte/impresion/sublimacion/costura (int: fin − recepción; si la etapa no
terminó y la orden está vigente, es CURRENT_DATE − recepción = tiempo en curso; NULL si no aplica),
diseno_en_curso/corte_en_curso/impresion_en_curso/sublimacion_en_curso/costura_en_curso (bool),
lead_time_global (int: fecha_entrega_cliente − fecha_de_ingreso),
en_proceso (bool: Aprobado AND efecha_de_empaque IS NULL), cerrado (bool).
Uso típico: análisis de lead times y eficiencia por área.

### telas.vista_seguimiento_comercial
pedido, cliente, vendedora, fecha_de_ingreso, fecha_de_entrega, total_pcs, ciudad,
es_urgente, estado_produccion, porcentaje_avance (int).

### telas.vista_estadisticas_incidencias
area_reporta, area_responsable, estado, motivo_especifico, genero, talla, fecha_dia,
fecha_mes, total_incidencias (bigint), tiempo_promedio_respuesta (interval).

### KPIs pre-agregados (por ano / mes / semana)
- telas.vista_kpi_adherencia: total_ordenes, adherencia_diseno/impresion/sublimacion/corte/costura/empaque (numeric %), cumplidos_global, adherencia_global.
- telas.vista_kpi_diseno: disenador, "diseños_entregados", porcentaje_alcance, bono_ganado, total_incidencias, entregas_a_tiempo, porcentaje_cumplimiento.
- telas.vista_kpi_lead_times: lead_time_global_promedio, dias_en_<area>, cola_<areaA>_a_<areaB> (tiempos de cola entre áreas).
- telas.vista_kpi_reprocesos: area_responsable, total_piezas_entregadas, cantidad_incidencias_reportadas, porcentaje_calidad_cumplimiento, top_parte_afectada, top_talla_error, top_genero_error, top_motivo_critico.

## Tablas base

### telas.cabecera — pedidos (tabla central, una fila por orden)
Identidad/comercial: pedido (PK lógica, text), cliente, origen, numero_de_orden, pcs (numeric),
vendedora, estilo_de_la_prenda, fecha_de_ingreso (date), fecha_de_entrega (date),
fecha_de_entreganueva (2da fecha), ciudad, estado_aprobado_rechazado
("Pendiente"/"Aprobado"/"Rechazado"/"cancelado"), es_urgente (bool),
tipo_flujo_especial ("PRODUCCION_NORMAL"/"COMPRA_EXTERNA"/"VENTA_INVENTARIO"/"YARDAJE"),
accesorios_inventario, solo_corte_costura (bool), omite_corte_costura (bool), costura_si_no (bool),
maquina_costura, entregado_cliente_si_no (bool), fecha_entrega_cliente (date),
motivo_rechazo, motivo_reversion.
Reposición manual: pendiente_reposicion (bool), area_reposicion (text), fecha_pendiente_reposicion (timestamptz).
Fechas/estado por módulo (prefijos): Diseño d* (dfecha_de_ingreso_diseno, dentrega_diseno, ddisenador),
Corte c* (cfecha_de_recepcion, cfecha_de_corte, cpiezas_cortadas, cyardas),
Impresión i* (ifecha_de_ingreso_imp, ientrega_impresion, iyardas_impresion),
Sublimación s* (sfecha_de_ingreso_sub, seta_sublimacion, s_estado_entrega ["Pendiente"/"Parcial"/"Completado"], s_pcs_entregados_acumulado),
Costura cos* (cosfecha_conteo, coseta_costura, coscantidad_costurada),
Empaque e* (efecha_de_empaque, ecantidad_empacada, enombre_de_quien_empaca, edia_de_entrega).
Regla: una etapa está "terminada" cuando su fecha de fin (p. ej. dentrega_diseno, cfecha_de_corte,
ientrega_impresion, seta_sublimacion, coseta_costura, efecha_de_empaque) NO es NULL.

### telas.detalleorden — líneas de producto por pedido (BASE para tallaje / tela / producto)
Columnas: id (numeric), id2 (uuid), pedido, numero_de_orden,
pcs (TEXT — cantidad de piezas de esa línea; para sumar castea así:
  nullif(regexp_replace(pcs, '[^0-9.]', '', 'g'), '')::numeric),
nombre (producto), tela (tipo de tela), genero, estilo, talla (texto libre: S/M/L/XL, 8/10/12, etc.),
cliente, origen, comentarios, pcs_empacados (numeric).
Hay una fila por combinación producto/talla de un pedido. Es la FUENTE para:
- Curvas de tallaje: SUM(pcs casteado) agrupado por talla.
- Análisis por tipo de tela: agrupar por tela.
- Análisis por producto: agrupar por nombre y/o estilo.
Se une con la cabecera por pedido: telas.detalleorden.pedido = telas.cabecera.pedido
(para filtrar por fechas o ver históricos usa telas.cabecera.fecha_de_ingreso / fecha_de_entrega,
o date_trunc('month', c.fecha_de_ingreso) para agrupar por periodo).

### telas.incidencias — incidencias de calidad / reposiciones
id (PK), pedido, area_reporta, area_genera, descripcion, genera_reposicion (bool),
estado_reposicion ("Pendiente"/"Procesado"), fecha_reporte, fecha_procesado, talla, genero,
motivo_especifico, procesos_reposicion (array).

### telas.inventario_telas — inventario de telas
id, tipo, nombre, ancho_pulgadas, stock_metros, stock_yardas, color, codigo, proveedor, referencia_cliente.
### telas.inventario_movimientos
id, tela_id, tipo_movimiento, motivo, usuario, fecha_movimiento, cantidad_metros, cantidad_yardas.

## Flujos de producción (por tipo_flujo_especial)
- PRODUCCION_NORMAL / YARDAJE: Diseño → Impresión → Sublimación → Corte → Costura → Empaque → Entrega
- SOLO_CORTE_COSTURA (solo_corte_costura=true): Corte → Costura → Empaque → Entrega
- OMITE_CORTE_COSTURA (omite_corte_costura=true): Diseño → Impresión → Sublimación → Empaque → Entrega
- COMPRA_EXTERNA: solo Entrega
- VENTA_INVENTARIO: [Sublimación si accesorios_inventario != null] → Empaque → Entrega

## Estados por área (status_*): "En espera" | "Pendiente" (cuello de botella) | "Recibido" | "Terminado"
## Nivel de riesgo (nivel_riesgo): "Vencido" | "Riesgo Crítico" | "Riesgo Medio" | "A Tiempo"
`.trim()
