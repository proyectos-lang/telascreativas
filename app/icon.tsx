import { ImageResponse } from "next/og"
import { TCLogoIcon } from "./icons/tc-logo-icon"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<TCLogoIcon size={32} rounded logoScale={0.78} />, { ...size })
}
