import { isThumbnailWidth } from "@/lib/storage/thumbnails"
import {
  getThumbnail,
  resolveThumbnailConnection,
  ThumbnailTooLargeError,
  warmThumbnails,
} from "@/lib/storage/thumbnails-server"

/**
 * Downscaled preview of one image object. A plain GET so `<img src>` can point
 * at it directly and the browser's HTTP cache absorbs the repeat work. Access
 * is gated by the session cookie in `proxy.ts`, like every other route.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=3600"

/** A 404 here means "re-register and retry", and a 502 is usually transient. */
function failure(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const handle = params.get("c")
  const key = params.get("k")
  const width = Number(params.get("w"))

  if (!handle || !key || !isThumbnailWidth(width)) {
    return failure("Invalid request.", 400)
  }

  const ref = resolveThumbnailConnection(handle)
  if (!ref) {
    return failure("Unknown connection.", 404)
  }

  let thumbnail
  try {
    thumbnail = await getThumbnail(handle, ref, key, width)
  } catch (error) {
    if (error instanceof ThumbnailTooLargeError) {
      return failure("Image too large to preview.", 413)
    }
    return failure(
      error instanceof Error ? error.message : "Could not render thumbnail.",
      502
    )
  }

  if (request.headers.get("if-none-match") === thumbnail.etag) {
    return new Response(null, {
      status: 304,
      headers: { "Cache-Control": CACHE_CONTROL, ETag: thumbnail.etag },
    })
  }

  return new Response(thumbnail.body, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Length": String(thumbnail.body.byteLength),
      "Content-Type": thumbnail.contentType,
      ETag: thumbnail.etag,
    },
  })
}

type WarmRequest = { c?: unknown; keys?: unknown; w?: unknown }

/**
 * Start a batch of renders in one request, so a folder's fill rate is set by
 * the server's download concurrency rather than the browser's connection cap.
 */
export async function POST(request: Request) {
  let body: WarmRequest
  try {
    body = (await request.json()) as WarmRequest
  } catch {
    return failure("Invalid request.", 400)
  }

  const handle = typeof body.c === "string" ? body.c : null
  const width = Number(body.w)
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((key): key is string => typeof key === "string")
    : null

  if (!handle || !keys || keys.length === 0 || !isThumbnailWidth(width)) {
    return failure("Invalid request.", 400)
  }

  const ref = resolveThumbnailConnection(handle)
  if (!ref) return failure("Unknown connection.", 404)

  await warmThumbnails(handle, ref, keys, width)

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  })
}
