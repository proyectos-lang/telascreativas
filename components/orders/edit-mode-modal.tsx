"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Pencil, ShieldAlert, Eye, EyeOff } from "lucide-react"

// Contrasena requerida para habilitar el modo edicion avanzada en Programacion.
// Cambiarla solo aqui si en el futuro el administrador la rota.
const EDIT_MODE_PASSWORD = "Tel@s2026*/"

interface EditModeModalProps {
  open: boolean
  onClose: () => void
  /** Se dispara cuando la password coincide exactamente */
  onUnlock: () => void
}

export function EditModeModal({ open, onClose, onUnlock }: EditModeModalProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset al abrir / cerrar para que no queden trazas del intento anterior
  useEffect(() => {
    if (!open) return
    setPassword("")
    setShowPassword(false)
    setError(null)
    // Enfoca el input automaticamente al abrir
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (password === EDIT_MODE_PASSWORD) {
      onUnlock()
      onClose()
    } else {
      setError("Contrasena incorrecta. Verifica e intenta de nuevo.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-icon-cyan" />
            Activar modo edicion
          </DialogTitle>
          <DialogDescription>
            Ingresa la contrasena de administrador para habilitar la edicion
            de los datos de esta orden.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_password" className="text-sm">
              Contrasena
            </Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="edit_password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                autoComplete="off"
                placeholder="Ingresa la contrasena"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-icon-cyan hover:bg-icon-cyan/90">
              <Pencil className="mr-1.5 size-3.5" />
              Activar edicion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
