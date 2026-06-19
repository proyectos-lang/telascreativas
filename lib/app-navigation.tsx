"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import type { ActiveView } from "@/components/app-sidebar"

/**
 * Pequena capa de navegacion a nivel de app para cuando un modulo necesita
 * "deep-linkear" a otro modulo con algun contexto seleccionado.
 *
 * Hoy la app no usa Next Router para los cambios de modulo (todo vive en
 * un `useState<ActiveView>` dentro de `MainApp`), asi que expongo un
 * contexto minimo que ofrece:
 *
 *   - `navigateTo(view, options?)`: cambia la vista activa y, si se pasa
 *     `focusPedido`, guarda el codigo de pedido para que el modulo destino
 *     lo consuma al montarse.
 *   - `pendingPedidoFocus`: codigo pendiente de enfoque (null si no hay).
 *   - `clearPedidoFocus()`: el modulo destino llama esto despues de abrir
 *     el detalle para que futuras navegaciones al mismo modulo no vuelvan
 *     a re-abrir el mismo pedido.
 *
 * Caso de uso inicial: boton "Ver" del Radar de Riesgo del Dashboard ->
 * abre el detalle de trazabilidad en el modulo "Mis Pedidos".
 */

export interface NavigateOptions {
  focusPedido?: string
}

interface AppNavigationContextValue {
  navigateTo: (view: ActiveView, options?: NavigateOptions) => void
  pendingPedidoFocus: string | null
  clearPedidoFocus: () => void
}

const AppNavigationContext = createContext<
  AppNavigationContextValue | undefined
>(undefined)

interface AppNavigationProviderProps {
  children: ReactNode
  setActiveView: (view: ActiveView) => void
}

export function AppNavigationProvider({
  children,
  setActiveView,
}: AppNavigationProviderProps) {
  const [pendingPedidoFocus, setPendingPedidoFocus] = useState<string | null>(
    null
  )

  const navigateTo = useCallback(
    (view: ActiveView, options?: NavigateOptions) => {
      // Actualizamos primero el pedido pendiente y luego la vista, para que
      // cuando el modulo destino se monte ya encuentre el pedido listo.
      if (options?.focusPedido) {
        setPendingPedidoFocus(options.focusPedido)
      } else {
        setPendingPedidoFocus(null)
      }
      setActiveView(view)
    },
    [setActiveView]
  )

  const clearPedidoFocus = useCallback(() => {
    setPendingPedidoFocus(null)
  }, [])

  return (
    <AppNavigationContext.Provider
      value={{ navigateTo, pendingPedidoFocus, clearPedidoFocus }}
    >
      {children}
    </AppNavigationContext.Provider>
  )
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext)
  if (!ctx) {
    throw new Error(
      "useAppNavigation debe usarse dentro de AppNavigationProvider"
    )
  }
  return ctx
}
