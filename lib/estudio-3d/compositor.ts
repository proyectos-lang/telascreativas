/**
 * Estudio 3D — composición de la textura de la prenda.
 *
 * Pinta una cara del diseño (color base + textura en mosaico + logos) en
 * un canvas. Ese canvas es lo que se le entrega al modelo 3D como mapa de
 * color, y también lo que se exporta como PNG.
 *
 * Vive aparte del editor y del visor porque los dos lo necesitan y porque
 * es la única parte con reglas de dibujo propias: sin separarlo, la
 * previsualización 2D y lo que se ve en 3D podrían divergir.
 *
 * Las imágenes remotas se cargan con `crossOrigin`: sin eso el canvas
 * queda "tainted" y `toDataURL` lanza al exportar. El bucket de Supabase
 * es público y responde con CORS, así que funciona.
 */

import type { CapaLogo, CaraDiseno, DisenoEstudio, Vista } from "./tipos"

/** Lado del canvas de textura. Potencia de dos: lo que espera WebGL. */
export const LADO_TEXTURA = 1024

const cacheImagenes = new Map<string, Promise<HTMLImageElement>>()

/**
 * Carga una imagen una sola vez por URL.
 *
 * El editor repinta en cada arrastre del ratón; sin caché, cada cuadro
 * dispararía una petición nueva y el arrastre se sentiría a tirones.
 */
export function cargarImagen(url: string): Promise<HTMLImageElement> {
  const cacheada = cacheImagenes.get(url)
  if (cacheada) return cacheada

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => {
      // Se saca de la caché para que un fallo de red no deje la URL
      // envenenada para siempre.
      cacheImagenes.delete(url)
      reject(new Error(`No se pudo cargar la imagen: ${url}`))
    }
    img.src = url
  })

  cacheImagenes.set(url, p)
  return p
}

/** Precarga todo lo que usa un diseño, para pintar sin parpadeos. */
export async function precargarDiseno(d: DisenoEstudio): Promise<void> {
  const urls = new Set<string>()
  for (const cara of Object.values(d.caras)) {
    if (cara.textura?.url) urls.add(cara.textura.url)
  }
  for (const l of d.logos) urls.add(l.url)
  // Las que fallen no deben tumbar la composición completa: la cara se
  // pinta igual, solo sin esa capa.
  await Promise.allSettled([...urls].map(cargarImagen))
}

/** Dibuja la textura de fondo repetida en mosaico. */
function pintarTextura(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cara: CaraDiseno,
  lado: number
) {
  const t = cara.textura
  if (!t) return

  const patron = ctx.createPattern(img, "repeat")
  if (!patron) return

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacidad))

  // El patrón se ancla al origen del canvas, así que para escalarlo y
  // rotarlo hay que transformar el contexto y compensar el área pintada;
  // si no, al rotar quedarían esquinas sin cubrir.
  const escala = t.escala > 0 ? t.escala : 1
  const rad = ((t.rotacion || 0) * Math.PI) / 180
  const diagonal = lado * Math.SQRT2

  ctx.translate(lado / 2, lado / 2)
  ctx.rotate(rad)
  ctx.scale(escala, escala)
  ctx.fillStyle = patron
  ctx.fillRect(
    -diagonal / (2 * escala),
    -diagonal / (2 * escala),
    diagonal / escala,
    diagonal / escala
  )
  ctx.restore()
}

/** Dibuja un logo en su posición, tamaño y rotación. */
function pintarLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  l: CapaLogo,
  lado: number
) {
  const ancho = (l.ancho / 100) * lado
  // El alto sale de la proporción real de la imagen: escalar los dos ejes
  // por separado deformaría el logo, que es justo lo que un cliente nota.
  const proporcion = img.naturalHeight / (img.naturalWidth || 1)
  const alto = ancho * proporcion

  const cx = (l.x / 100) * lado
  const cy = (l.y / 100) * lado

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, l.opacidad))
  ctx.translate(cx, cy)
  if (l.rotacion) ctx.rotate((l.rotacion * Math.PI) / 180)
  ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto)
  ctx.restore()
}

/**
 * Compone una cara completa sobre el canvas dado.
 *
 * Asume que las imágenes ya están cargadas (`precargarDiseno`): dibujar
 * es síncrono para que el visor 3D pueda repintar dentro de su bucle de
 * animación sin esperar promesas.
 */
export function componerCara(
  canvas: HTMLCanvasElement,
  diseno: DisenoEstudio,
  vista: Vista,
  lado: number = LADO_TEXTURA
): void {
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const cara = diseno.caras[vista]

  ctx.clearRect(0, 0, lado, lado)
  ctx.fillStyle = cara.color || "#FFFFFF"
  ctx.fillRect(0, 0, lado, lado)

  if (cara.textura) {
    const img = imagenLista(cara.textura.url)
    if (img) pintarTextura(ctx, img, cara, lado)
  }

  const logos = diseno.logos
    .filter((l) => l.vista === vista)
    .sort((a, b) => a.z - b.z)

  for (const l of logos) {
    const img = imagenLista(l.url)
    if (img) pintarLogo(ctx, img, l, lado)
  }
}

/**
 * Devuelve la imagen solo si ya está cargada.
 *
 * `componerCara` es síncrona a propósito; esto le permite saltarse las
 * capas que aún no llegaron en vez de bloquear el cuadro entero.
 */
const listas = new Map<string, HTMLImageElement>()

function imagenLista(url: string): HTMLImageElement | null {
  const ya = listas.get(url)
  if (ya) return ya
  void cargarImagen(url)
    .then((img) => listas.set(url, img))
    .catch(() => undefined)
  return listas.get(url) ?? null
}

/** True si todas las imágenes del diseño ya están en memoria. */
export function disenoListo(d: DisenoEstudio): boolean {
  for (const cara of Object.values(d.caras)) {
    if (cara.textura?.url && !listas.has(cara.textura.url)) return false
  }
  return d.logos.every((l) => listas.has(l.url))
}
