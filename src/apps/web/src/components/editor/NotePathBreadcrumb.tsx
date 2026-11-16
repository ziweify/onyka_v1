import { useThemeStore } from '@/stores/theme'
import { folderChipStyle, resolveFolderColorHex } from '@/utils/folderColor'
import type { PathSegment } from '@/utils/notePath'

interface NotePathBreadcrumbProps {
  segments: PathSegment[]
  className?: string
}

/** Inline path using colored chips when folders have colors assigned. */
export function NotePathBreadcrumb({ segments, className = '' }: NotePathBreadcrumbProps) {
  const theme = useThemeStore((s) => s.theme)
  if (segments.length === 0) return null

  return (
    <p
      className={`min-w-0 text-[11px] text-[var(--color-text-tertiary)] font-medium truncate ${className}`}
      title={segments.map((s) => s.name).join(' / ')}
    >
      {segments.map((segment, index) => {
        const hex = resolveFolderColorHex(segment.color, theme)
        return (
          <span key={`${index}-${segment.name}`}>
            {index > 0 && <span className="opacity-40 mx-0.5">/</span>}
            {hex ? (
              <span
                className="inline-block max-w-[9rem] truncate align-middle px-1.5 py-px rounded border text-[10px] font-semibold"
                style={folderChipStyle(hex)}
              >
                {segment.name}
              </span>
            ) : (
              <span>{segment.name}</span>
            )}
          </span>
        )
      })}
    </p>
  )
}
