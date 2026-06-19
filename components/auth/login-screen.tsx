"use client"

import { useState, FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, LogIn, Lock, AtSign } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
  const { login, isSubmitting } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || isExiting) return

    const result = await login(username, password)

    if (!result.success) {
      toast.error("Credenciales incorrectas", {
        description:
          result.error ||
          "Verifica tu nombre de usuario y contrasena e intenta nuevamente.",
      })
      return
    }

    toast.success("Bienvenido", {
      description: "Cargando tu espacio de trabajo...",
    })

    // Trigger the exit animation; after the transition ends the provider
    // already has the user, so the layout will swap automatically.
    setIsExiting(true)
    setTimeout(() => {
      onSuccess?.()
    }, 700)
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0f1c] text-white">
      {/* Industrial / textile themed backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 10%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(900px 500px at 85% 80%, rgba(16,185,129,0.15), transparent 60%), radial-gradient(700px 400px at 50% 50%, rgba(236,72,153,0.08), transparent 60%)",
        }}
      />

      {/* Floating blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0.3, scale: 1 }}
        animate={{ opacity: [0.25, 0.4, 0.25], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0.2, scale: 1 }}
        animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-10">
        <AnimatePresence>
          {!isExiting && (
            <motion.div
              key="login-panel"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 1.02, filter: "blur(8px)" }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full max-w-md"
            >
              {/* Brand / logo */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="mb-8 flex flex-col items-center gap-3"
              >
                {/* Frosted white container so the black logo stays legible
                    while blending with the dark/indigo/emerald backdrop. */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/85 px-8 py-5 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.45)] backdrop-blur-md"
                  style={{
                    boxShadow:
                      "0 20px 60px -15px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.8)",
                  }}
                >
                  {/* Subtle brand halo */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                      background:
                        "radial-gradient(120% 120% at 50% 50%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0) 75%)",
                    }}
                  />
                  <img
                    src="/telas-creativas-logo.png"
                    alt="Telas Creativas"
                    className="relative h-16 w-auto object-contain sm:h-20"
                  />
                </div>

                <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">
                  Torre de Control de Produccion
                </p>
              </motion.div>

              {/* Glass card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-8"
                style={{
                  boxShadow:
                    "0 24px 60px -20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {/* Card header */}
                <div className="mb-6 space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-balance">
                    Iniciar sesion
                  </h1>
                  <p className="text-sm text-white/60">
                    Ingresa tus credenciales para acceder al sistema de
                    produccion.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="username"
                      className="text-xs uppercase tracking-wider text-white/70"
                    >
                      Nombre de usuario
                    </Label>
                    <div className="group relative">
                      <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50 transition-colors group-focus-within:text-indigo-300" />
                      <Input
                        id="username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.replace(/\s+/g, ""))
                        }
                        placeholder="juan.perez"
                        disabled={isSubmitting || isExiting}
                        className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/30 focus-visible:border-indigo-400/50 focus-visible:ring-indigo-400/30"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-xs uppercase tracking-wider text-white/70"
                    >
                      Contrasena
                    </Label>
                    <div className="group relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50 transition-colors group-focus-within:text-emerald-300" />
                      <Input
                        id="password"
                        type={showPwd ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Ingresa tu contrasena"
                        disabled={isSubmitting || isExiting}
                        className="border-white/15 bg-white/5 pl-9 pr-10 text-white placeholder:text-white/30 focus-visible:border-emerald-400/50 focus-visible:ring-emerald-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        disabled={isSubmitting || isExiting}
                        aria-label={
                          showPwd
                            ? "Ocultar contrasena"
                            : "Mostrar contrasena"
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {showPwd ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isExiting ||
                      !username.trim() ||
                      !password
                    }
                    className="group relative w-full overflow-hidden bg-gradient-to-r from-indigo-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-emerald-500/30 hover:brightness-110 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Verificando credenciales...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 size-4 transition-transform group-hover:translate-x-0.5" />
                        Ingresar al sistema
                      </>
                    )}
                  </Button>
                </form>

              </motion.div>

              {/* Footer brand */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="mt-6 text-center text-xs text-white/40"
              >
                &copy; {new Date().getFullYear()} Telas Creativas - Sistema de
                Produccion Textil
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success transition overlay */}
        <AnimatePresence>
          {isExiting && (
            <motion.div
              key="exit-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 shadow-[0_0_80px_20px_rgba(99,102,241,0.35)]"
              >
                <Loader2 className="size-8 animate-spin text-white" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
