import { ImageResponse } from "next/og"
import { TCLogoIcon } from "../tc-logo-icon"

export function GET() {
  return new ImageResponse(<TCLogoIcon size={192} rounded />, {
    width: 192,
    height: 192,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
