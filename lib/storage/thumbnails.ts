/**
 * Shared contract for server-rendered image thumbnails. The sharp pipeline and
 * the connection registry live in `thumbnails-server.ts`.
 *
 * Thumbnails are addressed by an opaque connection *handle* rather than the
 * usual `ConnectionRef`: `<img src>` needs a plain GET URL, and a `local` ref
 * carries bucket credentials that must not land in a query string.
 */

export const THUMBNAIL_WIDTHS = [128, 256, 512] as const

export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number]

export const DEFAULT_THUMBNAIL_WIDTH: ThumbnailWidth = 256

/** Most keys one warm request may ask the server to render. */
export const MAX_WARM_KEYS = 64

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function isThumbnailWidth(value: number): value is ThumbnailWidth {
  return (THUMBNAIL_WIDTHS as readonly number[]).includes(value)
}

/**
 * Smallest width covering a slot of `cssPixels`. Assumes a 2× display instead
 * of reading `devicePixelRatio`, which the server cannot know and would
 * therefore turn into a hydration mismatch.
 */
export function thumbnailWidthForTile(cssPixels: number): ThumbnailWidth {
  const needed = cssPixels * 2
  return (
    THUMBNAIL_WIDTHS.find((width) => width >= needed) ??
    THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1]
  )
}

/** Stable for a given (handle, key, width), so the HTTP cache can do its job. */
export function thumbnailUrl(
  handle: string,
  key: string,
  width: ThumbnailWidth
): string {
  const params = new URLSearchParams({ c: handle, k: key, w: String(width) })
  return `${BASE_PATH}/api/thumbnail?${params.toString()}`
}
