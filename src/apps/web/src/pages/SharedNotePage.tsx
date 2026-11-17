import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  IoLockClosedOutline,
  IoReloadOutline,
  IoSendOutline,
  IoTimeOutline,
} from 'react-icons/io5'
import type {
  CommentWithReplies,
  CommentWithUser,
  PublicShareAuthor,
  PublicShareContent,
  PublicShareLinkMeta,
} from '@onyka/shared'
import { shareLinksApi, attachmentsApi, ApiException } from '@/services/api'
import { WebSnapshotViewer } from '@/components/editor/WebSnapshotViewer'
import { extractWebSnapshotId } from '@/utils/webSnapshot'
import { formatRelativeTime, getInitials } from '@/utils/format'
import { getAvatarRingClass } from '@/utils/avatar'

function useCountdown(expiresAt: string | Date | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return useMemo(() => {
    if (!expiresAt) return null
    const ms = new Date(expiresAt).getTime() - now
    if (ms <= 0) return { expired: true, label: '0:00:00' }
    const total = Math.floor(ms / 1000)
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return {
      expired: false,
      label: d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`,
    }
  }, [expiresAt, now])
}

/** Left rail — Discuz-style user column */
function FloorUserRail({
  author,
  floor,
  isOp,
  isGuest,
  timeLabel,
}: {
  author: { username: string; name?: string; avatarUrl?: string; avatarColor?: string }
  floor: number
  isOp?: boolean
  isGuest?: boolean
  timeLabel?: string
}) {
  const { t } = useTranslation()
  const display = author.name || author.username

  return (
    <aside className="w-[120px] sm:w-[140px] shrink-0 bg-[var(--color-bg-tertiary)]/50 px-2 py-3 flex flex-col items-center text-center border-r border-[var(--color-border)]">
      {author.avatarUrl ? (
        <img
          src={author.avatarUrl}
          alt={display}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ${getAvatarRingClass(author.avatarColor)}`}
        />
      ) : (
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-primary)] ring-2 ${getAvatarRingClass(author.avatarColor)}`}
        >
          {getInitials(display)}
        </div>
      )}
      <p className="mt-2 text-xs sm:text-sm font-medium text-[var(--color-text-primary)] break-all leading-snug">
        {display}
      </p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
          {t('link_share.floor', { n: floor })}
        </span>
        {isOp && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            {t('link_share.op')}
          </span>
        )}
        {isGuest && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
            {t('link_share.guest_badge_short')}
          </span>
        )}
      </div>
      {timeLabel && (
        <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)] leading-tight">{timeLabel}</p>
      )}
    </aside>
  )
}

/** One continuous forum row (no outer gap between floors) */
function ForumRow({
  author,
  floor,
  isOp,
  isGuest,
  timeLabel,
  children,
  contentClassName,
}: {
  author: { username: string; name?: string; avatarUrl?: string; avatarColor?: string }
  floor: number
  isOp?: boolean
  isGuest?: boolean
  timeLabel?: string
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <div className="flex border-b border-[var(--color-border)] last:border-b-0 bg-[var(--color-bg-secondary)]">
      <FloorUserRail
        author={author}
        floor={floor}
        isOp={isOp}
        isGuest={isGuest}
        timeLabel={timeLabel}
      />
      <div className={`flex-1 min-w-0 p-3 sm:p-4 ${contentClassName ?? ''}`}>{children}</div>
    </div>
  )
}

function authorFromComment(c: CommentWithUser): PublicShareAuthor {
  return {
    username: c.user.username,
    name: c.isGuest
      ? c.guestName || c.user.username
      : c.user.name || c.user.username,
    avatarUrl: c.isGuest ? undefined : c.user.avatarUrl,
    avatarColor: c.user.avatarColor,
  }
}

export function SharedNotePage() {
  const { token = '' } = useParams<{ token: string }>()
  const { t, i18n } = useTranslation()
  const [meta, setMeta] = useState<PublicShareLinkMeta | null>(null)
  const [content, setContent] = useState<PublicShareContent | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [activePage, setActivePage] = useState(0)

  const [comments, setComments] = useState<CommentWithReplies[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [guestName, setGuestName] = useState(() => {
    try {
      return localStorage.getItem('onyka_guest_name') || ''
    } catch {
      return ''
    }
  })
  const [replyBody, setReplyBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const countdown = useCountdown(content?.expiresAt ?? meta?.expiresAt ?? null)

  const loadMeta = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { meta: m } = await shareLinksApi.getPublicMeta(token)
      setMeta(m)
      if (m.status === 'active' && !m.needsPassword && !m.isExpired && !m.isExhausted) {
        const opened = await shareLinksApi.openPublic(token)
        setContent(opened.content)
        setAccessToken(opened.accessToken)
      }
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : t('link_share.guest_unavailable')
      )
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (token) void loadMeta()
  }, [token, loadMeta])

  const loadComments = useCallback(async () => {
    if (!accessToken || !content?.allowGuestComments) return
    setCommentsLoading(true)
    try {
      const { comments: list } = await shareLinksApi.listPublicComments(token, accessToken)
      setComments([...list].reverse())
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [accessToken, content?.allowGuestComments, token])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

  const handleUnlock = async () => {
    setOpening(true)
    setError(null)
    try {
      const opened = await shareLinksApi.openPublic(token, password)
      setContent(opened.content)
      setAccessToken(opened.accessToken)
      setMeta((m) =>
        m
          ? {
              ...m,
              viewCount: opened.content.viewCount,
              remainingViews: opened.content.remainingViews,
              allowGuestComments: opened.content.allowGuestComments,
              author: opened.content.author,
            }
          : m
      )
    } catch (err) {
      if (err instanceof ApiException && err.code === 'INVALID_PASSWORD') {
        setError(t('link_share.wrong_password'))
      } else if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError(t('link_share.guest_unavailable'))
      }
    } finally {
      setOpening(false)
    }
  }

  const submitReply = async () => {
    if (!accessToken || !replyBody.trim() || submitting) return
    setSubmitting(true)
    setCommentError(null)
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
        content: replyBody.trim(),
        parentId: replyTo || undefined,
        guestName: nick || undefined,
      })
      setReplyBody('')
      setReplyTo(null)
      await loadComments()
    } catch (err) {
      setCommentError(
        err instanceof ApiException ? err.message : t('link_share.comments_post_failed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const unavailable =
    error ||
    (meta &&
      (meta.status !== 'active' || meta.isExpired || meta.isExhausted || countdown?.expired))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (unavailable && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <IoLockClosedOutline className="w-10 h-10 mx-auto text-[var(--color-text-tertiary)]" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('link_share.guest_unavailable')}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {error ||
              (meta?.isExpired || countdown?.expired
                ? t('link_share.guest_expired')
                : meta?.isExhausted
                  ? t('link_share.guest_exhausted')
                  : t('link_share.guest_revoked'))}
          </p>
        </div>
      </div>
    )
  }

  if (meta?.needsPassword && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-sm w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
          <div className="text-center space-y-1">
            <IoLockClosedOutline className="w-8 h-8 mx-auto text-[var(--color-accent)]" />
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              {meta.noteTitle || t('editor.untitled')}
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('link_share.guest_password_hint')}
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleUnlock()
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm"
            placeholder={t('link_share.password_placeholder')}
          />
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          <button
            type="button"
            disabled={opening || password.length < 1}
            onClick={() => void handleUnlock()}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {opening ? t('common.loading') : t('link_share.guest_open')}
          </button>
        </div>
      </div>
    )
  }

  if (!content) return null

  const page = content.pages[activePage] ?? content.pages[0]
  const snapshotId = extractWebSnapshotId(page?.content)
  const isSnapshot = Boolean(snapshotId && accessToken)
  const author = content.author || meta?.author || {
    username: 'author',
    name: 'Author',
    avatarColor: 'blue',
  }
  const replyCount = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)

  return (
    <div className="h-dvh overflow-y-auto overscroll-contain bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 sm:px-4 py-2.5">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{t('link_share.guest_badge')}</p>
            <h1 className="text-base font-semibold truncate">
              {content.noteTitle || t('editor.untitled')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {countdown && !countdown.expired && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg-tertiary)]">
                <IoTimeOutline className="w-3.5 h-3.5" />
                {t('link_share.countdown', { time: countdown.label })}
              </span>
            )}
            {content.remainingViews != null && (
              <span className="px-2 py-1 rounded bg-[var(--color-bg-tertiary)]">
                {t('link_share.remaining_views', { count: content.remainingViews })}
              </span>
            )}
            {content.allowGuestComments && accessToken && (
              <a
                href="#share-replies"
                className="px-2 py-1 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
              >
                {t('link_share.replies_heading', { count: replyCount })}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1280px] mx-auto px-0 sm:px-3 py-3 pb-8">
        {content.pages.length > 1 && (
          <div className="flex gap-1 overflow-x-auto px-2 sm:px-0 mb-2 ml-[120px] sm:ml-[140px]">
            {content.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePage(i)}
                className={`px-3 py-1 rounded text-xs whitespace-nowrap ${
                  i === activePage
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                {p.title || t('pages.untitled', { defaultValue: `Page ${i + 1}` })}
              </button>
            ))}
          </div>
        )}

        {/* Single continuous thread board — like Discuz floors */}
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] shadow-sm">
          {/* Floor 1 */}
          <ForumRow
            floor={1}
            author={author}
            isOp
            timeLabel={formatRelativeTime(content.updatedAt, i18n.language, t)}
            contentClassName={isSnapshot ? '!p-0' : undefined}
          >
            {isSnapshot ? (
              <WebSnapshotViewer
                attachmentId={snapshotId!}
                title={content.noteTitle}
                downloadUrl={attachmentsApi.publicShareDownloadUrl(
                  token,
                  snapshotId!,
                  accessToken!
                )}
                autoHeight
                className="!rounded-none !border-0"
              />
            ) : (
              <div className="space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
                  {content.noteTitle || t('editor.untitled')}
                </h2>
                <article
                  className="prose prose-sm md:prose-base dark:prose-invert max-w-none fluid-editor-content"
                  dangerouslySetInnerHTML={{ __html: page?.content || '' }}
                />
              </div>
            )}
          </ForumRow>

          {/* Reply floors — packed, no gap */}
          {content.allowGuestComments && accessToken && (
            <>
              <div
                id="share-replies"
                className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--color-bg-tertiary)]/40 border-b border-[var(--color-border)] scroll-mt-16"
              >
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('link_share.replies_heading', { count: replyCount })}
                </span>
                <button
                  type="button"
                  onClick={() => void loadComments()}
                  className="p-1 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
                  title={t('common.refresh')}
                >
                  <IoReloadOutline
                    className={`w-3.5 h-3.5 ${commentsLoading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {commentsLoading && comments.length === 0 && (
                <div className="px-4 py-6 text-xs text-[var(--color-text-tertiary)] text-center">
                  {t('common.loading')}
                </div>
              )}

              {!commentsLoading && comments.length === 0 && (
                <div className="px-4 py-6 text-xs text-[var(--color-text-tertiary)] text-center">
                  {t('comments.empty')}
                </div>
              )}

              {comments.map((c, idx) => (
                <ForumRow
                  key={c.id}
                  floor={idx + 2}
                  author={authorFromComment(c)}
                  isGuest={c.isGuest}
                  timeLabel={formatRelativeTime(c.createdAt, i18n.language, t)}
                >
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                    {c.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(c.id)
                      document.getElementById('share-reply-box')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      })
                    }}
                    className="mt-2 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
                  >
                    {t('comments.reply')}
                  </button>
                  {c.replies && c.replies.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l border-[var(--color-border)] pl-3">
                      {c.replies.map((r) => (
                        <li key={r.id} className="text-sm">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-medium text-[var(--color-text-primary)] text-xs">
                              {r.isGuest
                                ? t('link_share.guest_author', {
                                    name: r.guestName || r.user.username,
                                  })
                                : r.user.username}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                              {formatRelativeTime(r.createdAt, i18n.language, t)}
                            </span>
                          </div>
                          <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap break-words mt-0.5">
                            {r.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </ForumRow>
              ))}

              {/* Composer as last board row — not a floating strip */}
              <div
                id="share-reply-box"
                className="flex border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
              >
                <aside className="w-[120px] sm:w-[140px] shrink-0 bg-[var(--color-bg-tertiary)]/50 px-2 py-3 flex flex-col items-center border-r border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-xs text-[var(--color-text-tertiary)] ring-2 ring-[var(--color-border)]">
                    {getInitials(guestName.trim() || t('link_share.guest_badge_short'))}
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)] text-center">
                    {t('link_share.guest_badge_short')}
                  </p>
                </aside>
                <div className="flex-1 min-w-0 p-3 sm:p-4 space-y-2">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value.slice(0, 40))}
                    placeholder={t('link_share.guest_name_placeholder')}
                    className="w-full max-w-xs px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm"
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
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value.slice(0, 2000))}
                      placeholder={t('link_share.guest_comment_placeholder')}
                      rows={3}
                      className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm resize-y min-h-[4rem]"
                    />
                    <button
                      type="button"
                      disabled={submitting || !replyBody.trim()}
                      onClick={() => void submitReply()}
                      className="self-end h-9 w-9 rounded bg-[var(--color-accent)] text-white flex items-center justify-center disabled:opacity-50"
                    >
                      {submitting ? (
                        <IoReloadOutline className="w-4 h-4 animate-spin" />
                      ) : (
                        <IoSendOutline className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {commentError && (
                    <p className="text-xs text-[var(--color-error)]">{commentError}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
