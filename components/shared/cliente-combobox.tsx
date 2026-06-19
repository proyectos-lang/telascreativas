"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClienteComboboxProps {
  /** Current selected/typed value */
  value: string
  /** List of known cliente names derived from the loaded orders */
  clientes: string[]
  onChange: (value: string) => void
  id?: string
}

/**
 * Combobox for the "Cliente" filter.
 *
 * - Typing filters the dropdown list in real-time (case-insensitive,
 *   also matches partial text).
 * - Selecting an item from the list fills the input exactly.
 * - The filter value is whatever the user has typed/selected, so partial
 *   text searches work as well as full exact selections.
 * - A small clear button appears when the field is not empty.
 */
export function ClienteCombobox({
  value,
  clientes,
  onChange,
  id = "filter-cliente",
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = value
    ? clientes.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      )
    : clientes

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Input
          id={id}
          autoComplete="off"
          placeholder="Buscar cliente..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="h-8 pr-14 text-xs"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tabIndex={-1}
            onClick={() => {
              onChange("")
              setOpen(false)
            }}
            className="absolute right-6 size-5 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar cliente"
          >
            <X className="size-3" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-0 size-7 text-muted-foreground hover:text-foreground"
          aria-label="Abrir lista de clientes"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>

      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover shadow-md text-xs"
        >
          {filtered.map((cliente) => (
            <li
              key={cliente}
              role="option"
              aria-selected={value === cliente}
              onMouseDown={(e) => {
                // prevent input blur before we set value
                e.preventDefault()
                onChange(cliente)
                setOpen(false)
              }}
              className={cn(
                "cursor-pointer px-3 py-1.5 hover:bg-accent hover:text-accent-foreground",
                value === cliente && "bg-accent/60 font-medium"
              )}
            >
              {cliente}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
