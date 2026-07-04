import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import Script from 'next/script'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Telas Creativas — Sistema de Producción',
  description: 'Sistema interno de gestión y programación de producción textil',
  applicationName: 'TelasPro',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TelasPro',
  },
  // favicon generated via app/icon.tsx; apple-icon via app/apple-icon.tsx
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background">
      <head>
        {/*
          Capture beforeinstallprompt BEFORE React hydrates so we never miss it.
          React useEffect runs after hydration — this script runs immediately.
        */}
        <Script
          id="pwa-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwaPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaPrompt = e;
              });
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js', { scope: '/' });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
        <PWAInstallPrompt />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
