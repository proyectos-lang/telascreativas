import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Telas Creativas — Sistema de Producción",
    short_name: "TelasPro",
    description: "Sistema interno de gestión y programación de producción textil",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/telas-creativas-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
  }
}
