import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCopyOutline } from 'react-icons/io5'
import { copyText } from './codecUtils'
import { useState } from 'react'

export function ToolField({
  label,
  value,
  onChange,
  rows = 5,
  mono = true,
  placeholder,
  readOnly,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  rows?: number
  mono?: boolean
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 min-h-0 flex-1">
      <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{label}</span>
      <textarea
        value={value}
        readOnly={readOnly}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full flex-1 min-h-[72px] resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] ${
          mono ? 'font-mono' : ''
        }`}
      />
    </label>
  )
}

export function ToolActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 shrink-0">{children}</div>
}

export function ToolButton({
  onClick,
  children,
  primary,
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-40 ${
        primary
          ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
          : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      {children}
    </button>
  )
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [ok, setOk] = useState(false)
  return (
    <ToolButton
      disabled={!text}
      onClick={async () => {
        const success = await copyText(text)
        if (success) {
          setOk(true)
          setTimeout(() => setOk(false), 1200)
        }
      }}
    >
      <span className="inline-flex items-center gap-1">
        <IoCopyOutline className="w-3 h-3" />
        {ok ? t('utilities.copied') : t('utilities.copy')}
      </span>
    </ToolButton>
  )
}

export function ToolError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-[11px] text-red-500 shrink-0">{message}</p>
}
