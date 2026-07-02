import { createClient } from "@supabase/supabase-js"
import { GDClienteReviewClient } from "./gd-cliente-review-client"

export default async function GDClientePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: propuesta } = await supabase
    .schema("telas")
    .from("gestion_disenos_propuestas")
    .select("*")
    .eq("cliente_token", token)
    .single()

  if (!propuesta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm space-y-3 text-center">
          <div className="text-5xl">🔗</div>
          <h1 className="text-xl font-bold text-slate-800">Link no válido</h1>
          <p className="text-sm text-slate-500">
            Este link de revisión no existe o ya expiró. Contacta al equipo de Telas
            Creativas para obtener uno nuevo.
          </p>
        </div>
      </main>
    )
  }

  const { data: gestion } = await supabase
    .schema("telas")
    .from("gestion_disenos")
    .select("numero, cliente, vendedora, total_propuestas")
    .eq("id", propuesta.gestion_id)
    .single()

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-5 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Telas Creativas
          </p>
          <h1 className="text-xl font-bold text-slate-800">Revisión de Diseño</h1>
          {gestion && (
            <p className="mt-1 text-sm text-slate-500">
              {gestion.numero} · {gestion.cliente}
            </p>
          )}
          <div className="mt-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
              Propuesta {propuesta.numero_propuesta}
            </span>
          </div>
        </div>

        {/* Review card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <GDClienteReviewClient
            propuesta={propuesta}
            token={token}
            gestion={
              gestion ?? {
                numero: "",
                cliente: "",
                vendedora: "",
                total_propuestas: 0,
              }
            }
          />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Telas Creativas · Revisión confidencial
        </p>
      </div>
    </main>
  )
}
