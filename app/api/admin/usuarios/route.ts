import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PERMISO_KEYS } from "@/lib/configuracion/permisos"

// Escrituras sensibles (crear/resetear/permisos) via service role, aisladas del
// navegador. Se revalida que el solicitante sea admin (mod_admin).
export const runtime = "nodejs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const EMAIL_DOMAIN = "@telas.com"

function normalizarEmail(v: string): string {
  const clean = (v || "").trim().toLowerCase()
  if (!clean) return ""
  return clean.includes("@") ? clean : `${clean}${EMAIL_DOMAIN}`
}

interface Body {
  accion?: string
  solicitanteEmail?: string
  email?: string
  password?: string
  datos?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const solicitante = (body.solicitanteEmail ?? "").trim().toLowerCase()
  if (!solicitante) return NextResponse.json({ error: "Falta identificar al solicitante" }, { status: 401 })

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // Autorización: solo administradores.
  const { data: admin, error: adminErr } = await supabase
    .schema("telas")
    .from("usuarios")
    .select("email, mod_admin")
    .eq("email", solicitante)
    .maybeSingle()
  if (adminErr) return NextResponse.json({ error: adminErr.message }, { status: 500 })
  if (!admin || admin.mod_admin !== true)
    return NextResponse.json({ error: "No autorizado (requiere administrador)" }, { status: 403 })

  const accion = body.accion

  // Construye el set de columnas de permiso permitidas + datos de perfil.
  const construirActualizacion = (datos: Record<string, unknown>) => {
    const upd: Record<string, unknown> = {}
    for (const campo of ["nombre", "cargo", "area"] as const) {
      if (typeof datos[campo] === "string") upd[campo] = datos[campo]
    }
    for (const k of PERMISO_KEYS) {
      if (k in datos) upd[k] = Boolean(datos[k])
    }
    return upd
  }

  try {
    if (accion === "listar") {
      const { data, error } = await supabase.schema("telas").from("usuarios").select("*")
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const usuarios = (data ?? []).map((u: Record<string, unknown>) => {
        const { password: _pw, ...rest } = u
        void _pw
        return rest
      })
      return NextResponse.json({ usuarios })
    }

    if (accion === "crear") {
      const email = normalizarEmail(body.email ?? "")
      if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 })
      if (!body.password) return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 })
      const datos = body.datos ?? {}
      // Existencia
      const { data: existe } = await supabase
        .schema("telas")
        .from("usuarios")
        .select("email")
        .eq("email", email)
        .maybeSingle()
      if (existe) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 })
      const fila = {
        email,
        nombre: (datos.nombre as string) || email.split("@")[0],
        cargo: (datos.cargo as string) || "",
        area: (datos.area as string) || "",
        password: body.password,
        ...construirActualizacion(datos),
      }
      const { error } = await supabase.schema("telas").from("usuarios").insert(fila)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, email })
    }

    if (accion === "resetear") {
      const email = normalizarEmail(body.email ?? "")
      if (!email || !body.password)
        return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 })
      const { error } = await supabase
        .schema("telas")
        .from("usuarios")
        .update({ password: body.password })
        .eq("email", email)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (accion === "permisos") {
      const email = normalizarEmail(body.email ?? "")
      if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 })
      const upd = construirActualizacion(body.datos ?? {})
      if (Object.keys(upd).length === 0)
        return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
      const { error } = await supabase.schema("telas").from("usuarios").update(upd).eq("email", email)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (accion === "eliminar") {
      const email = normalizarEmail(body.email ?? "")
      if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 })
      if (email === solicitante)
        return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 })
      const { error } = await supabase.schema("telas").from("usuarios").delete().eq("email", email)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "Error del servidor", detalle }, { status: 500 })
  }
}
