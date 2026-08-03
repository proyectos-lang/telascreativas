"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function iniciales(nombre?: string | null, email?: string | null): string {
  const base = (nombre || email || "?").trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export function UserAvatar({
  nombre,
  email,
  fotoUrl,
  className,
}: {
  nombre?: string | null
  email?: string | null
  fotoUrl?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {fotoUrl ? <AvatarImage src={fotoUrl} alt={nombre || email || ""} /> : null}
      <AvatarFallback className="bg-indigo-100 text-[11px] font-medium text-indigo-700">
        {iniciales(nombre, email)}
      </AvatarFallback>
    </Avatar>
  )
}
