import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Telas Creativas — Sistema de Producción",
    short_name: "TelasPro",
    description: "Sistema interno de gestión y programación de producción textil",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#4f46e5",
    theme_color: "#4f46e5",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
  }
}
