"use client"

import { useState, useEffect } from "react"
import { Download, X, Share, Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pwa-install-dismissed"
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return

    // Dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_TTL) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua)
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(ua)
    setIsIOS(ios)
    setIsMobile(mobile)

    if (ios) {
      // No beforeinstallprompt on iOS — show after short delay
      const t = setTimeout(() => setVisible(true), 4000)
      return () => clearTimeout(t)
    }

    const handlePrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      const t = setTimeout(() => setVisible(true), 4000)
      return () => clearTimeout(t)
    }

    window.addEventListener("beforeinstallprompt", handlePrompt)
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt)
  }, [])

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") dismiss()
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (!visible) return null

  // ── iOS instructions ──────────────────────────────────────────────────────
  if (isIOS) {
    return (
      <div
        role="dialog"
        aria-label="Instalar aplicación"
        className="fixed bottom-0 inset-x-0 z-50 p-4 pb-safe"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md rounded-2xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100 p-4">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
              <span className="text-xl font-bold text-white">TC</span>
            </div>

            <div className="min-w-0 flex-1 pr-6">
              <p className="font-semibold text-slate-800">Instalar TelasPro</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Accede directamente desde tu pantalla de inicio sin abrir Safari.
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
            <p className="font-medium text-slate-700">Cómo instalar en iPhone / iPad:</p>
            <div className="flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-100">
                <Share className="size-3.5 text-indigo-600" />
              </div>
              <span>Toca el botón <strong>Compartir</strong> (cuadro con flecha arriba)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-100">
                <Download className="size-3.5 text-indigo-600" />
              </div>
              <span>Selecciona <strong>"Agregar a pantalla de inicio"</strong></span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="mt-2 w-full text-slate-500 text-xs"
          >
            Ahora no
          </Button>
        </div>
      </div>
    )
  }

  // ── Android / Desktop install prompt ────────────────────────────────────
  if (isMobile) {
    // Mobile bottom bar
    return (
      <div
        role="dialog"
        aria-label="Instalar aplicación"
        className="fixed bottom-0 inset-x-0 z-50 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md rounded-2xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100 p-4">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
              <Smartphone className="size-5 text-white" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <p className="font-semibold text-slate-800">Instalar TelasPro</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Úsala como una app nativa directamente desde tu pantalla de inicio.
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={dismiss}
              className="flex-1 text-slate-600"
            >
              Ahora no
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              className="flex-1 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
            >
              <Download className="size-3.5" />
              Instalar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Desktop — compact top-right card
  return (
    <div
      role="dialog"
      aria-label="Instalar aplicación"
      className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100 p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <Monitor className="size-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Instalar TelasPro</p>
          <p className="text-xs text-slate-500">Acceso directo en el escritorio</p>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-slate-500 leading-relaxed">
        Instala la app para abrirla como una ventana independiente, sin la barra del navegador.
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={dismiss}
          className="flex-1 text-xs text-slate-600"
        >
          Ahora no
        </Button>
        <Button
          size="sm"
          onClick={handleInstall}
          className="flex-1 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs"
        >
          <Download className="size-3.5" />
          Instalar
        </Button>
      </div>
    </div>
  )
}
