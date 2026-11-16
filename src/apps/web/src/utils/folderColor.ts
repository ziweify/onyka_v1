import type { CSSProperties } from 'react'
import { ACCENT_COLORS, type AccentColor } from '@/stores/theme'

const ACCENT_IDS = new Set(ACCENT_COLORS.map((c) => c.id))

export function isFolderColorId(value: string | null | undefined): value is AccentColor {
  return Boolean(value && ACCENT_IDS.has(value as AccentColor))
}

/** Resolve folder accent id to hex for current theme mode. */
export function resolveFolderColorHex(
  colorId: string | null | undefined,
  theme: 'light' | 'dark'
): string | null {
  if (!isFolderColorId(colorId)) return null
  const entry = ACCENT_COLORS.find((c) => c.id === colorId)
  if (!entry) return null
  return theme === 'dark' ? entry.dark : entry.light
}

export function folderRowBackground(hex: string, strength = 0.16): string {
  return `color-mix(in srgb, ${hex} ${Math.round(strength * 100)}%, transparent)`
}

export function folderSectionBackground(hex: string): string {
  return `color-mix(in srgb, ${hex} 8%, transparent)`
}

export function folderChipStyle(hex: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 22%, transparent)`,
    color: hex,
    borderColor: `color-mix(in srgb, ${hex} 35%, transparent)`,
  }
}
