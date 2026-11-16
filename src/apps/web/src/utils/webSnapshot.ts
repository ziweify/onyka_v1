const SNAPSHOT_ATTR_RE = /data-onyka-web-snapshot=["']([A-Za-z0-9_-]{10,})["']/i

/** Detect a full-page web snapshot note (SingleFile / saved HTML). */
export function extractWebSnapshotId(content: string | null | undefined): string | null {
  if (!content) return null
  const match = content.match(SNAPSHOT_ATTR_RE)
  return match?.[1] ?? null
}
