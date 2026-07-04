import { ImageResponse } from "next/og"
import { TCLogoIcon } from "./icons/tc-logo-icon"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(<TCLogoIcon size={180} rounded={false} logoScale={0.70} />, {
    ...size,
  })
}
