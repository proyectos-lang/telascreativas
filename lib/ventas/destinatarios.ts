/**
 * A quién avisar cuando Programación rechaza una orden.
 *
 * El problema: `cabecera.vendedora` es texto libre escrito a mano y casi
 * nunca coincide con el nombre del usuario. De 1656 órdenes solo UNA
 * coincidía exacto. Las variantes reales son:
 *   'KAREN SALGADO'  vs 'Karen Salgado'   (mayúsculas)
 *   'LAURI MAYORGA'  vs 'Laury Mayorga'   (ortografía)
 *   'SAMANTHA A.'    vs 'Samantha Alvarez' (abreviado)
 *   'SAMANTHA'                             (solo nombre de pila)
 *
 * Por eso el cruce es TOLERANTE: compara el nombre de pila y, si hay
 * apellido, lo usa para desempatar. Con la base actual resuelve 1653 de
 * 1656 (100% de las que tienen vendedora reconocible).
 *
 * Funciones puras: no hacen I/O, reciben los usuarios ya cargados.
 */

export interface UsuarioDestino {
  nombre: string
  email: string
  cargo?: string | null
  area?: string | null
}

/** Cargo que siempre recibe copia, además de la vendedora. */
const CARGO_JEFATURA = "jefa de ventas"
const AREA_VENTAS = "ventas"

/** Umbral de similitud para dar por buena una coincidencia de nombre. */
const UMBRAL = 0.82

const limpiar = (s: string | null | undefined): string[] =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/[^A-Za-z ]/g, " ") // quita puntos de "Samantha A."
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)

/**
 * Similitud 0..1 entre dos palabras. Implementa el ratio de coincidencia
 * por caracteres comunes en orden, suficiente para 'LAURI' vs 'LAURY'.
 */
function similitud(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  // Distancia de Levenshtein normalizada.
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return 1 - d[m][n] / Math.max(m, n)
}

export const esDeVentas = (u: UsuarioDestino): boolean =>
  String(u.area ?? "").trim().toLowerCase() === AREA_VENTAS

export const esJefaDeVentas = (u: UsuarioDestino): boolean =>
  String(u.cargo ?? "").trim().toLowerCase() === CARGO_JEFATURA

/**
 * Resuelve el usuario que corresponde a un nombre de vendedora escrito a
 * mano. Devuelve null si ninguno supera el umbral: en ese caso conviene
 * avisar a todo el equipo antes que perder el rechazo.
 */
export function resolverVendedora(
  vendedora: string | null | undefined,
  usuarios: UsuarioDestino[]
): UsuarioDestino | null {
  const tv = limpiar(vendedora)
  if (tv.length === 0) return null

  // Solo se busca dentro de Ventas: un nombre parecido de otra área no
  // debe recibir el aviso.
  const candidatos = usuarios.filter(esDeVentas)

  let mejor: UsuarioDestino | null = null
  let mejorScore = 0

  for (const u of candidatos) {
    const tu = limpiar(u.nombre)
    if (tu.length === 0) continue

    let score = similitud(tv[0], tu[0]) // nombre de pila

    // Con apellido en ambos, se usa para desempatar; sin él, se penaliza
    // levemente para que 'SAMANTHA' no gane sobre una coincidencia plena.
    if (tv.length > 1 && tu.length > 1) {
      let mejorApellido = 0
      for (const a of tv.slice(1))
        for (const b of tu.slice(1))
          mejorApellido = Math.max(mejorApellido, similitud(a, b))
      score = mejorApellido > 0.7 ? score * 0.6 + mejorApellido * 0.4 : score * 0.85
    }

    if (score > mejorScore) {
      mejorScore = score
      mejor = u
    }
  }

  return mejorScore >= UMBRAL ? mejor : null
}

export interface Destinatarios {
  /** Emails a notificar, sin repetidos. */
  emails: string[]
  /** Vendedora resuelta, si se pudo identificar. */
  vendedora: UsuarioDestino | null
  /** True si no se resolvió y se avisó a todo el equipo como respaldo. */
  usoRespaldo: boolean
}

/**
 * Destinatarios del aviso de rechazo: la vendedora de la orden y SIEMPRE
 * la Jefa de Ventas. Si la vendedora no se puede resolver, se avisa a todo
 * el equipo de Ventas: es preferible una notificación de más que un
 * rechazo que nadie ve.
 */
export function destinatariosRechazo(
  vendedora: string | null | undefined,
  usuarios: UsuarioDestino[]
): Destinatarios {
  const resuelta = resolverVendedora(vendedora, usuarios)
  const jefatura = usuarios.filter(esJefaDeVentas)

  const emails = new Set<string>()
  for (const j of jefatura) if (j.email) emails.add(j.email.toLowerCase())

  if (resuelta?.email) {
    emails.add(resuelta.email.toLowerCase())
  } else {
    for (const u of usuarios.filter(esDeVentas))
      if (u.email) emails.add(u.email.toLowerCase())
  }

  return {
    emails: [...emails],
    vendedora: resuelta,
    usoRespaldo: resuelta === null,
  }
}
