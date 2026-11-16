import type { FolderTreeItem } from '@/services/api'
import { findFolderById } from '@/components/layout/sidebar'

export interface PathSegment {
  name: string
  color: string | null
}

/** Folder names from root to the note's parent folder. */
export function getFolderPathSegments(
  folderTree: FolderTreeItem[],
  folderId: string | null
): string[] {
  return getFolderPathItems(folderTree, folderId).map((s) => s.name)
}

/** Folder path items (name + color) from root to the note's parent folder. */
export function getFolderPathItems(
  folderTree: FolderTreeItem[],
  folderId: string | null
): PathSegment[] {
  if (!folderId) return []

  const segments: PathSegment[] = []
  let currentId: string | null = folderId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const folder = findFolderById(folderTree, currentId)
    if (!folder) break
    segments.unshift({ name: folder.name, color: folder.color ?? null })
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
}): PathSegment[] {
  if (options.sharedByName) {
    const prefix = options.sharedPrefixLabel?.trim()
    return prefix
      ? [
          { name: prefix, color: null },
          { name: options.sharedByName, color: null },
        ]
      : [{ name: options.sharedByName, color: null }]
  }

  const folderSegments = getFolderPathItems(options.folderTree, options.folderId)
  if (folderSegments.length === 0) {
    return [{ name: options.rootLabel, color: null }]
  }

  return folderSegments
}
