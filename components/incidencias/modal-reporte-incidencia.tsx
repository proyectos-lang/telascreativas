"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  AlertOctagon,
  AlertTriangle,
  Loader2,
  Send,
  X,
} from "lucide-react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

// Areas productivas. El orden respeta el flujo del proceso.
// Se usan como tipo para el prop `areaActual` de cada modulo.
export const AREAS = [
  "Diseno",
  "Corte",
  "Impresion",
  "Sublimacion",
  "Costura",
  "Empaque",
] as const
export type Area = (typeof AREAS)[number]

// Areas que pueden ser origen de un error. Incluye Ventas porque el
// area comercial puede ser responsable de una incidencia aunque no
// tenga modulo propio en la app.
export const AREAS_GENERA_ERROR = [
  "Ventas",
  "Diseno",
  "Corte",
  "Impresion",
  "Sublimacion",
  "Costura",
  "Empaque",
] as const

// Partes disponibles para reposicion. Si `genera_reposicion` = true, el usuario
// selecciona una o varias; se guardan como CSV en `partes_reposicion`.
const PARTES_REPOSICION = [
  "Cuello",
  "Mangas",
  "Back",
  "Front",
  "Short",
  "Plaqueta",
  "Paneles",
  "Yardaje",
  "Pañuelos",
  "Banderas",
  "Bandana",
  "Banda",
  "Puño",
  "Pie de cuello",
  "Solapa",
  "Bolsa",
  "Capa",
  "Pieza Completa",
] as const

/**
 * Procesos requeridos para llevar a cabo una reposicion. Cuando
 * `genera_reposicion` = true, el usuario marca uno o varios para
 * indicar por que areas debe pasar la reposicion fisica.
 *
 * Notas importantes sobre los valores:
 *  - "Impresión" y "Sublimación" llevan tilde (asi se persisten).
 *  - "Tela" y "Accesorios" son metadatos: no corresponden a modulos
 *    de produccion existentes, por lo que NO afectan la visibilidad
 *    en los modulos pero sirven para que compras/insumos sepan que
 *    deben aprovisionar.
 *  - Las areas que SI mapean a modulos son: Corte, Impresión,
 *    Sublimación y Costura (ver `procesoReposicionForArea`).
 */
export const PROCESOS_REPOSICION = [
  "Tela",
  "Impresión",
  "Corte",
  "Sublimación",
  "Costura",
  "Accesorios",
] as const

export type ProcesoReposicion = (typeof PROCESOS_REPOSICION)[number]

/**
 * Mapea el codigo de Area (sin tilde, mismo set que la constante AREAS)
 * a su valor equivalente en PROCESOS_REPOSICION. Devuelve null si el
 * area no participa en el ruteo de reposiciones (Diseno, Empaque) o si
 * no es reconocida.
 *
 * Se exporta porque tanto IncidenciasTab como InstructionsAndComments
 * necesitan resolver "soy parte del array procesos_reposicion?" usando
 * la misma logica.
 */
export function procesoReposicionForArea(
  area: string | undefined | null
): ProcesoReposicion | null {
  if (!area) return null
  switch (area) {
    case "Corte":
    case "corte":
      return "Corte"
    case "Impresion":
    case "impresion":
      return "Impresión"
    case "Sublimacion":
    case "sublimacion":
      return "Sublimación"
    case "Costura":
    case "costura":
      return "Costura"
    default:
      return null
  }
}

// Catalogos cerrados de talla y genero. Se guardan como string plano en BD.
const TALLAS = [
  "Talla 2",
  "Talla 4",
  "Talla 6",
  "T8",
  "T10",
  "T12",
  "T14",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "talla CUSTOM",
  "Yardaje",
  "otros",
] as const

const GENEROS = [
  "NIÑO",
  "JUVENIL",
  "UNISEX",
  "DAMA",
  "CABALLERO",
] as const

// Motivos especificos de incidencia segun el area que reporta. Solo se
// muestran para Diseno, Impresion y Sublimacion. El resto de areas no
// tienen catalogo cerrado y dejan el campo en undefined (la causa se
// describe en "Detalles o comentarios adicionales").
//
// Las claves coinciden EXACTAMENTE con los valores de la constante AREAS
// de arriba (sin tildes) para que el lookup funcione.
const MOTIVOS_POR_AREA: Partial<Record<Area, readonly string[]>> = {
  Diseno: [
    "Nuevo Recurso",
    "Cambio de Diseño",
    "Error en Personalizado",
    "Aprobación tardía",
  ],
  Impresion: [
    "Adaptación Incorrecta",
    "Falta imagen de referencia",
    "Error de personalización",
    "Sin muestra de color",
    "Sin carpeta de archivo",
    "Anomalía por ventas",
  ],
  Sublimacion: [
    "Golpe de impresión",
    "Impresión rayada",
    "Defecto de tela",
    "Cambio de talla",
    "Error de adaptación",
    "Error de personalización",
    "Cambio de tela",
    "Falta corte",
    "Contaminacion por Tamo",
    "Prenda dañada por arrugamiento de papel",
    "Impresion con Vena",
    "Migracion",
    "Pieza Quemada en el Tambor-Por apagon energia",
    "Falla de resistencias",
    "Prenda Doblada",
    "Error de colocacion",
    "Patron cortado incorrecto",
    "Otros",
  ],
}

interface ModalReporteIncidenciaProps {
  pedido: string
  /**
   * Area que esta reportando (el modulo actual desde donde se abre el modal).
   * Se usa para prellenar `area_reporta`.
   */
  areaActual?: Area
  open: boolean
  onClose: () => void
  /** Callback opcional despues de guardar con exito */
  onReported?: () => void
}

export function ModalReporteIncidencia({
  pedido,
  areaActual,
  open,
  onClose,
  onReported,
}: ModalReporteIncidenciaProps) {
  // areaReporta queda fijada al modulo actual (areaActual). Ya no es editable
  // por el usuario: el campo se renderiza disabled mostrando ese valor.
  const areaReporta = areaActual ?? ""
  const [areaGenera, setAreaGenera] = useState<string>("")
  const [talla, setTalla] = useState<string>("")
  const [genero, setGenero] = useState<string>("")
  const [motivoEspecifico, setMotivoEspecifico] = useState<string>("")
  const [descripcion, setDescripcion] = useState<string>("")
  const [generaReposicion, setGeneraReposicion] = useState<boolean>(false)
  const [partesSeleccionadas, setPartesSeleccionadas] = useState<string[]>([])
  // Procesos requeridos para la reposicion (Tela / Impresion / Corte /
  // Sublimacion / Costura / Accesorios). Se guarda como text[] en BD.
  const [procesosSeleccionados, setProcesosSeleccionados] = useState<string[]>(
    []
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lista de motivos disponibles segun el area que reporta. Si el area
  // tiene catalogo cerrado se muestra un Select; de lo contrario se muestra
  // un Input de texto libre. El campo es obligatorio en ambos casos.
  const motivosDisponibles = areaReporta
    ? MOTIVOS_POR_AREA[areaReporta as Area]
    : undefined
  const showMotivoSelect = Boolean(motivosDisponibles?.length)

  // Resetea el form cada vez que el modal se abre.
  useEffect(() => {
    if (open) {
      setAreaGenera("")
      setTalla("")
      setGenero("")
      setMotivoEspecifico("")
      setDescripcion("")
      setGeneraReposicion(false)
      setPartesSeleccionadas([])
      setProcesosSeleccionados([])
      setError(null)
    }
  }, [open, areaActual])

  const togglePart = (parte: string) => {
    setPartesSeleccionadas((prev) =>
      prev.includes(parte) ? prev.filter((p) => p !== parte) : [...prev, parte]
    )
  }

  /**
   * Toggle de un proceso de reposicion. Mantiene el orden cronologico
   * definido en PROCESOS_REPOSICION para que el array persistido se vea
   * coherente al consultarlo despues.
   */
  const toggleProceso = (proceso: string) => {
    setProcesosSeleccionados((prev) =>
      prev.includes(proceso)
        ? prev.filter((p) => p !== proceso)
        : [...prev, proceso]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones minimas
    if (!areaReporta) {
      setError(
        "El area que reporta no esta definida. Abre el modal desde un modulo de produccion."
      )
      return
    }
    if (!areaGenera) {
      setError("Selecciona el area que genero la incidencia.")
      return
    }
    if (!talla) {
      setError("Selecciona la talla afectada.")
      return
    }
    if (!genero) {
      setError("Selecciona el genero de la prenda afectada.")
      return
    }
    // El motivo es obligatorio para todas las areas: seleccionado del
    // catalogo cerrado cuando existe, o ingresado como texto libre.
    if (!motivoEspecifico.trim()) {
      setError("El motivo de la incidencia es obligatorio.")
      return
    }
    if (!descripcion.trim()) {
      setError("Los detalles o comentarios adicionales son obligatorios.")
      return
    }
    if (generaReposicion && partesSeleccionadas.length === 0) {
      setError("Selecciona al menos una parte a reponer.")
      return
    }
    if (generaReposicion && procesosSeleccionados.length === 0) {
      setError(
        "Selecciona al menos un proceso requerido para la reposicion."
      )
      return
    }

    if (!supabase) {
      setError("Cliente de Supabase no configurado.")
      return
    }

    setIsSubmitting(true)

    // Construccion del payload:
    //  - partes_reposicion: CSV ordenado por el orden original de PARTES_REPOSICION
    //  - procesos_reposicion: text[] ordenado por PROCESOS_REPOSICION
    //  - estado_reposicion: 'Pendiente' solo si genera_reposicion = true
    const partesOrdenadas = PARTES_REPOSICION.filter((p) =>
      partesSeleccionadas.includes(p)
    )
    const procesosOrdenados = PROCESOS_REPOSICION.filter((p) =>
      procesosSeleccionados.includes(p)
    )

    const payload = {
      pedido,
      area_reporta: areaReporta,
      area_genera: areaGenera,
      // Catalogos cerrados: se guardan como string plano.
      talla,
      genero,
      // motivo_especifico es obligatorio para todas las areas: puede venir
      // de un catalogo cerrado (Select) o de texto libre (Input).
      motivo_especifico: motivoEspecifico.trim(),
      descripcion: descripcion.trim(),
      genera_reposicion: generaReposicion,
      partes_reposicion: generaReposicion ? partesOrdenadas.join(", ") : null,
      // Array de procesos. Se persiste como text[] en Postgres; cuando no
      // hay reposicion mandamos null para limpiar valores previos.
      procesos_reposicion: generaReposicion ? procesosOrdenados : null,
      estado_reposicion: generaReposicion ? "Pendiente" : null,
    }

    const { error: insertError } = await supabase
      .schema("telas")
      .from("incidencias")
      .insert(payload)

    setIsSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      toast.error("Error al guardar la incidencia", {
        description: insertError.message,
      })
      return
    }

    toast.success("Incidencia reportada", {
      description: generaReposicion
        ? `Se registro la incidencia del pedido ${pedido} con reposicion pendiente.`
        : `Se registro la incidencia del pedido ${pedido}.`,
    })

    onReported?.()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="size-5 text-rose-600" />
            Reportar Incidencia
          </DialogTitle>
          <DialogDescription>
            Registra una no conformidad para el pedido{" "}
            <span className="font-medium text-foreground">{pedido}</span>. Si la
            incidencia requiere reposicion, indica las partes afectadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Areas: reporta (bloqueada) y genera (libre) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="area_reporta" className="text-sm">
                Area que reporta
              </Label>
              {/* area_reporta queda fijada al modulo actual y no es editable.
                  Se renderiza como Select disabled para mantener consistencia
                  visual con los demas campos. */}
              <Select value={areaReporta} disabled>
                <SelectTrigger
                  id="area_reporta"
                  className="bg-muted text-foreground disabled:opacity-100 cursor-not-allowed"
                  aria-readonly
                >
                  <SelectValue placeholder="No definida" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determinada por el modulo desde el que reportas.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area_genera" className="text-sm">
                Area que genero el error
              </Label>
              <Select
                value={areaGenera}
                onValueChange={setAreaGenera}
                disabled={isSubmitting}
              >
                <SelectTrigger id="area_genera">
                  <SelectValue placeholder="Selecciona un area" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS_GENERA_ERROR.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Talla y Genero: catalogos cerrados, ambos obligatorios */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="talla" className="text-sm">
                Talla
              </Label>
              <Select
                value={talla}
                onValueChange={setTalla}
                disabled={isSubmitting}
              >
                <SelectTrigger id="talla">
                  <SelectValue placeholder="Selecciona una talla" />
                </SelectTrigger>
                <SelectContent>
                  {TALLAS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="genero" className="text-sm">
                Genero
              </Label>
              <Select
                value={genero}
                onValueChange={setGenero}
                disabled={isSubmitting}
              >
                <SelectTrigger id="genero">
                  <SelectValue placeholder="Selecciona un genero" />
                </SelectTrigger>
                <SelectContent>
                  {GENEROS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motivo de la Incidencia: obligatorio para todas las areas.
              - Areas con catalogo cerrado (Diseno, Impresion, Sublimacion):
                se muestra un Select con los motivos predefinidos.
              - Resto de areas: se muestra un Input de texto libre para que
                el usuario describa el motivo con sus propias palabras. */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo_especifico" className="text-sm">
              Motivo de la Incidencia{" "}
              <span className="text-rose-600">*</span>
            </Label>
            {showMotivoSelect ? (
              <>
                <Select
                  value={motivoEspecifico}
                  onValueChange={setMotivoEspecifico}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="motivo_especifico">
                    <SelectValue placeholder="Selecciona el motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosDisponibles!.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Catalogo especifico del area de{" "}
                  <span className="font-medium">{areaReporta}</span>.
                </p>
              </>
            ) : (
              <>
                <Textarea
                  id="motivo_especifico"
                  value={motivoEspecifico}
                  onChange={(e) => setMotivoEspecifico(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Describe brevemente el motivo de la incidencia..."
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Campo obligatorio. Resume el origen o causa principal.
                </p>
              </>
            )}
          </div>

          {/* Descripcion / detalles adicionales */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion" className="text-sm">
              Detalles o comentarios adicionales
            </Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={isSubmitting}
              placeholder={
                showMotivoSelect
                  ? "Amplia la informacion del motivo seleccionado..."
                  : "Describe que ocurrio, piezas afectadas, causa probable..."
              }
              rows={4}
              className="text-sm"
            />
          </div>

          <Separator />

          {/* Switch: genera reposicion */}
          <label
            htmlFor="genera_reposicion"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              generaReposicion
                ? "border-rose-400 bg-rose-50"
                : "border-rose-200 bg-rose-50/40 hover:bg-rose-50/70"
            }`}
          >
            <Checkbox
              id="genera_reposicion"
              checked={generaReposicion}
              onCheckedChange={(v) => setGeneraReposicion(v === true)}
              className="mt-0.5"
              disabled={isSubmitting}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <AlertOctagon className="size-4 text-rose-700" />
                <span className="text-sm font-semibold text-rose-900">
                  Genera reposicion
                </span>
              </div>
              <p className="text-xs text-rose-800/80">
                Marca esta opcion si la incidencia obliga a reponer una o mas
                partes. Indica a continuacion cuales.
              </p>
            </div>
          </label>

          {/* Partes a reponer (condicional) */}
          {generaReposicion && (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/30 p-4">
              <Label className="text-sm font-medium text-rose-900">
                Partes a reponer
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PARTES_REPOSICION.map((parte) => {
                  const checked = partesSeleccionadas.includes(parte)
                  return (
                    <label
                      key={parte}
                      htmlFor={`parte_${parte}`}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-rose-400 bg-white text-rose-900"
                          : "border-slate-200 bg-white/60 hover:bg-white"
                      }`}
                    >
                      <Checkbox
                        id={`parte_${parte}`}
                        checked={checked}
                        onCheckedChange={() => togglePart(parte)}
                        disabled={isSubmitting}
                      />
                      <span>{parte}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-rose-700/80">
                Se guardan como lista separada por comas en{" "}
                <code className="text-[11px]">partes_reposicion</code> y el{" "}
                <code className="text-[11px]">estado_reposicion</code> quedara
                como <strong>Pendiente</strong>.
              </p>

              {/* Procesos requeridos: define el ruteo selectivo de la
                  reposicion. Solo los modulos cuyo nombre aparezca aqui
                  veran la incidencia en su pestana de Reposiciones. */}
              <div className="space-y-2 pt-2 border-t border-rose-200/70">
                <Label className="text-sm font-medium text-rose-900">
                  Procesos requeridos para la reposicion
                </Label>
                <p className="text-xs text-rose-700/80">
                  La reposicion <strong>solo</strong> aparecera en los modulos
                  marcados aqui. <em>Tela</em> y <em>Accesorios</em> son
                  metadatos para insumos.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROCESOS_REPOSICION.map((proceso) => {
                    const checked = procesosSeleccionados.includes(proceso)
                    return (
                      <label
                        key={proceso}
                        htmlFor={`proceso_${proceso}`}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? "border-rose-500 bg-rose-100/70 text-rose-900"
                            : "border-slate-200 bg-white/60 hover:bg-white"
                        }`}
                      >
                        <Checkbox
                          id={`proceso_${proceso}`}
                          checked={checked}
                          onCheckedChange={() => toggleProceso(proceso)}
                          disabled={isSubmitting}
                        />
                        <span className="font-medium">{proceso}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className="mr-1 size-4 text-icon-coral" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Send className="mr-1 size-4" />
              )}
              Enviar Reporte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
