import Link from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'
import { isAllowedLinkHref } from '@/utils/noteLinks'

export const EditorLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href || '')
    const internal = href.startsWith('onyka://') || href.startsWith('#')
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: internal
          ? 'editor-link editor-link-internal text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 hover:decoration-[var(--color-accent)] transition-colors cursor-pointer'
          : 'editor-link text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 hover:decoration-[var(--color-accent)] transition-colors cursor-pointer',
        ...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer nofollow' }),
      }),
      0,
    ]
  },
}).configure({
  openOnClick: false,
  validate: (href) => isAllowedLinkHref(href),
})
