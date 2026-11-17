import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoChatbubbleOutline,
  IoCloseOutline,
  IoReloadOutline,
  IoSendOutline,
} from 'react-icons/io5'
import type { CommentWithReplies, CommentWithUser } from '@onyka/shared'
import { shareLinksApi, ApiException } from '@/services/api'
import { formatRelativeTime } from '@/utils/format'

interface SharedNoteDiscussionProps {
  token: string
  accessToken: string
  /** inline = below content; panel = slide-over drawer */
  mode?: 'inline' | 'panel'
  isOpen?: boolean
  onClose?: () => void
  onCountChange?: (count: number) => void
}

function GuestCommentRow({
  comment,
  isReply,
}: {
  comment: CommentWithUser
  isReply?: boolean
}) {
  const { t, i18n } = useTranslation()
  const label = comment.isGuest
    ? t('link_share.guest_author', { name: comment.guestName || comment.user.username })
    : comment.user.username

  return (
    <div className={isReply ? 'ml-8 mt-2' : ''}>
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className={`${isReply ? 'text-xs' : 'text-sm'} font-medium text-[var(--color-text-primary)]`}>
          {label}
        </span>
        {comment.isGuest && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
            {t('link_share.guest_badge_short')}
          </span>
        )}
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {formatRelativeTime(comment.createdAt, i18n.language, t)}
        </span>
      </div>
      <p className={`${isReply ? 'text-xs' : 'text-sm'} text-[var(--color-text-secondary)] break-words whitespace-pre-wrap`}>
        {comment.content}
      </p>
    </div>
  )
}

function DiscussionBody({
  token,
  accessToken,
  onCountChange,
  compactHeader,
}: {
  token: string
  accessToken: string
  onCountChange?: (count: number) => void
  compactHeader?: boolean
}) {
  const { t } = useTranslation()
  const [comments, setComments] = useState<CommentWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem('onyka_guest_name') || ''
    } catch {
      return ''
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { comments: list } = await shareLinksApi.listPublicComments(token, accessToken)
      setComments(list)
      const total = list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)
      onCountChange?.(total)
    } catch (err) {
      setError(err instanceof ApiException ? err.message : t('link_share.comments_load_failed'))
      setComments([])
      onCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }, [token, accessToken, t, onCountChange])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const nick = guestName.trim()
      if (nick) {
        try {
          localStorage.setItem('onyka_guest_name', nick)
        } catch {
          /* ignore */
        }
      }
      await shareLinksApi.postPublicComment(token, accessToken, {
        content: content.trim(),
        parentId: replyTo || undefined,
        guestName: nick || undefined,
      })
      setContent('')
      setReplyTo(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiException ? err.message : t('link_share.comments_post_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {!compactHeader && (
        <div className="flex items-center gap-2 mb-4">
          <IoChatbubbleOutline className="w-4 h-4 text-[var(--color-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('link_share.discussion')}
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
            title={t('common.refresh')}
          >
            <IoReloadOutline className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
        {t('link_share.discussion_hint')}
      </p>

      <div className="space-y-3 mb-4">
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value.slice(0, 40))}
          placeholder={t('link_share.guest_name_placeholder')}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm"
          maxLength={40}
        />
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-accent)]">
            <span>{t('link_share.replying')}</span>
            <button type="button" className="underline" onClick={() => setReplyTo(null)}>
              {t('common.cancel')}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 2000))}
            placeholder={t('link_share.guest_comment_placeholder')}
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm resize-none"
          />
          <button
            type="button"
            disabled={submitting || !content.trim()}
            onClick={() => void submit()}
            className="self-end h-10 w-10 rounded-lg bg-[var(--color-accent)] text-white flex items-center justify-center disabled:opacity-50"
          >
            {submitting ? (
              <IoReloadOutline className="w-4 h-4 animate-spin" />
            ) : (
              <IoSendOutline className="w-4 h-4" />
            )}
          </button>
        </div>
        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && comments.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">{t('comments.empty')}</p>
        ) : (
          <ul className="space-y-4 pb-4">
            {comments.map((c) => (
              <li key={c.id}>
                <GuestCommentRow comment={c} />
                <button
                  type="button"
                  onClick={() => setReplyTo(c.id)}
                  className="mt-1 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
                >
                  {t('comments.reply')}
                </button>
                {c.replies?.map((r) => (
                  <GuestCommentRow key={r.id} comment={r} isReply />
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function SharedNoteDiscussion({
  token,
  accessToken,
  mode = 'inline',
  isOpen = true,
  onClose,
  onCountChange,
}: SharedNoteDiscussionProps) {
  const { t } = useTranslation()

  if (mode === 'panel') {
    if (!isOpen) return null
    return createPortal(
      <div className="fixed inset-0 z-[70] flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          aria-label={t('common.close')}
          onClick={onClose}
        />
        <aside className="relative z-10 w-full max-w-md h-full flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-subtle)] shrink-0">
            <IoChatbubbleOutline className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex-1">
              {t('link_share.discussion')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
              aria-label={t('common.close')}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-4">
            <DiscussionBody
              token={token}
              accessToken={accessToken}
              onCountChange={onCountChange}
              compactHeader
            />
          </div>
        </aside>
      </div>,
      document.body
    )
  }

  return (
    <section id="share-discussion" className="mt-8 border-t border-[var(--color-border-subtle)] pt-6">
      <DiscussionBody token={token} accessToken={accessToken} onCountChange={onCountChange} />
    </section>
  )
}
