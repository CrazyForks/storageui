"use client"

import * as React from "react"

import type { ThumbnailWarmer } from "@/lib/storage/thumbnail-warmer"
import {
  DEFAULT_THUMBNAIL_WIDTH,
  thumbnailUrl,
  thumbnailWidthForTile,
} from "@/lib/storage/thumbnails"
import { FileTypeIcon } from "@/components/explorer/internals"
import type { FileSystemFileItem } from "@/components/explorer/types"

type ImageThumbnailPreviewProps = {
  cacheKey: string
  file: FileSystemFileItem
  getFileUrl: (file: FileSystemFileItem) => string | Promise<string>
  urlCache: Map<string, string>
  /** Bucket handle for `/api/thumbnail`; `null` falls back to the original. */
  thumbnailHandle?: string | null
  /** Roughly how wide this preview renders, in CSS px. */
  widthHint?: number
  thumbnailWarmer?: ThumbnailWarmer | null
  onThumbnailUnavailable?: () => void
}

/**
 * Prefers a server-rendered thumbnail, whose URL is derived synchronously — the
 * tile issues no presign at all. Falls back to the presigned original when no
 * handle is available (direct-client mode, or the route failed).
 */
export function ImageThumbnailPreview({
  cacheKey,
  file,
  getFileUrl,
  urlCache,
  thumbnailHandle,
  widthHint,
  thumbnailWarmer,
  onThumbnailUnavailable,
}: ImageThumbnailPreviewProps) {
  const [thumbnailFailed, setThumbnailFailed] = React.useState(false)

  const width = widthHint
    ? thumbnailWidthForTile(widthHint)
    : DEFAULT_THUMBNAIL_WIDTH
  const objectKey = file.key ?? file.path

  const serverThumbnail =
    thumbnailHandle && !thumbnailFailed
      ? thumbnailUrl(thumbnailHandle, objectKey, width)
      : null

  React.useEffect(() => {
    setThumbnailFailed(false)
  }, [thumbnailHandle])

  // Runs on mount, so the whole viewport's keys land in one warm request while
  // the browser is still working through its handful of connections.
  React.useEffect(() => {
    if (serverThumbnail) thumbnailWarmer?.warm(objectKey, width)
  }, [objectKey, serverThumbnail, thumbnailWarmer, width])

  if (serverThumbnail) {
    return (
      <img
        src={serverThumbnail}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        onError={() => {
          // Usually an unknown handle after a restart: ask for a fresh one, and
          // drop this tile to the original in the meantime.
          onThumbnailUnavailable?.()
          setThumbnailFailed(true)
        }}
      />
    )
  }

  return (
    <OriginalImagePreview
      cacheKey={cacheKey}
      file={file}
      getFileUrl={getFileUrl}
      urlCache={urlCache}
    />
  )
}

/** Resolves a presigned object URL only while the tile is actually mounted. */
function OriginalImagePreview({
  cacheKey,
  file,
  getFileUrl,
  urlCache,
}: Pick<
  ImageThumbnailPreviewProps,
  "cacheKey" | "file" | "getFileUrl" | "urlCache"
>) {
  const knownUrl = file.url ?? urlCache.get(cacheKey) ?? null
  const [url, setUrl] = React.useState<string | null>(knownUrl)
  const [failed, setFailed] = React.useState(false)

  const fileRef = React.useRef(file)
  React.useEffect(() => {
    fileRef.current = file
  })

  const filePath = file.path
  const fileUrl = file.url ?? null

  // Keyed by path, not object identity: the manifest re-creates file objects on
  // every refresh, and re-running on identity would abandon an in-flight
  // presign and immediately issue a duplicate.
  React.useEffect(() => {
    const cachedUrl = fileUrl ?? urlCache.get(cacheKey) ?? null
    if (cachedUrl) {
      setUrl(cachedUrl)
      setFailed(false)
      return
    }

    let isCurrent = true
    setUrl(null)
    setFailed(false)

    void Promise.resolve(getFileUrl(fileRef.current))
      .then((nextUrl) => {
        if (!nextUrl) throw new Error("No preview URL")
        // Cached even when stale, so an abandoned resolve still pays off.
        urlCache.set(cacheKey, nextUrl)
        if (isCurrent) setUrl(nextUrl)
      })
      .catch(() => {
        if (isCurrent) setFailed(true)
      })

    return () => {
      isCurrent = false
    }
  }, [cacheKey, filePath, fileUrl, getFileUrl, urlCache])

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        onError={() => {
          urlCache.delete(cacheKey)
          setFailed(true)
        }}
      />
    )
  }

  if (!failed) {
    return (
      <div
        aria-hidden="true"
        className="size-full animate-pulse bg-muted motion-reduce:animate-none"
      />
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-white dark:bg-neutral-100">
      <FileTypeIcon
        fileName={file.name ?? file.path}
        className="size-1/3 min-h-4 min-w-4"
      />
    </div>
  )
}
