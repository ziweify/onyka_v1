import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText } from '../codecUtils'

const PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Tailwind',
    colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0f172a'],
  },
  {
    name: 'Pastel',
    colors: ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#e2e8f0', '#f8fafc'],
  },
  {
    name: 'Neon',
    colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06d6a0', '#118ab2', '#ef476f', '#ffd166', '#073b4c'],
  },
  {
    name: 'Earth',
    colors: ['#582f0e', '#7f4f24', '#936639', '#a68a64', '#b6ad90', '#c2c5aa', '#a4ac86', '#656d4a', '#414833', '#333d29'],
  },
  {
    name: 'Ocean',
    colors: ['#012a4a', '#013a63', '#01497c', '#014f86', '#2a6f97', '#2c7da0', '#468faf', '#61a5c2', '#89c2d9', '#a9d6e5'],
  },
]

export function ColorTool() {
  const { t } = useTranslation()
  const [picked, setPicked] = useState('#F59E0B')
  const [copied, setCopied] = useState<string | null>(null)

  const onCopy = async (hex: string) => {
    setPicked(hex)
    if (await copyText(hex)) {
      setCopied(hex)
      setTimeout(() => setCopied(null), 1000)
    }
  }

  return (
    <div className="h-full overflow-auto flex flex-col gap-3 pr-1">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-[var(--color-border)] bg-transparent"
        />
        <button
          type="button"
          onClick={() => void onCopy(picked)}
          className="h-8 px-3 rounded-lg border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
        >
          {picked.toUpperCase()}
          {copied === picked ? ` · ${t('utilities.copied')}` : ''}
        </button>
      </div>
      {PALETTES.map((palette) => (
        <div key={palette.name} className="space-y-1.5">
          <div className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{palette.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {palette.colors.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => void onCopy(hex)}
                className="w-8 h-8 rounded-md border border-black/10 dark:border-white/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
