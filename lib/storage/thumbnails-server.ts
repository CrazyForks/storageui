import "server-only"

import { createHash } from "node:crypto"
import { availableParallelism } from "node:os"
import { LRUCache } from "lru-cache"
import sharp from "sharp"

import type { ConnectionRef } from "@/lib/storage/connection-ref"
import { resolveFiles } from "@/lib/storage/connections-server"
import { normalizeError } from "@/lib/storage/file-operations"
import { MAX_WARM_KEYS, type ThumbnailWidth } from "@/lib/storage/thumbnails"

/**
 * Fetches an object once, downscales it, and keeps the result so repeat views
 * cost nothing.
 *
 * All state is per-process, which suits the single-container deployment this
 * ships as. Behind several replicas each warms its own cache, and a handle
 * registered against one is unknown to the others until the browser
 * re-registers — which it does on the first failed thumbnail.
 */

const MAX_SOURCE_BYTES = 50 * 1024 * 1024
const MAX_SOURCE_PIXELS = 100_000_000
const MAX_CACHE_BYTES = 128 * 1024 * 1024
const CACHE_TTL_MS = 60 * 60 * 1000
const HANDLE_TTL_MS = 12 * 60 * 60 * 1000
const WEBP_QUALITY = 72

/** Each decode pins a full-resolution bitmap and saturates a core. */
const MAX_CONCURRENT_DECODES = Math.max(2, availableParallelism() - 1)

/**
 * Fetching the original dominates a cold render — measured at 98% of it — and
 * it is per-connection throughput, not bandwidth, that limits us: the same 24
 * objects take 11.9s at 4 in parallel and 3.4s at 16. Kept well above the
 * decode limit for that reason, and bounded only so a fast scroll through a
 * large folder cannot open an unbounded number of sockets.
 */
const MAX_CONCURRENT_DOWNLOADS = 16

export type Thumbnail = {
  body: ArrayBuffer
  contentType: string
  etag: string
}

// ─── Shared state ────────────────────────────────────────────────────────────

/**
 * Next bundles a route handler and a server action into disjoint chunks — the
 * route loads `chunks/*`, the action `chunks/ssr/*` — so each gets its own
 * instance of this module and, with it, its own module-level state. Anything
 * one side writes and the other reads has to hang off `globalThis` instead.
 */
function shared<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<string, T | undefined>
  return (store[key] ??= create())
}

// ─── Connection handles ──────────────────────────────────────────────────────

const handles = shared(
  "__storageui_thumbnail_handles",
  () =>
    new LRUCache<string, ConnectionRef>({
      max: 64,
      ttl: HANDLE_TTL_MS,
      updateAgeOnGet: true,
    })
)

const ENV_HANDLE_PREFIX = "e_"
const LOCAL_HANDLE_PREFIX = "l_"

/**
 * An `env` handle carries the connection id outright and needs no registry: the
 * credentials live in server env vars either way, and the id is one the
 * signed-in user can already read off the sidebar. That keeps the common case
 * working across restarts and across the bundle split above.
 *
 * A `local` ref has no server-side identity, so it stays a digest resolved
 * through the registry. Derived rather than random so re-registering mints the
 * same handle and URLs already in the browser's cache keep working; the digest
 * covers the secret key, so it cannot be guessed.
 */
function handleFor(ref: ConnectionRef): string {
  if (ref.source === "env") return `${ENV_HANDLE_PREFIX}${ref.id}`

  const digest = createHash("sha256")
    .update(`local:${JSON.stringify(ref.connection)}`)
    .digest("hex")
    .slice(0, 32)
  return `${LOCAL_HANDLE_PREFIX}${digest}`
}

export function registerThumbnailConnection(ref: ConnectionRef): string {
  const handle = handleFor(ref)
  if (ref.source !== "env") handles.set(handle, ref)
  return handle
}

export function resolveThumbnailConnection(
  handle: string
): ConnectionRef | null {
  if (handle.startsWith(ENV_HANDLE_PREFIX)) {
    const id = handle.slice(ENV_HANDLE_PREFIX.length)
    // `resolveFiles` rejects an id with no matching env slot.
    return id ? { source: "env", id } : null
  }
  return handles.get(handle) ?? null
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const thumbnails = shared(
  "__storageui_thumbnail_cache",
  () =>
    new LRUCache<string, Thumbnail>({
      maxSize: MAX_CACHE_BYTES,
      sizeCalculation: (value) =>
        value.body.byteLength + value.etag.length + 64,
      ttl: CACHE_TTL_MS,
    })
)

/**
 * Without this, a viewport of tiles missing at once would fetch and decode the
 * same object several times over.
 */
const inFlight = shared(
  "__storageui_thumbnail_inflight",
  () => new Map<string, Promise<Thumbnail>>()
)

function cacheKey(handle: string, key: string, width: number): string {
  return `${handle} ${key} ${width}`
}

// ─── Queues ──────────────────────────────────────────────────────────────────

function semaphore(limit: number) {
  let active = 0
  const waiting: Array<() => void> = []

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve))
    }
    active += 1
    try {
      return await task()
    } finally {
      active -= 1
      waiting.shift()?.()
    }
  }
}

const withDownloadSlot = semaphore(MAX_CONCURRENT_DOWNLOADS)
const withDecodeSlot = semaphore(MAX_CONCURRENT_DECODES)

// ─── Rendering ───────────────────────────────────────────────────────────────

export class ThumbnailTooLargeError extends Error {
  constructor(size: number) {
    super(`Source object is ${size} bytes, above the thumbnail limit.`)
    this.name = "ThumbnailTooLargeError"
  }
}

async function render(
  ref: ConnectionRef,
  key: string,
  width: ThumbnailWidth
): Promise<Thumbnail> {
  const files = resolveFiles(ref)

  const source = await withDownloadSlot(async () => {
    try {
      const stored = await files.download(key)
      // Streaming adapters report `size` from headers, so an oversized object
      // is rejected before its body is materialized.
      if (stored.size > MAX_SOURCE_BYTES) {
        throw new ThumbnailTooLargeError(stored.size)
      }
      return await stored.arrayBuffer()
    } catch (error) {
      if (error instanceof ThumbnailTooLargeError) throw error
      throw normalizeError(error)
    }
  })

  if (source.byteLength > MAX_SOURCE_BYTES) {
    throw new ThumbnailTooLargeError(source.byteLength)
  }

  return withDecodeSlot(async () => {
    const body = await sharp(Buffer.from(source), {
      // Truncated images are common in real buckets; render what decodes.
      failOn: "none",
      limitInputPixels: MAX_SOURCE_PIXELS,
    })
      // Applies EXIF orientation, and must precede `resize` to be honored.
      .rotate()
      .resize(width, width, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    // Copy out of sharp's pooled Buffer so the cached entry neither pins the
    // pool nor over-reports its size.
    const bytes = new Uint8Array(body)

    return {
      body: bytes.buffer as ArrayBuffer,
      contentType: "image/webp",
      etag: `"${createHash("sha1").update(body).digest("base64url")}"`,
    }
  })
}

export function getThumbnail(
  handle: string,
  ref: ConnectionRef,
  key: string,
  width: ThumbnailWidth
): Promise<Thumbnail> {
  const id = cacheKey(handle, key, width)

  const cached = thumbnails.get(id)
  if (cached) return Promise.resolve(cached)

  const running = inFlight.get(id)
  if (running) return running

  const pending = render(ref, key, width)
    .then((thumbnail) => {
      thumbnails.set(id, thumbnail)
      return thumbnail
    })
    .finally(() => {
      inFlight.delete(id)
    })

  inFlight.set(id, pending)
  return pending
}

/**
 * Render a viewport's worth of thumbnails ahead of the `<img>` requests.
 *
 * One tile per HTTP request means the browser's ~6-connection cap, not the
 * server, decides how fast a folder fills in. This lets the client spend a
 * single request to start the whole batch at `MAX_CONCURRENT_DOWNLOADS`; the
 * per-tile GETs that follow then dedupe onto the work already in flight.
 *
 * Resolves when every key has settled, so the caller can await a warm cache.
 * Individual failures are swallowed — the tile's own GET will surface them.
 */
export async function warmThumbnails(
  handle: string,
  ref: ConnectionRef,
  keys: string[],
  width: ThumbnailWidth
): Promise<void> {
  await Promise.all(
    keys
      .slice(0, MAX_WARM_KEYS)
      .map((key) => getThumbnail(handle, ref, key, width).catch(() => null))
  )
}
