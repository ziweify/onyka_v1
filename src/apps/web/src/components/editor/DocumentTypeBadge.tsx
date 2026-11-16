import { IoLogoMarkdown, IoDocumentTextOutline, IoGlobeOutline } from 'react-icons/io5'

export type DocumentTypeKind = 'markdown' | 'text' | 'web'

interface DocumentTypeBadgeProps {
  kind: DocumentTypeKind
  label: string
  className?: string
  onClick?: () => void
  title?: string
}

const KIND_STYLE: Record<DocumentTypeKind, string> = {
  markdown:
    'bg-[#CE9178]/15 text-[#CE9178] border-[#CE9178]/35 dark:bg-[#CE9178]/20 dark:text-[#CE9178]',
  text: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/25',
  web: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
}

export function DocumentTypeBadge({ kind, label, className = '', onClick, title }: DocumentTypeBadgeProps) {
  const Icon =
    kind === 'markdown' ? IoLogoMarkdown : kind === 'web' ? IoGlobeOutline : IoDocumentTextOutline

  const base =
    `inline-flex items-center gap-0.5 shrink-0 px-1.5 py-px rounded border text-[10px] font-bold tracking-wide uppercase ${KIND_STYLE[kind]} ${className}`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} hover:opacity-90 transition-opacity`} title={title || label}>
        <Icon className="w-3 h-3" />
        {label}
      </button>
    )
  }

  return (
    <span className={base} title={title || label}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}
