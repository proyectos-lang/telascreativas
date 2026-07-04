"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { FileText, Expand } from "lucide-react"
import type { GestionDiseno, GestionDisenoProposal } from "@/lib/gestion-disenos-types"
import { cn } from "@/lib/utils"
import { GDImageLightbox } from "./gd-image-lightbox"

interface ChatEntry {
  id: string
  fecha: string
  autor: string
  tipo: "sistema" | "diseno" | "ventas" | "cliente"
  texto: string
  imagenUrl?: string | null
  imagenesUrls?: string[] | null
  propuestaNum?: number
}

function buildEntries(g: GestionDiseno): ChatEntry[] {
  const entries: ChatEntry[] = []

  entries.push({
    id: `created-${g.id}`,
    fecha: g.fecha_creacion,
    autor: g.vendedora,
    tipo: "sistema",
    texto: `Solicitud ${g.numero} creada por ${g.vendedora} para el cliente ${g.cliente}.`,
  })

  if (g.motivo_rechazo_diseno) {
    entries.push({
      id: `rechazo-${g.id}`,
      fecha: g.fecha_creacion,
      autor: g.disenador || "Diseño",
      tipo: "diseno",
      texto: `Esquemático devuelto para corrección. Comentario: ${g.motivo_rechazo_diseno}`,
    })
  }

  const propuestas = g.propuestas || []
  for (const p of propuestas) {
    const imagenes = p.imagenes_propuesta_urls?.length ? p.imagenes_propuesta_urls : null
    if (imagenes || p.comentario_diseno) {
      entries.push({
        id: `prop-subida-${p.id}`,
        fecha: p.fecha_subida || p.created_at,
        autor: g.disenador || "Diseño",
        tipo: "diseno",
        texto: p.comentario_diseno || `Propuesta ${p.numero_propuesta} subida.`,
        imagenUrl: imagenes ? null : p.imagen_mockup_url,
        imagenesUrls: imagenes,
        propuestaNum: p.numero_propuesta,
      })
    }

    if (p.respuesta_cliente && p.fecha_respuesta_cliente) {
      entries.push({
        id: `cliente-resp-${p.id}`,
        fecha: p.fecha_respuesta_cliente,
        autor: g.cliente,
        tipo: "cliente",
        texto:
          p.respuesta_cliente === "Aprobada"
            ? `✅ El cliente aprobó la propuesta ${p.numero_propuesta}.${p.comentario_cliente ? ` Comentario: ${p.comentario_cliente}` : ""}`
            : `🔄 El cliente solicitó cambios en la propuesta ${p.numero_propuesta}.${p.comentario_cliente ? ` Comentario: ${p.comentario_cliente}` : ""}`,
        propuestaNum: p.numero_propuesta,
      })
    }

    if (p.respuesta_ventas && p.fecha_respuesta_ventas) {
      entries.push({
        id: `ventas-resp-${p.id}`,
        fecha: p.fecha_respuesta_ventas,
        autor: g.vendedora,
        tipo: "ventas",
        texto:
          p.respuesta_ventas === "Aprobada"
            ? `✅ Ventas aprobó la propuesta ${p.numero_propuesta}.${p.comentario_ventas ? ` ${p.comentario_ventas}` : ""}`
            : `🔄 Ventas solicitó cambios.${p.comentario_ventas ? ` ${p.comentario_ventas}` : ""}`,
        imagenUrl: p.imagen_cambio_url,
        propuestaNum: p.numero_propuesta,
      })
    }

    if (p.archivos_finales_urls?.length && p.fecha_archivos_finales) {
      entries.push({
        id: `final-${p.id}`,
        fecha: p.fecha_archivos_finales,
        autor: g.disenador || "Diseño",
        tipo: "diseno",
        texto: `Archivos finales entregados (${p.archivos_finales_urls.length} archivo${p.archivos_finales_urls.length > 1 ? "s" : ""}).`,
        propuestaNum: p.numero_propuesta,
      })
    }
  }

  if (g.aprobacion_ventas && g.fecha_aprobacion) {
    entries.push({
      id: `aprobacion-${g.id}`,
      fecha: g.fecha_aprobacion,
      autor: g.vendedora,
      tipo: "ventas",
      texto:
        g.aprobacion_ventas === "APROBADO"
          ? `✅ Diseño aprobado definitivamente por Ventas.${g.comentario_aprobacion ? ` ${g.comentario_aprobacion}` : ""}`
          : `❌ Diseño no aprobado.${g.comentario_aprobacion ? ` ${g.comentario_aprobacion}` : ""}`,
      imagenUrl: g.imagen_aprobada_url,
    })
  }

  return entries.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
}

const TIPO_STYLES: Record<ChatEntry["tipo"], { bubble: string; avatar: string; label: string; align: "left" | "right" }> = {
  sistema: { bubble: "bg-slate-100 text-slate-600 border border-slate-200", avatar: "bg-slate-300", label: "Sistema", align: "left" },
  diseno: { bubble: "bg-blue-50 text-blue-900 border border-blue-200", avatar: "bg-blue-500", label: "Diseño", align: "right" },
  ventas: { bubble: "bg-green-50 text-green-900 border border-green-200", avatar: "bg-green-500", label: "Ventas", align: "left" },
  cliente: { bubble: "bg-purple-50 text-purple-900 border border-purple-200", avatar: "bg-purple-500", label: "Cliente", align: "left" },
}

function Avatar({ autor, color }: { autor: string; color: string }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
        color
      )}
    >
      {autor.charAt(0).toUpperCase()}
    </div>
  )
}

function isImg(url: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(url)
}

function ClickableImage({ url, onExpand }: { url: string; onExpand: (src: string) => void }) {
  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-200"
      onClick={() => onExpand(url)}
    >
      <img
        src={url}
        alt="referencia"
        className="max-h-40 w-auto object-contain"
      />
      <div className="absolute inset-0 flex items-end justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
        <div className="rounded-full bg-black/50 p-1">
          <Expand className="size-3 text-white" />
        </div>
      </div>
    </div>
  )
}

export function GDChatHistory({ gestion }: { gestion: GestionDiseno }) {
  const entries = buildEntries(gestion)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  if (!entries.length) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        No hay actividad registrada aún.
      </p>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-2">
        {entries.map((e) => {
          const style = TIPO_STYLES[e.tipo]
          const isRight = style.align === "right"

          return (
            <div
              key={e.id}
              className={cn("flex gap-2", isRight && "flex-row-reverse")}
            >
              <Avatar autor={e.autor} color={style.avatar} />

              <div className={cn("flex max-w-[78%] flex-col gap-1", isRight && "items-end")}>
                <div className={cn("flex items-center gap-1.5 text-[10px] text-slate-500", isRight && "flex-row-reverse")}>
                  <span className="font-medium">{e.autor}</span>
                  <span>·</span>
                  <span>{format(new Date(e.fecha), "dd MMM yy HH:mm", { locale: es })}</span>
                  {e.propuestaNum != null && (
                    <>
                      <span>·</span>
                      <span className="rounded-full bg-indigo-100 px-1.5 text-indigo-600 font-medium">
                        V{e.propuestaNum}
                      </span>
                    </>
                  )}
                </div>

                <div className={cn("rounded-xl px-3 py-2 text-xs leading-relaxed", style.bubble)}>
                  {e.texto}
                </div>

                {/* Multi-image gallery */}
                {e.imagenesUrls && e.imagenesUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {e.imagenesUrls.map((url, i) =>
                      isImg(url) ? (
                        <ClickableImage key={i} url={url} onExpand={setLightboxSrc} />
                      ) : (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-indigo-600 hover:underline"
                        >
                          <FileText className="size-3.5" />
                          Archivo {i + 1}
                        </a>
                      )
                    )}
                  </div>
                )}

                {/* Single image (non-proposal or legacy) */}
                {!e.imagenesUrls && e.imagenUrl && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 mt-0.5">
                    {isImg(e.imagenUrl) ? (
                      <ClickableImage url={e.imagenUrl} onExpand={setLightboxSrc} />
                    ) : (
                      <a
                        href={e.imagenUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-indigo-600 hover:underline"
                      >
                        <FileText className="size-3.5" />
                        Ver archivo adjunto
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {lightboxSrc && (
        <GDImageLightbox
          src={lightboxSrc}
          open
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  )
}
