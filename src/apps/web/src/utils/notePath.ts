import type { FolderTreeItem } from '@/services/api'
import { findFolderById } from '@/components/layout/sidebar'

/** Folder names from root to the note's parent folder. */
export function getFolderPathSegments(
  folderTree: FolderTreeItem[],
  folderId: string | null
): string[] {
  if (!folderId) return []

  const segments: string[] = []
  let currentId: string | null = folderId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const folder = findFolderById(folderTree, currentId)
    if (!folder) break
    segments.unshift(folder.name)
    currentId = folder.parentId
  }

  return segments
}

/** Folder ids from root to the given folder (inclusive). */
export function getFolderAncestorIds(
  folderTree: FolderTreeItem[],
  folderId: string | null
): string[] {
  if (!folderId) return []

  const ids: string[] = []
  let currentId: string | null = folderId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    ids.unshift(currentId)
    const folder = findFolderById(folderTree, currentId)
    if (!folder) break
    currentId = folder.parentId
  }

  return ids
}

/** Structural path in the notes tree (folders only; title shown separately in the header). */
export function buildNoteStructurePath(options: {
  folderTree: FolderTreeItem[]
  folderId: string | null
  rootLabel: string
  /** Label for notes shared by others (folder tree unavailable). */
  sharedPrefixLabel?: string | null
  sharedByName?: string | null
}): string[] {
  if (options.sharedByName) {
    const prefix = options.sharedPrefixLabel?.trim()
    return prefix
      ? [prefix, options.sharedByName]
      : [options.sharedByName]
  }

  const folderSegments = getFolderPathSegments(options.folderTree, options.folderId)
  if (folderSegments.length === 0) {
    return [options.rootLabel]
  }

  return folderSegments
}
