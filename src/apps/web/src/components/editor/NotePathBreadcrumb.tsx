interface NotePathBreadcrumbProps {
  segments: string[]
  className?: string
}

/** Inline path using the same visual language as the date/meta row below the title. */
export function NotePathBreadcrumb({ segments, className = '' }: NotePathBreadcrumbProps) {
  if (segments.length === 0) return null

  return (
    <p
      className={`min-w-0 text-[11px] text-[var(--color-text-tertiary)] font-medium truncate ${className}`}
      title={segments.join(' / ')}
    >
      {segments.map((segment, index) => (
        <span key={`${index}-${segment}`}>
          {index > 0 && <span className="opacity-40 mx-0.5">/</span>}
          <span>{segment}</span>
        </span>
      ))}
    </p>
  )
}
