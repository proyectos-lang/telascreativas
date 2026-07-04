"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { GDWatermarkImage } from "./gd-watermark-image"

interface GDImageLightboxProps {
  src: string
  open: boolean
  onClose: () => void
}

export function GDImageLightbox({ src, open, onClose }: GDImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-2 overflow-auto bg-black/90 border-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="size-4" />
        </Button>
        <GDWatermarkImage
          src={src}
          alt="Vista ampliada"
          className="rounded-md"
          fullSize
        />
      </DialogContent>
    </Dialog>
  )
}
