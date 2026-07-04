import { ImageResponse } from "next/og"
import { TCLogoIcon } from "../tc-logo-icon"

export function GET() {
  return new ImageResponse(<TCLogoIcon size={512} rounded />, {
    width: 512,
    height: 512,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
