"use client"

import * as React from "react"

import { FileTypeIcon } from "@/components/explorer/internals"
import type { FileSystemFileItem } from "@/components/explorer/types"

type ImageThumbnailPreviewProps = {
  cacheKey: string
  file: FileSystemFileItem
  getFileUrl: (file: FileSystemFileItem) => string | Promise<string>
  urlCache: Map<string, string>
}

/** Resolve an object URL only while an image thumbnail is actually mounted. */
export function ImageThumbnailPreview({
  cacheKey,
  file,
  getFileUrl,
  urlCache,
}: ImageThumbnailPreviewProps) {
  const knownUrl = file.url ?? urlCache.get(cacheKey) ?? null
  const [url, setUrl] = React.useState<string | null>(knownUrl)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    const cachedUrl = file.url ?? urlCache.get(cacheKey) ?? null
    if (cachedUrl) {
      setUrl(cachedUrl)
      setFailed(false)
      return
    }

    let isCurrent = true
    setUrl(null)
    setFailed(false)

    void Promise.resolve(getFileUrl(file))
      .then((nextUrl) => {
        if (!nextUrl) throw new Error("No preview URL")
        urlCache.set(cacheKey, nextUrl)
        if (isCurrent) setUrl(nextUrl)
      })
      .catch(() => {
        if (isCurrent) setFailed(true)
      })

    return () => {
      isCurrent = false
    }
  }, [cacheKey, file, getFileUrl, urlCache])

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
