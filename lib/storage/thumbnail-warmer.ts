"use client"

import { MAX_WARM_KEYS, type ThumbnailWidth } from "@/lib/storage/thumbnails"

/**
 * Asks the server to start rendering the thumbnails a viewport just mounted.
 *
 * Without this each tile's `<img>` is its own request, so the browser's ~6
 * connections per origin — not the server — decide how fast a folder of images
 * fills in. Collecting the keys mounted in one commit into a single POST lets
 * the server fan out at its own download concurrency; the per-tile GETs that
 * follow dedupe onto that work instead of queueing behind each other.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const WINDOW_MS = 16

export type ThumbnailWarmer = {
  warm: (key: string, width: ThumbnailWidth) => void
}

export function createThumbnailWarmer(handle: string): ThumbnailWarmer {
  /** Keys already sent, so scrolling back over a tile does not re-ask. */
  const requested = new Set<string>()
  const queued = new Map<ThumbnailWidth, Set<string>>()
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    timer = null

    // Snapshot: an over-cap width is re-queued below, and re-adding to a Map
    // mid-iteration would have it visited again in this same pass.
    const pending = Array.from(queued)
    queued.clear()

    for (const [width, keys] of pending) {
      const batch = Array.from(keys).slice(0, MAX_WARM_KEYS)
      if (batch.length === 0) continue

      // Fire and forget: the tiles' own GETs deliver the images, this only
      // gets the server started earlier and wider.
      void fetch(`${BASE_PATH}/api/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: handle, keys: batch, w: width }),
        keepalive: true,
      }).catch(() => {})

      if (keys.size > batch.length) {
        queued.set(width, new Set(Array.from(keys).slice(MAX_WARM_KEYS)))
        schedule()
      }
    }
  }

  function schedule() {
    if (timer === null) timer = setTimeout(flush, WINDOW_MS)
  }

  return {
    warm(key, width) {
      const id = `${width} ${key}`
      if (requested.has(id)) return
      requested.add(id)

      const keys = queued.get(width)
      if (keys) keys.add(key)
      else queued.set(width, new Set([key]))

      schedule()
    },
  }
}
