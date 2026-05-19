import { diffLines } from 'diff'
import { noteContentPreview } from './notePreview'

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

/** Line diff on plain text extracted from note HTML/JSON. */
export function buildTextDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldText = noteContentPreview(oldContent, 500_000) || ''
  const newText = noteContentPreview(newContent, 500_000) || ''
  const parts = diffLines(oldText, newText)

  const lines: DiffLine[] = []
  for (const part of parts) {
    const chunkLines = part.value.replace(/\n$/, '').split('\n')
    const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged'
    for (const text of chunkLines) {
      if (text === '' && chunkLines.length === 1) continue
      lines.push({ type, text })
    }
  }
  return lines
}
