"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface TablePaginationProps {
  currentPage: number // zero-based
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

/**
 * Pie de paginacion compartido por todas las tablas de modulos.
 * Muestra rango actual ("Mostrando X-Y de Z"), navegacion primera/anterior/
 * siguiente/ultima y un indicador "Pagina N de M". Disenado para acompanar
 * un contenedor con scroll vertical de altura fija que envuelve la tabla.
 */
export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages - 1)
  const start = totalItems === 0 ? 0 : safePage * pageSize + 1
  const end = Math.min((safePage + 1) * pageSize, totalItems)

  // No mostrar nada si todo cabe en una sola pagina
  if (totalItems <= pageSize) {
    return (
      <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
        <span>
          Mostrando {totalItems} {totalItems === 1 ? "registro" : "registros"}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}</span>
        {"-"}
        <span className="font-medium text-foreground">{end}</span> de{" "}
        <span className="font-medium text-foreground">{totalItems}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(0)}
          disabled={safePage === 0}
          aria-label="Primera pagina"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 0}
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          Pagina <span className="font-medium text-foreground">{safePage + 1}</span> de{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages - 1}
          aria-label="Pagina siguiente"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={safePage >= totalPages - 1}
          aria-label="Ultima pagina"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export const DEFAULT_PAGE_SIZE = 100
