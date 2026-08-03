"use client"

import { useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Camera, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { UserAvatar } from "./user-avatar"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const AVATAR_BUCKET = "user-avatars"
const MAX_BYTES = 5 * 1024 * 1024

export function PerfilModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { usuarioActual, refreshUsuario } = useAuth()
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const email = (usuarioActual?.email ?? "").toLowerCase()

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagen demasiado grande (máx. 5 MB)")
      return
    }
    setSubiendo(true)
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const safe = email.replace(/[^a-zA-Z0-9]/g, "_")
      const path = `${safe}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) {
        const esBucketFaltante = /bucket not found/i.test(upErr.message)
        toast.error(
          esBucketFaltante
            ? "Falta crear el bucket de fotos en Supabase"
            : "No se pudo subir la foto",
          {
            description: esBucketFaltante
              ? `Crea un bucket público llamado "${AVATAR_BUCKET}" en Supabase → Storage.`
              : upErr.message,
          }
        )
        return
      }
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const { error: dbErr } = await supabase
        .schema("telas")
        .from("usuarios")
        .update({ foto_url: data.publicUrl })
        .eq("email", email)
      if (dbErr) {
        toast.error("No se pudo guardar la foto", { description: dbErr.message })
        return
      }
      await refreshUsuario()
      toast.success("Foto de perfil actualizada")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mi perfil</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative">
            <UserAvatar
              nombre={usuarioActual?.nombre as string | undefined}
              email={email}
              fotoUrl={usuarioActual?.foto_url as string | undefined}
              className="size-24 text-2xl"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              title="Cambiar foto"
            >
              {subiendo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </button>
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-800">{usuarioActual?.nombre || email}</p>
            <p className="text-xs text-slate-400">
              {[usuarioActual?.cargo, usuarioActual?.area].filter(Boolean).join(" · ") || email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
          >
            <Camera className="mr-1.5 size-4" />
            Cambiar foto
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ""
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
