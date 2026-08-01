import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema"
import { createClient } from "@supabase/supabase-js"
import { SCHEMA_CONTEXT } from "@/lib/asistente-ia/schema-context"

// El SDK de Anthropic y el service-role de Supabase requieren runtime Node.
export const runtime = "nodejs"
// Las respuestas de análisis con tool-use pueden tardar; damos margen.
export const maxDuration = 300

const MODELO = "claude-opus-5"
const MAX_TOOL_RESULT_CHARS = 12000
const MAX_HISTORIAL = 30 // últimos N mensajes que se envían como contexto

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Si existe el service_role se usa (más privilegio y aislado del navegador);
// si no, se cae al anon key (que ya puede leer telas). Solo servidor.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const SYSTEM_PROMPT = `Eres el "Asistente IA" de Telas Creativas, una empresa de confección y sublimación textil. Actúas como un ANALISTA EXPERTO EN PRODUCCIÓN que ayuda a la gerencia a entender el estado de la operación y a detectar oportunidades de mejora.

Tu trabajo:
- Responder preguntas sobre la operación (pedidos pendientes, en riesgo, vencidos, cuellos de botella, cargas por área, etc.).
- Hacer análisis de eficiencia y lead times, interpretando los datos como lo haría un gerente de producción: identifica cuellos de botella, demoras, áreas problemáticas y oportunidades concretas de mejora.

Reglas estrictas:
- SOLO tienes acceso de LECTURA. Para obtener datos reales SIEMPRE usa la herramienta "consultar_datos" con una consulta SQL SELECT (una sola sentencia, sin punto y coma final ni escritura). Nunca inventes cifras ni supongas datos: si necesitas un número, consúltalo.
- Prefiere las VISTAS de reporte (telas.vista_control_produccion, telas.vista_lead_times_unificado, telas.vista_plan_semanal, telas.vista_kpi_*) para preguntas de estado y eficiencia; usa telas.cabecera / telas.incidencias para detalle.
- Usa el prefijo de schema "telas." en cada tabla/vista. Filtra y agrega en SQL (WHERE, GROUP BY, agregados) para traer solo lo necesario; hay un límite de 500 filas por consulta.
- Si una consulta falla, lee el error, corrige el SQL y reintenta.
- No puedes consultar la tabla usuarios ni esquemas del sistema (están bloqueados).
- Responde en español, claro y directo. Para análisis, primero da la conclusión (qué está pasando y qué recomiendas) y luego el detalle. Usa listas o tablas markdown cuando aporte claridad. No muestres el SQL en la respuesta a menos que te lo pidan (el sistema ya lo registra aparte).

## Memoria y aprendizaje (mejora continua)
Tienes una MEMORIA COMPARTIDA por todo el equipo que persiste entre todas las conversaciones. Úsala para volverte cada vez más útil:
- Cuando aprendas algo DURADERO y de aplicación general —una regla de negocio, una definición, una preferencia del equipo, una meta o umbral, o una corrección que te hagan— guárdalo con la herramienta "guardar_conocimiento". También hazlo cuando el usuario diga "recuerda...", "de ahora en adelante..." o "ten en cuenta que...".
- NO guardes resultados puntuales de una consulta, cifras que cambian a diario, ni cosas que solo aplican a una conversación. Sé conciso, en una o dos frases, y NO dupliques algo que ya esté en "Conocimiento acumulado".
- Aplica SIEMPRE el "Conocimiento acumulado" que aparece al final de este prompt. Si el usuario corrige algo que contradice la memoria, prioriza su corrección y guárdala (la nueva reemplaza a la anterior en tu razonamiento).
- Cuando guardes un aprendizaje, dilo brevemente al usuario ("Lo tendré en cuenta de ahora en adelante").

## Reportes y análisis que debes saber responder (enfoque del negocio)
Estos son los usos principales que el equipo espera de ti. Aprende a resolverlos y ofrécelos proactivamente cuando encajen:

1) EFICIENCIA DE PROCESOS — "¿qué procesos/áreas son los más eficientes?"
   Compara las áreas (Diseño, Impresión, Sublimación, Corte, Costura, Empaque) usando:
   - telas.vista_kpi_lead_times y telas.vista_lead_times_unificado (días promedio por área y colas/esperas entre áreas: cola_<areaA>_a_<areaB>),
   - telas.vista_kpi_adherencia (% de cumplimiento de fecha objetivo por área),
   - telas.vista_kpi_reprocesos (calidad: % de cumplimiento e incidencias/reprocesos por área responsable).
   Concluye qué proceso es el MÁS eficiente y cuál es el cuello de botella o el de peor calidad, con cifras.

2) CURVAS DE TALLAJE — distribución de piezas por talla.
   Calcula desde telas.detalleorden: SUM del pcs casteado agrupado por talla. Entrega la curva GLOBAL (según las órdenes que se manejan) y, si aplica o lo piden, su evolución HISTÓRICA uniendo con telas.cabecera por pedido y agrupando por mes/semana de fecha_de_ingreso. Presenta la curva como tabla (talla, piezas, % del total) ordenada de forma lógica de talla.

3) SEGMENTAR POR TIPO DE TELA — repite los análisis (tallaje, volúmenes, eficiencia) agrupando por telas.detalleorden.tela.

4) SEGMENTAR POR PRODUCTO — agrupa por telas.detalleorden.nombre (o estilo). Combina tela + producto + talla cuando pidan una curva específica (p. ej. "curva de tallaje de camisetas en tela dry-fit").

Da SIEMPRE primero la conclusión accionable (qué talla/tela/producto domina, qué proceso conviene mejorar y por qué) y luego el detalle en tabla. Si faltan datos para un corte, dilo explícitamente en vez de suponer.

Fecha de referencia: usa CURRENT_DATE en SQL para "hoy".

A continuación está el esquema de datos disponible:

${SCHEMA_CONTEXT}`

interface CuerpoPost {
  conversacionId?: string | null
  mensaje?: string
  usuarioEmail?: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "El asistente no está configurado (falta ANTHROPIC_API_KEY en el servidor)." },
      { status: 500 }
    )
  }

  let body: CuerpoPost
  try {
    body = (await req.json()) as CuerpoPost
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const mensaje = (body.mensaje ?? "").trim()
  const usuarioEmail = (body.usuarioEmail ?? "").trim().toLowerCase()
  let conversacionId = body.conversacionId ?? null

  if (!mensaje) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
  }
  if (!usuarioEmail) {
    return NextResponse.json({ error: "Falta identificar al usuario" }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  // 1) Autorización: el usuario debe tener asistente_ia = true.
  const { data: usuario, error: userErr } = await supabase
    .schema("telas")
    .from("usuarios")
    .select("email, asistente_ia")
    .eq("email", usuarioEmail)
    .maybeSingle()

  if (userErr) {
    return NextResponse.json(
      { error: "No se pudo validar el usuario", detalle: userErr.message },
      { status: 500 }
    )
  }
  if (!usuario || usuario.asistente_ia !== true) {
    return NextResponse.json(
      { error: "No tienes permiso para usar el Asistente IA." },
      { status: 403 }
    )
  }

  // 2a) Memoria compartida (conocimiento curado del equipo) para inyectar al prompt.
  const { data: conocimiento } = await supabase
    .schema("telas")
    .from("ia_conocimiento")
    .select("contenido, categoria")
    .eq("activo", true)
    .order("created_at", { ascending: true })
    .limit(300)
  const memoriaBlock =
    conocimiento && conocimiento.length
      ? "\n\n## Conocimiento acumulado (memoria compartida del equipo — aplícalo siempre, salvo corrección del usuario)\n" +
        conocimiento
          .map(
            (k) =>
              `- ${k.categoria ? `[${k.categoria}] ` : ""}${(k.contenido ?? "").trim()}`
          )
          .join("\n")
      : ""
  const sistema = SYSTEM_PROMPT + memoriaBlock

  // 2) Conversación: cargar historial o crear una nueva.
  let historial: { rol: string; contenido: string }[] = []
  if (conversacionId) {
    const { data: msgs } = await supabase
      .schema("telas")
      .from("ia_mensajes")
      .select("rol, contenido")
      .eq("conversacion_id", conversacionId)
      .order("created_at", { ascending: true })
    historial = (msgs ?? []) as { rol: string; contenido: string }[]
  } else {
    const titulo = mensaje.length > 60 ? mensaje.slice(0, 57) + "..." : mensaje
    const { data: conv, error: convErr } = await supabase
      .schema("telas")
      .from("ia_conversaciones")
      .insert({ usuario_email: usuarioEmail, titulo })
      .select("id")
      .single()
    if (convErr || !conv) {
      return NextResponse.json(
        { error: "No se pudo crear la conversación", detalle: convErr?.message },
        { status: 500 }
      )
    }
    conversacionId = conv.id as string
  }

  // 3) Herramienta de consulta (solo SELECT vía la función segura de Postgres).
  const consultasEjecutadas: string[] = []
  const consultarDatos = betaTool({
    name: "consultar_datos",
    description:
      "Ejecuta una consulta SQL SELECT (solo lectura) contra el schema telas y devuelve las filas en JSON. Usa una sola sentencia SELECT/WITH, sin punto y coma final, con el prefijo de schema telas. en cada tabla/vista. Máximo 500 filas.",
    inputSchema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description: "La sentencia SQL SELECT a ejecutar.",
        },
      },
      required: ["consulta"],
      additionalProperties: false,
    },
    run: async ({ consulta }) => {
      consultasEjecutadas.push(consulta)
      const { data, error } = await supabase
        .schema("telas")
        .rpc("ia_run_select", { consulta })
      if (error) {
        return `ERROR al ejecutar la consulta: ${error.message}. Corrige el SQL y reintenta.`
      }
      let json = JSON.stringify(data ?? [])
      if (json.length > MAX_TOOL_RESULT_CHARS) {
        json =
          json.slice(0, MAX_TOOL_RESULT_CHARS) +
          `\n...[resultado truncado; refina la consulta con filtros o agregados]`
      }
      return json
    },
  })

  // 3b) Herramienta de memoria: guarda aprendizajes duraderos en la base compartida.
  const aprendizajes: string[] = []
  const guardarConocimiento = betaTool({
    name: "guardar_conocimiento",
    description:
      "Guarda un aprendizaje DURADERO en la memoria compartida del equipo (regla de negocio, definición, preferencia, meta/umbral o corrección de aplicación general). NO guardes resultados puntuales de una consulta ni datos que cambian a diario. Sé conciso (1-2 frases) y no dupliques algo que ya esté en el Conocimiento acumulado.",
    inputSchema: {
      type: "object",
      properties: {
        nota: {
          type: "string",
          description: "El aprendizaje, conciso y de aplicación general.",
        },
        categoria: {
          type: "string",
          description:
            "Categoría corta opcional (p. ej. tallaje, eficiencia, cliente, definicion, preferencia).",
        },
      },
      required: ["nota"],
      additionalProperties: false,
    },
    run: async ({ nota, categoria }) => {
      const limpio = (nota ?? "").trim()
      if (!limpio) return "Nota vacía, no se guardó."
      const { error } = await supabase
        .schema("telas")
        .from("ia_conocimiento")
        .insert({
          contenido: limpio,
          categoria: (categoria ?? "").trim() || null,
          usuario_email: usuarioEmail,
          activo: true,
        })
      if (error) return `No se pudo guardar: ${error.message}`
      aprendizajes.push(limpio)
      return "Aprendizaje guardado en la memoria compartida."
    },
  })

  const mensajesClaude: Anthropic.Beta.BetaMessageParam[] = [
    ...historial.slice(-MAX_HISTORIAL).map((m) => ({
      role: (m.rol === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.contenido,
    })),
    { role: "user", content: mensaje },
  ]

  // 4) Ejecutar el agente (tool-use loop) hasta la respuesta final.
  const client = new Anthropic()
  let respuesta: string
  try {
    const runner = client.beta.messages.toolRunner({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: sistema, cache_control: { type: "ephemeral" } },
      ],
      tools: [consultarDatos, guardarConocimiento],
      messages: mensajesClaude,
    })
    const finalMessage = await runner
    respuesta = finalMessage.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
    if (!respuesta) respuesta = "(Sin respuesta)"
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "El asistente no pudo procesar la solicitud.", detalle },
      { status: 502 }
    )
  }

  // 5) Persistir el turno (usuario + asistente) y refrescar la conversación.
  await supabase
    .schema("telas")
    .from("ia_mensajes")
    .insert([
      { conversacion_id: conversacionId, rol: "user", contenido: mensaje },
      { conversacion_id: conversacionId, rol: "assistant", contenido: respuesta },
    ])
  await supabase
    .schema("telas")
    .from("ia_conversaciones")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversacionId)

  return NextResponse.json({
    conversacionId,
    respuesta,
    consultas: consultasEjecutadas,
    aprendizajes,
  })
}
