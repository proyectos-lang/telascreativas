# Supabase Schema — Telas Creativas

Schema de referencia para las tablas y vistas del proyecto.
Base de datos: `telas` (schema Supabase).

---

## Tablas BASE

### `cabecera` — Pedidos (tabla principal)
Columna central del sistema; cada fila es un pedido/orden de producción.

| Campo | Tipo | Notas |
|---|---|---|
| pedido | text NOT NULL | PK lógica |
| cliente | text | |
| origen | text | |
| numero_de_orden | text | |
| pcs | numeric | Piezas totales |
| vendedora | text | |
| etiqueta | text | |
| empaque | text | |
| accesorios | text | |
| estilo_de_la_prenda | text | |
| fecha_de_ingreso | date | |
| hora_ingreso | time | |
| fecha_de_entrega | date | Fecha de entrega original |
| ciudad | text | |
| comentario_ventas | text | |
| fecha_programacion | date | |
| estado_aprobado_rechazado | text | "Pendiente" / "Aprobado" / "Rechazado" / "cancelado" |
| es_marker_digital_si_no | boolean | |
| observaciones_planner | text | |
| embellecimiento | text | |
| costura_si_no | boolean | |
| maquina_costura | text | "Plana" / "Sorgete" |
| personalizado_si_no | boolean | |
| fecha_de_entreganueva | date | Segunda fecha de entrega |
| motivo_fecha_2 | text | |
| es_urgente | boolean | |
| tipo_flujo_especial | text | "PRODUCCION_NORMAL" / "COMPRA_EXTERNA" / "VENTA_INVENTARIO" / "YARDAJE" |
| accesorios_inventario | text | CSV de accesorios para VENTA_INVENTARIO |
| solo_corte_costura | boolean | Salta Diseño/Impresión/Sublimación |
| omite_corte_costura | boolean | Omite Corte y Costura; mutuamente excluyente con solo_corte_costura |
| firma_url | text | URL firma entrega cliente |
| guia_envio_url | text | URL guía de envío |
| entregado_cliente_si_no | boolean | |
| fecha_entrega_cliente | date | |
| comentario_entrega_cliente | text | |
| motivo_rechazo | text | |
| motivo_reversion | text | |
| **Módulo Diseño (prefijo `d`)** | | |
| dfecha_de_ingreso_diseno | date | |
| dentrega_diseno | date | |
| ddisenador | text | |
| des_predisenado | boolean | |
| dcheck_de_muestra_si_no | boolean | |
| dfecha_de_entrega_de_muestra | date | |
| dcomentario_diseno | text | |
| dprueba_de_color_si_no | boolean | |
| dprueba_de_color_si_no_2 | boolean | |
| dlleva_cinta_si_no | boolean | |
| dfecha_cambio_1/2/3 | date | Cambios de diseño |
| dmotivo_cambio_1/2/3 | text | |
| dmotivo_demora_recibido_d | text | |
| dmotivo_demora_terminado_d | text | |
| dnota_terminado_d | text | |
| dfecha_objetivo_d | date | |
| **Módulo Corte (prefijo `c`)** | | |
| cfecha_de_recepcion | date | |
| cfecha_de_corte | date | |
| cpiezas_cortadas | integer | |
| cpiezas_malas_o_errores | integer | |
| cyardas | numeric | |
| ctiempo_en_corte | text | |
| ccomentario_corte | text | |
| csemana_de_corte | text | |
| check_lleva_dtf_si_no | boolean | |
| cmotivo_demora_recibido_c | text | |
| cmotivo_demora_terminado_c | text | |
| cfecha_objetivo_c | date | |
| **Módulo Impresión (prefijo `i`)** | | |
| ifecha_de_ingreso_imp | date | |
| ientrega_impresion | date | |
| icodigo_patron | text | |
| iimpresora | text | |
| inombre_del_soporte_impresoras | text | |
| iperfil_de_impresion | text | |
| ipapel | text | "Qualitex" / "Orange" / "Jet X" |
| icantidad_de_la_orden | integer | |
| iinches | numeric | |
| iyardas_impresion | numeric | |
| ihoras_de_impresion_1_4_mt_x_min | numeric | |
| iyardas_aprox | numeric | |
| icomentario_impresion | text | |
| imotivo_demora_recibido_i | text | |
| imotivo_demora_terminado_i | text | |
| ifecha_objetivo_i | date | |
| icomentario_entrega_i | text | |
| **Módulo Sublimación (prefijo `s`)** | | |
| sfecha_de_ingreso_sub | date | |
| seta_sublimacion | date | |
| stiempo_sublimacion | text | |
| scausa_actual | text | |
| stemperatura | numeric | |
| svelocidad | numeric | |
| scantidad_sublimada | numeric | |
| scomentario_sublimacion | text | |
| saprobacion_cliente_si_no | boolean | |
| serrores | text | |
| smotivo_demora_recibido_s | text | |
| smotivo_demora_terminado_s | text | |
| sfecha_objetivo_s | date | |
| scomentario_entrega_s | text | |
| s_firma_recibe_costura | text | URL firma transferencia Sublimación→Costura |
| s_pcs_entregados_acumulado | numeric | Acumulado entregas parciales |
| s_estado_entrega | text | "Pendiente" / "Parcial" / "Completado" |
| s_fecha_entrega_parcial | timestamptz | Primera entrega parcial |
| **Módulo Costura (prefijo `cos`)** | | |
| costrabajo_recibido | text | |
| cosfecha_conteo | date | |
| coscantidad_contada | integer | |
| cosnombre_de_persona_que_conto | text | |
| cosfecha_entrega_a_maquilador | date | |
| cosnombre_maquilador | text | |
| cosproceso_maquilado | text | |
| cosfecha_recepcion_maquilador | date | |
| coseta_costura | date | |
| cosnovedad_de_costura | text | |
| cosautoriza_tolerancia | boolean | |
| cosfecha_objetivo_cs | date | |
| coscantidad_costurada | integer | |
| coscomentario_costura | text | |
| cosmotivo_demora_recibido_cs | text | |
| cosmotivo_demora_terminado_cs | text | |
| coscomentario_entrega_cs | text | |
| cos_comentario_recibo | text | |
| cos_fecha_recibo_parcial | timestamptz | |
| **Módulo Empaque (prefijo `e`)** | | |
| efecha_de_empaque | date | |
| ecantidad_empacada | integer | |
| enombre_de_quien_empaca | text | |
| efecha_objetivo_e | date | |
| edia_de_entrega | date | |
| emotivo_demora_recibido_e | text | |
| emotivo_demora_terminado_e | text | |
| ecomentario_entrega_e | text | |
| ecomentario_recibo_emp | text | |
| e_firma_recibe_vendedora | text | URL firma transferencia Empaque→Vendedora |
| tipo_prediseno | text | |

---

### `detalleorden` — Líneas de producto por pedido
| Campo | Tipo |
|---|---|
| id | numeric NOT NULL |
| id2 | uuid NOT NULL |
| pedido | text |
| numero_de_orden | text |
| pcs | text |
| nombre | text |
| tela | text |
| genero | text |
| estilo | text |
| talla | text |
| cliente | text |
| origen | text |
| comentarios | text |
| pcs_empacados | numeric |

---

### `usuarios`
| Campo | Tipo |
|---|---|
| email | text NOT NULL (PK) |
| nombre | text NOT NULL |
| cargo | text NOT NULL |
| area | text NOT NULL |
| password | text NOT NULL |
| mod_inicio | boolean |
| mod_programacion | boolean |
| mod_diseno | boolean |
| mod_corte | boolean |
| mod_impresion | boolean |
| mod_sublimacion | boolean |
| mod_costura | boolean |
| mod_empaque | boolean |
| mod_entregas | boolean |
| mod_admin | boolean |
| solo_lectura_empaque | boolean |
| dashboard_dia | boolean |
| reporte_incidencias | boolean |
| inventario | boolean |
| plansemanal | boolean |
| indicadores | boolean |

---

### `incidencias`
| Campo | Tipo |
|---|---|
| id | integer NOT NULL (PK) |
| pedido | text NOT NULL |
| area_reporta | text NOT NULL |
| area_genera | text NOT NULL |
| descripcion | text NOT NULL |
| genera_reposicion | boolean |
| partes_reposicion | text |
| estado_reposicion | text |
| fecha_reporte | timestamp |
| fecha_procesado | timestamp |
| talla | text |
| genero | text |
| motivo_especifico | text |
| procesos_reposicion | ARRAY |

---

### `entregas_parciales_sublimacion`
| Campo | Tipo |
|---|---|
| id | integer NOT NULL (PK) |
| pedido | text NOT NULL |
| cantidad | numeric NOT NULL |
| fecha_entrega | timestamp |
| usuario | text |
| producto_detalle | text |
| detalle_id | text |

---

### `inventario_telas`
| Campo | Tipo |
|---|---|
| id | integer NOT NULL (PK) |
| tipo | text NOT NULL |
| nombre | text NOT NULL |
| ancho_pulgadas | numeric NOT NULL |
| stock_metros | numeric |
| stock_yardas | numeric |
| fecha_creacion | timestamptz |
| color | text |
| codigo | text |
| proveedor | text |
| referencia_cliente | text |

---

### `inventario_movimientos`
| Campo | Tipo |
|---|---|
| id | integer NOT NULL (PK) |
| tela_id | integer |
| tipo_movimiento | text NOT NULL |
| motivo | text |
| usuario | text |
| fecha_movimiento | timestamptz |
| cantidad_metros | numeric |
| cantidad_yardas | numeric |

---

### Tablas de catálogos (solo `id` + `nombre`)
- `contadores` — contadores del sistema
- `disenadores` — diseñadores disponibles
- `embellecimientos`
- `empacadores`
- `impresoras`
- `motivos_demora`
- `motivos_demora_costura_rec`
- `motivos_demora_diseno`
- `motivos_demora_impresion_rec`
- `perfiles_impresion`
- `soportes_impresion`
- `tipos_papel`
- `tipos_prediseno`

---

## Vistas

### `vista_control_produccion`
Dashboard de coordinación de producción.

| Campo | Tipo | Notas |
|---|---|---|
| pedido | text | |
| cliente | text | |
| fecha_de_entrega | date | |
| pcs | numeric | |
| es_urgente | boolean | |
| solo_corte_costura | boolean | |
| omite_corte_costura | boolean | |
| tipo_flujo_especial | text | |
| accesorios_inventario | text | |
| s_estado_entrega | text | |
| status_diseno | text | "Terminado"/"Recibido"/"Pendiente"/"En espera" |
| status_impresion | text | ídem |
| status_sublimacion | text | ídem |
| status_corte | text | ídem |
| status_costura | text | ídem |
| status_empaque | text | ídem |
| fecha_fin_diseno | date | |
| fecha_fin_corte | date | |
| fecha_fin_impresion | date | |
| fecha_fin_sublimacion | date | |
| fecha_fin_costura | date | |
| fecha_fin_empaque | date | |
| dias_en_diseno | integer | |
| dias_en_corte | integer | |
| dias_en_impresion | integer | |
| dias_en_sublimacion | integer | |
| dias_en_costura | integer | |
| dias_para_entrega | integer | |
| nivel_riesgo | text | "Vencido"/"Riesgo Crítico"/"Riesgo Medio"/"A Tiempo" |

---

### `vista_seguimiento_comercial`
| Campo | Tipo |
|---|---|
| pedido | text |
| cliente | text |
| vendedora | text |
| fecha_de_ingreso | date |
| fecha_de_entrega | date |
| total_pcs | numeric |
| ciudad | text |
| es_urgente | boolean |
| estado_produccion | text |
| porcentaje_avance | integer |

---

### `vista_plan_semanal`
| Campo | Tipo |
|---|---|
| ano_entrega | integer |
| semana_ano | integer |
| fecha_de_entrega | date |
| pedido | text |
| cliente | text |
| vendedora | text |
| disenador | text |
| maquina_costura | text |
| estilo_de_la_prenda | text |
| pcs | numeric |
| tipo_flujo_especial | text |
| costura_si_no | boolean |
| solo_corte_costura | boolean |
| omite_corte_costura | boolean |
| accesorios_inventario | text |
| estado_aprobado_rechazado | text |
| fin_diseno | date |
| fin_impresion | date |
| fin_sublimacion | date |
| fin_corte | date |
| fin_costura | date |
| fin_empaque | date |
| fin_entrega_cliente | date |
| estatus_actual | text |

---

### `vista_estadisticas_incidencias`
| Campo | Tipo |
|---|---|
| area_reporta | text |
| area_responsable | text |
| estado | text |
| motivo_especifico | text |
| genero | text |
| talla | text |
| fecha_dia | timestamp |
| fecha_mes | timestamp |
| total_incidencias | bigint |
| tiempo_promedio_respuesta | interval |

---

### `vista_kpi_adherencia`
| Campo | Tipo |
|---|---|
| ano | integer |
| mes | integer |
| semana | integer |
| total_ordenes | bigint |
| adherencia_diseno | numeric |
| adherencia_impresion | numeric |
| adherencia_sublimacion | numeric |
| adherencia_corte | numeric |
| adherencia_costura | numeric |
| adherencia_empaque | numeric |
| cumplidos_global | bigint |
| adherencia_global | numeric |

---

### `vista_kpi_diseno`
| Campo | Tipo |
|---|---|
| ano | integer |
| mes | integer |
| semana | integer |
| disenador | text |
| diseños_entregados | bigint |
| porcentaje_alcance | numeric |
| bono_ganado | integer |
| total_incidencias | bigint |
| entregas_a_tiempo | bigint |
| porcentaje_cumplimiento | numeric |

---

### `vista_kpi_lead_times`
| Campo | Tipo |
|---|---|
| ano | integer |
| mes | integer |
| semana | integer |
| lead_time_global_promedio | numeric |
| dias_en_diseno | numeric |
| dias_en_impresion | numeric |
| dias_en_sublimacion | numeric |
| dias_en_corte | numeric |
| dias_en_costura | numeric |
| dias_en_empaque | numeric |
| cola_diseno_a_impresion | numeric |
| cola_impresion_a_sublimacion | numeric |
| cola_sublimacion_a_corte | numeric |
| cola_corte_a_costura | numeric |
| cola_costura_a_empaque | numeric |

---

### `vista_kpi_reprocesos`
| Campo | Tipo |
|---|---|
| ano | integer |
| mes | integer |
| semana | integer |
| area_responsable | text |
| total_piezas_entregadas | numeric |
| cantidad_incidencias_reportadas | bigint |
| porcentaje_calidad_cumplimiento | numeric |
| top_parte_afectada | text |
| top_talla_error | text |
| top_genero_error | text |
| top_motivo_critico | text |

---

## Flujos de producción

```
PRODUCCION_NORMAL:  Diseño → Impresión → Sublimación → Corte → Costura → Empaque → Entrega
YARDAJE:            Diseño → Impresión → Sublimación → Corte → Costura → Empaque → Entrega
SOLO_CORTE_COSTURA: Corte → Costura → Empaque → Entrega
OMITE_CORTE_COSTURA: Diseño → Impresión → Sublimación → Empaque → Entrega
COMPRA_EXTERNA:     (solo) Entrega
VENTA_INVENTARIO:   [Sublimación si accesorios_inventario != null] → Empaque → Entrega
```

## Estados por área (`status_*`)
- `"En espera"` — orden en área previa, esta área no puede tocarla aún
- `"Pendiente"` — área anterior ya entregó pero esta NO ha recibido (cuello de botella)
- `"Recibido"` — área tiene la orden en mesa, trabajándola
- `"Terminado"` — área cerró la orden

## Nivel de riesgo (`nivel_riesgo`)
- `"Vencido"` / `"Riesgo Crítico"` / `"Riesgo Medio"` / `"A Tiempo"`
