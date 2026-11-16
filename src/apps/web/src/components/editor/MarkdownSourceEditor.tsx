import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, foldGutter } from '@codemirror/language'
import { htmlToMarkdown, markdownToHtml } from '@/utils/htmlMarkdown'
import { createMarkdownHighlightExtensions } from './markdownSourceTheme'

export type MarkdownSourceHandle = {
  focus: () => void
  scrollToPos: (pos: number) => void
  getValue: () => string
}

interface MarkdownSourceEditorProps {
  htmlContent: string
  onApply: (html: string) => void
  onCancel: () => void
  readOnly?: boolean
  onMarkdownChange?: (markdown: string) => void
  onEditorReady?: (handle: MarkdownSourceHandle | null) => void
}

function isDocumentDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

export function MarkdownSourceEditor({
  htmlContent,
  onApply,
  onCancel,
  readOnly = false,
  onMarkdownChange,
  onEditorReady,
}: MarkdownSourceEditorProps) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onMarkdownChange)
  const errorRef = useRef<HTMLParagraphElement | null>(null)
  const skipExternalSync = useRef(false)
  onChangeRef.current = onMarkdownChange

  useEffect(() => {
    if (!hostRef.current) return

    const initial = htmlToMarkdown(htmlContent)
    onChangeRef.current?.(initial)

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      skipExternalSync.current = true
      onChangeRef.current?.(update.state.doc.toString())
      if (errorRef.current) {
        errorRef.current.textContent = ''
        errorRef.current.hidden = true
      }
    })

    const dark = isDocumentDark()
    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        foldGutter(),
        drawSelection(),
        bracketMatching(),
        history(),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),
        themeCompartment.current.of(createMarkdownHighlightExtensions(dark)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        cmPlaceholder(t('editor.markdown_placeholder')),
        editableCompartment.current.of([
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(!!readOnly),
        ]),
        updateListener,
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view

    const handle: MarkdownSourceHandle = {
      focus: () => view.focus(),
      getValue: () => view.state.doc.toString(),
      scrollToPos: (pos: number) => {
        const safe = Math.max(0, Math.min(pos, view.state.doc.length))
        view.focus()
        view.dispatch({
          selection: { anchor: safe },
          effects: EditorView.scrollIntoView(safe, { y: 'center' }),
        })
      },
    }
    onEditorReady?.(handle)

    const syncTheme = () => {
      const v = viewRef.current
      if (!v) return
      v.dispatch({
        effects: themeCompartment.current.reconfigure(
          createMarkdownHighlightExtensions(isDocumentDark())
        ),
      })
    }
    const mo = new MutationObserver(syncTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      mo.disconnect()
      onEditorReady?.(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (skipExternalSync.current) {
      skipExternalSync.current = false
      return
    }
    const next = htmlToMarkdown(htmlContent)
    const current = view.state.doc.toString()
    if (next === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
    })
    onChangeRef.current?.(next)
  }, [htmlContent])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: editableCompartment.current.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(!!readOnly),
      ]),
    })
  }, [readOnly])

  const handleApply = () => {
    const view = viewRef.current
    if (!view) return
    try {
      const html = markdownToHtml(view.state.doc.toString())
      onApply(html)
    } catch {
      if (errorRef.current) {
        errorRef.current.textContent = t('editor.markdown_invalid')
        errorRef.current.hidden = false
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 md-source-editor">
      <div className="flex items-center justify-between gap-2 px-4 md:px-8 py-2 border-b border-[#2B2B2B] shrink-0 bg-[#181818]">
        <span className="text-[11px] font-medium text-[#9D9D9D] tracking-wide flex items-center gap-2 flex-wrap">
          <span>{t('editor.markdown_mode')}</span>
          <span className="text-[10px] opacity-80">{t('editor.markdown_syntax_hint')}</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono ml-1">
            <span style={{ color: '#C586C0' }}>#</span>
            <span style={{ color: '#FFFFFF' }}>标题</span>
            <span style={{ color: '#569CD6' }}>**粗**</span>
            <span style={{ color: '#CE9178' }}>`码`</span>
            <span style={{ color: '#DCDCAA' }}>-</span>
            <span style={{ color: '#6A9955' }}>&gt;引</span>
            <span style={{ color: '#4FC1FF' }}>[链]</span>
          </span>
        </span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-3.5 h-3.5" />
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
            >
              <IoCheckmarkOutline className="w-3.5 h-3.5" />
              {t('editor.markdown_apply')}
            </button>
          </div>
        )}
      </div>
      <div ref={hostRef} className="flex-1 min-h-[50vh] md-source-editor-host" />
      <p ref={errorRef} hidden className="px-4 md:px-8 pb-2 text-xs text-red-500 shrink-0" />
    </div>
  )
}
