import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * Cursor / VS Code Dark+ inspired Markdown + code colors.
 * Same monospace size everywhere — color only, no bold/size jumps (matches Cursor source view).
 */
const cursorMdHighlight = HighlightStyle.define([
  // Headings — 白色，不加粗、不放大
  { tag: t.heading1, color: '#FFFFFF' },
  { tag: t.heading2, color: '#FFFFFF' },
  { tag: t.heading3, color: '#E8E8E8' },
  { tag: t.heading4, color: '#E8E8E8' },
  { tag: t.heading5, color: '#D4D4D4' },
  { tag: t.heading6, color: '#D4D4D4' },
  { tag: t.heading, color: '#FFFFFF' },

  // Emphasis — 只改颜色（源码视图不加粗/斜体）
  { tag: t.strong, color: '#569CD6' },
  { tag: t.emphasis, color: '#C586C0' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#858585' },

  // Links
  { tag: t.link, color: '#4FC1FF' },
  { tag: t.url, color: '#3794FF' },

  // Inline code / strings — 橘 / 金
  { tag: t.monospace, color: '#CE9178' },
  { tag: t.string, color: '#CE9178' },
  { tag: t.special(t.string), color: '#D7BA7D' },

  // Quotes / comments — 绿
  { tag: t.quote, color: '#6A9955' },
  { tag: t.comment, color: '#6A9955' },
  { tag: t.lineComment, color: '#6A9955' },
  { tag: t.blockComment, color: '#6A9955' },

  // Lists / labels — 金
  { tag: t.list, color: '#DCDCAA' },
  { tag: t.labelName, color: '#DCDCAA' },
  { tag: t.contentSeparator, color: '#808080' },

  // Code fence / markup punctuation — 紫（含 # ## 标记、` * [] 等）
  { tag: t.meta, color: '#C586C0' },
  { tag: t.processingInstruction, color: '#C586C0' },
  { tag: t.punctuation, color: '#D4D4D4' },
  { tag: t.bracket, color: '#FFD700' }, // 金
  { tag: t.angleBracket, color: '#808080' },
  { tag: t.squareBracket, color: '#DCDCAA' },
  { tag: t.paren, color: '#DCDCAA' },

  // Embedded code languages (fenced blocks)
  { tag: t.keyword, color: '#C586C0' }, // 紫
  { tag: t.controlKeyword, color: '#C586C0' },
  { tag: t.definitionKeyword, color: '#569CD6' }, // 蓝
  { tag: t.moduleKeyword, color: '#C586C0' },
  { tag: t.operatorKeyword, color: '#569CD6' },
  { tag: t.operator, color: '#D4D4D4' },
  { tag: t.number, color: '#B5CEA8' }, // 浅绿
  { tag: t.bool, color: '#569CD6' },
  { tag: t.null, color: '#569CD6' },
  { tag: t.propertyName, color: '#9CDCFE' }, // 浅蓝
  { tag: t.variableName, color: '#9CDCFE' },
  { tag: t.definition(t.variableName), color: '#9CDCFE' },
  { tag: t.function(t.variableName), color: '#DCDCAA' }, // 金
  { tag: t.definition(t.function(t.variableName)), color: '#DCDCAA' },
  { tag: t.typeName, color: '#4EC9B0' }, // 青绿
  { tag: t.className, color: '#4EC9B0' },
  { tag: t.namespace, color: '#4EC9B0' },
  { tag: t.macroName, color: '#DCDCAA' },
  { tag: t.literal, color: '#CE9178' },
  { tag: t.regexp, color: '#D16969' },
  { tag: t.escape, color: '#D7BA7D' },
  { tag: t.color, color: '#CE9178' },
  { tag: t.tagName, color: '#569CD6' },
  { tag: t.attributeName, color: '#9CDCFE' },
  { tag: t.attributeValue, color: '#CE9178' },
  { tag: t.atom, color: '#569CD6' },
  { tag: t.self, color: '#569CD6' },
  { tag: t.changed, color: '#569CD6' },
  { tag: t.annotation, color: '#DCDCAA' },
  { tag: t.modifier, color: '#569CD6' },
  { tag: t.invalid, color: '#F44747' },
])

/** Cursor / VS Code default editor chrome (not Fira/JetBrains). */
const CURSOR_EDITOR_FONT =
  "Menlo, Monaco, Consolas, 'Courier New', monospace"

const cursorEditorChrome = EditorView.theme(
  {
    '&': {
      height: '100%',
      // VS Code / Cursor default editor.fontSize
      fontSize: '14px',
      fontWeight: '400',
      backgroundColor: '#1E1E1E',
      color: '#D4D4D4',
    },
    '.cm-scroller': {
      fontFamily: CURSOR_EDITOR_FONT,
      fontWeight: '400',
      // VS Code default line height ≈ fontSize * 1.45 when lineHeight is auto
      lineHeight: '20px',
      letterSpacing: 'normal',
      fontVariantLigatures: 'none',
      fontFeatureSettings: 'normal',
      overflow: 'auto',
    },
    '.cm-content, .cm-line, .cm-line span': {
      fontFamily: 'inherit',
      fontWeight: '400',
      fontStyle: 'normal',
      fontSize: '14px',
      lineHeight: '20px',
      letterSpacing: 'normal',
      fontVariantLigatures: 'none',
    },
    '.cm-content': {
      padding: '12px 12px 64px 0',
      caretColor: '#AEAFAD',
      minHeight: '100%',
    },
    '.cm-line': {
      padding: '0 12px 0 4px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': {
      backgroundColor: '#1E1E1E',
      color: '#858585',
      border: 'none',
      borderRight: '1px solid #2B2B2B',
      minWidth: '3rem',
      fontFamily: CURSOR_EDITOR_FONT,
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 6px',
      minWidth: '2.2rem',
      textAlign: 'right',
      fontSize: '14px',
      lineHeight: '20px',
      fontFamily: CURSOR_EDITOR_FONT,
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#2A2A2A',
      color: '#C6C6C6',
    },
    '.cm-activeLine': {
      backgroundColor: '#2A2A2A',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: '#264F78 !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#AEAFAD',
      borderLeftWidth: '2px',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(197, 134, 192, 0.25)',
      outline: '1px solid #C586C0',
    },
    '.cm-placeholder': {
      color: '#6E6E6E',
      fontStyle: 'italic',
    },
    // 让代码围栏区域稍微沉一点底
    '.cm-line:has(.tok-md-code), .cm-content': {
      // no-op placeholder for older browsers
    },
  },
  { dark: true }
)

export function createMarkdownHighlightExtensions(_isDark?: boolean) {
  // 始终 Cursor 深色高对比，忽略应用浅/深色
  void _isDark
  return [cursorEditorChrome, syntaxHighlighting(cursorMdHighlight)]
}

export const markdownSyntaxHighlighting = syntaxHighlighting(cursorMdHighlight)
export const markdownEditorTheme = cursorEditorChrome
