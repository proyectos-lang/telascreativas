import { ImageResponse } from "next/og"
import { TCLogoIcon } from "../tc-logo-icon"

// Maskable icon: full-bleed background, logo inside the safe zone (center ~60%)
export function GET() {
  return new ImageResponse(<TCLogoIcon size={512} rounded={false} logoScale={0.55} />, {
    width: 512,
    height: 512,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
