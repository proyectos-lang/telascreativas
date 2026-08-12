/**
 * Catálogo de permisos de telas.usuarios usado por el módulo de Configuración
 * (UI) y por el endpoint server (whitelist de columnas booleanas a actualizar).
 */
export interface PermisoDef {
  key: string
  label: string
  grupo: string
}

export const PERMISOS: PermisoDef[] = [
  { key: "mod_admin", label: "Administrador", grupo: "Administración" },

  { key: "mod_inicio", label: "Inicio", grupo: "Operaciones" },
  { key: "mod_programacion", label: "Programación", grupo: "Operaciones" },
  { key: "mod_diseno", label: "Diseño", grupo: "Operaciones" },
  { key: "mod_corte", label: "Corte", grupo: "Operaciones" },
  { key: "mod_impresion", label: "Impresión", grupo: "Operaciones" },
  { key: "mod_sublimacion", label: "Sublimación", grupo: "Operaciones" },
  { key: "mod_costura", label: "Costura", grupo: "Operaciones" },
  { key: "mod_empaque", label: "Empaque", grupo: "Operaciones" },
  { key: "solo_lectura_empaque", label: "Empaque (solo lectura)", grupo: "Operaciones" },
  { key: "mod_entregas", label: "Entregas", grupo: "Operaciones" },

  { key: "dashboard_dia", label: "Resumen Día", grupo: "Reportes" },
  { key: "reporte_incidencias", label: "Reporte de Incidencias", grupo: "Reportes" },
  { key: "indicadores", label: "Indicadores", grupo: "Reportes" },
  { key: "mod_capacidad", label: "Capacidad (comercial)", grupo: "Reportes" },

  { key: "gd_ventas", label: "Gestión Diseños — Ventas", grupo: "Gestión de Diseños" },
  { key: "gd_diseno", label: "Gestión Diseños — Diseño", grupo: "Gestión de Diseños" },
  { key: "gd_admin", label: "Gestión Diseños — Admin", grupo: "Gestión de Diseños" },

  { key: "asistente_ia", label: "Asistente IA", grupo: "IA" },

  { key: "mod_comunicaciones", label: "Acceso a Comunicaciones (chat / tareas / noticias)", grupo: "Comunicaciones Internas" },
  { key: "com_publicar_noticias", label: "Publicar Noticias", grupo: "Comunicaciones Internas" },
]

export const PERMISO_KEYS = PERMISOS.map((p) => p.key)

export const GRUPOS_PERMISO = Array.from(new Set(PERMISOS.map((p) => p.grupo)))
