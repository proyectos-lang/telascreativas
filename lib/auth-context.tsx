"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const STORAGE_KEY = "usuarioActual"
const EMAIL_DOMAIN = "@telas.com"

export interface UsuarioActual {
  email?: string
  nombre?: string
  cargo?: string
  area?: string
  // Permisos por modulo — coinciden 1:1 con las columnas de telas.usuarios.
  // Un campo ausente/null se trata como false (sin acceso).
  mod_inicio?: boolean | null
  mod_programacion?: boolean | null
  mod_diseno?: boolean | null
  mod_corte?: boolean | null
  mod_impresion?: boolean | null
  mod_sublimacion?: boolean | null
  mod_costura?: boolean | null
  mod_empaque?: boolean | null
  mod_entregas?: boolean | null
  mod_admin?: boolean | null
  solo_lectura_empaque?: boolean | null
  // Acceso al modulo "Resumen Dia" (reporte diario por area).
  // Coincide con la columna telas.usuarios.dashboard_dia.
  dashboard_dia?: boolean | null
  // Acceso al modulo "Reporte de Incidencias" (dashboard analitico).
  // Coincide con la columna telas.usuarios.reporte_incidencias.
  reporte_incidencias?: boolean | null
  // Acceso al modulo "Dashboard de Indicadores" (KPIs operativos).
  // Coincide con la columna telas.usuarios.indicadores.
  indicadores?: boolean | null
  // Gestión de Diseños — permisos por sub-rol
  gd_ventas?: boolean | null
  gd_diseno?: boolean | null
  gd_admin?: boolean | null
  // Any other column the DB might add in the future
  [key: string]: unknown
}

/**
 * Mapa de ActiveView -> campo correspondiente en telas.usuarios.
 * Las vistas "trazabilidad" y "dashboard" no tienen columna propia: se
 * consideran visibles para cualquier usuario autenticado (lectura global)
 * y se evaluan fuera de este mapa.
 *
 * "resumendia" si tiene su propia columna (`dashboard_dia`) para que un
 * admin pueda habilitar/desactivar el reporte diario por usuario.
 */
export const VIEW_PERMISSION_MAP: Record<string, keyof UsuarioActual> = {
  programacion: "mod_programacion",
  diseno: "mod_diseno",
  corte: "mod_corte",
  impresion: "mod_impresion",
  sublimacion: "mod_sublimacion",
  costura: "mod_costura",
  empaque: "mod_empaque",
  entregas: "mod_entregas",
  resumendia: "dashboard_dia",
  // Reporte analitico de incidencias. La edicion (procesar reposicion)
  // adicionalmente requiere que `cargo === "Planner"`, pero la simple
  // visualizacion solo requiere esta bandera.
  incidencias: "reporte_incidencias",
  // Dashboard de Indicadores: controlado por la columna `indicadores`.
  indicadores: "indicadores",
  // Gestión de Diseños: accesible si el usuario tiene cualquiera de los
  // tres sub-roles (gd_ventas, gd_diseno, gd_admin). Como el mapa solo
  // acepta un único campo keyof UsuarioActual, usamos canViewForUser para
  // este caso especial con una función evaluadora (ver canViewForUser abajo).
}

/**
 * Helper para identificar al rol Planner. Se usa en el modulo de
 * Reporte de Incidencias para habilitar acciones de edicion (procesar
 * reposicion). La columna `cargo` puede venir con variantes de
 * mayusculas/espacios — normalizamos antes de comparar.
 */
export function isPlanner(usuario: UsuarioActual | null): boolean {
  if (!usuario) return false
  const cargo = (usuario.cargo as string | undefined)?.trim().toLowerCase()
  return cargo === "planner"
}

/**
 * Devuelve true si el usuario tiene permiso para ver la vista indicada.
 * - "dashboard" y "trazabilidad" son accesibles para cualquier usuario
 *   autenticado (informacion de lectura global).
 * - El resto consulta VIEW_PERMISSION_MAP. En particular "resumendia"
 *   ahora se controla con la columna `dashboard_dia` en telas.usuarios.
 */
export function canViewForUser(
  usuario: UsuarioActual | null,
  view: string
): boolean {
  if (!usuario) return false
  // Vistas accesibles para cualquier usuario autenticado (sin permiso especifico).
  if (
    view === "dashboard" ||
    view === "trazabilidad" ||
    view === "inventario" ||
    view === "plansemanal"
  )
    return true
  // Gestión de Diseños requiere cualquiera de los tres sub-roles.
  if (view === "gestion-disenos") {
    return Boolean(usuario.gd_ventas || usuario.gd_diseno || usuario.gd_admin)
  }
  const field = VIEW_PERMISSION_MAP[view]
  if (!field) return false
  return usuario[field] === true
}

interface AuthContextType {
  usuarioActual: UsuarioActual | null
  isHydrated: boolean
  isSubmitting: boolean
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioActual, setUsuarioActual] = useState<UsuarioActual | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hidratacion en dos pasos:
  //   1. Carga inmediata desde localStorage para evitar flicker visual
  //      y mostrar la UI con los permisos cacheados.
  //   2. Refresco asincrono contra telas.usuarios para incorporar columnas
  //      nuevas (p. ej. `dashboard_dia` recien agregado a la tabla) o
  //      cambios de permisos hechos por un admin sin obligar a cerrar
  //      sesion. Si el row ya no existe se cierra la sesion.
  useEffect(() => {
    let cached: UsuarioActual | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        cached = JSON.parse(raw) as UsuarioActual
        setUsuarioActual(cached)
      }
    } catch (err) {
      console.log("[v0] Auth - hydration error:", err)
    } finally {
      setIsHydrated(true)
    }

    // Si no hay sesion cacheada o no tenemos email, no intentamos refrescar.
    if (!cached?.email) return

    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .schema("telas")
          .from("usuarios")
          .select("*")
          .eq("email", cached!.email!)
          .single()

        if (cancelled) return

        if (error || !data) {
          console.log(
            "[v0] Auth - refresh failed, keeping cached session:",
            error
          )
          return
        }

        // Strip password antes de persistir en estado/localStorage.
        const fresh: UsuarioActual = { ...(data as UsuarioActual) }
        if ("password" in fresh) {
          delete (fresh as Record<string, unknown>).password
        }

        // Detecta si hubo cambios para evitar renders innecesarios.
        const changed = JSON.stringify(fresh) !== JSON.stringify(cached)
        if (!changed) return

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
        } catch (err) {
          console.log("[v0] Auth - localStorage set error:", err)
        }
        setUsuarioActual(fresh)
      } catch (err) {
        console.log("[v0] Auth - refresh unexpected error:", err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const clean = (username || "").trim().toLowerCase()
      if (!clean || !password) {
        return { success: false, error: "Usuario y contrasena son requeridos" }
      }

      // Strict concatenation per requirement: user types "juan.perez", we query
      // with "juan.perez@telas.com". If the user already typed the domain,
      // we prevent double-appending.
      const usuarioConcatenado = clean.includes("@")
        ? clean
        : `${clean}${EMAIL_DOMAIN}`

      console.log("[v0] Auth - login attempt with email:", usuarioConcatenado)

      setIsSubmitting(true)
      try {
        const { data, error } = await supabase
          .schema("telas")
          .from("usuarios")
          .select("*")
          .eq("email", usuarioConcatenado)
          .eq("password", password)
          .single()

        console.log("[v0] Auth - response data:", !!data, "error:", error)

        if (error || !data) {
          return { success: false, error: "Credenciales incorrectas" }
        }

        // Persist to localStorage so the session survives refresh.
        // We intentionally NEVER expose the password back: strip it out.
        const safeUser: UsuarioActual = { ...(data as UsuarioActual) }
        if ("password" in safeUser) {
          delete (safeUser as Record<string, unknown>).password
        }

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
        } catch (err) {
          console.log("[v0] Auth - localStorage set error:", err)
        }

        setUsuarioActual(safeUser)
        return { success: true }
      } catch (err) {
        console.log("[v0] Auth - unexpected error:", err)
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : "Error inesperado al iniciar sesion",
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    []
  )

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.log("[v0] Auth - localStorage remove error:", err)
    }
    setUsuarioActual(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ usuarioActual, isHydrated, isSubmitting, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
