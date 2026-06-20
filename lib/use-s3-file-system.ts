"use client"

import * as React from "react"
import { FilesError, type Files } from "files-sdk"

import type { Connection } from "@/lib/connections"
import { createFiles } from "@/lib/files-client"
import type {
  FileSystemFileItem,
  FileSystemItem,
  FileSystemLoadChildrenResult,
} from "@/components/ui/file-system"

const PAGE_LIMIT = 1000
const URL_EXPIRES_IN = 3600

function errorMessage(error: unknown): string {
  if (error instanceof FilesError) {
    return `${error.message} (${error.code})`
  }
  if (error instanceof Error) return error.message
  return String(error)
}

/** One page of a folder, mapped to the FileSystem manifest shape. */
async function listFolder(
  files: Files,
  prefix: string,
  cursor: string | null
): Promise<FileSystemLoadChildrenResult> {
  const result = await files.list({
    prefix: prefix || undefined,
    delimiter: "/",
    limit: PAGE_LIMIT,
    cursor: cursor ?? undefined,
  })

  const folders: FileSystemItem[] = (result.prefixes ?? []).map((path) => ({
    kind: "folder",
    path,
    hasChildren: true,
  }))

  const fileItems: FileSystemItem[] = result.items
    // Skip the zero-byte "folder marker" objects some tools create.
    .filter((file) => !file.key.endsWith("/"))
    .map((file) => ({
      kind: "file",
      path: file.key,
      key: file.key,
      size: file.size,
      contentType: file.type || undefined,
      updatedAt: file.lastModified
        ? new Date(file.lastModified).toISOString()
        : undefined,
      etag: file.etag,
    }))

  return {
    items: [...folders, ...fileItems],
    nextCursor: result.cursor ?? null,
  }
}

export type UploadProgress = { loaded: number; total?: number }

export type S3FileSystem = {
  items: FileSystemItem[]
  loadChildren: (args: {
    path: string
    cursor: string | null
  }) => Promise<FileSystemLoadChildrenResult>
  getFileUrl: (file: FileSystemFileItem) => Promise<string>
  /** Upload a single file to `key`, reporting byte progress when available. */
  uploadFile: (
    key: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<void>
  /** Create an object-store folder marker at a path ending in `/`. */
  createFolder: (path: string) => Promise<void>
  /** Re-fetch the bucket root listing (e.g. after an upload). */
  refresh: () => void
  isLoading: boolean
  error: string | null
}

/** Adapts a connection's `files-sdk` client to the FileSystem component props. */
export function useS3FileSystem(connection: Connection | null): S3FileSystem {
  const [items, setItems] = React.useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadedFiles, setLoadedFiles] = React.useState<Files | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const files = React.useMemo(
    () => (connection ? createFiles(connection) : null),
    [connection]
  )

  // Load the bucket root whenever the active connection changes.
  React.useEffect(() => {
    if (!files) {
      setItems([])
      setLoadedFiles(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    listFolder(files, "", null)
      .then((result) => {
        if (!cancelled) setItems(result.items)
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([])
          setError(errorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedFiles(files)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [files])

  // Re-fetch the root listing on demand (after uploads/deletes).
  const refresh = React.useCallback(() => {
    if (!files) return
    setIsLoading(true)
    listFolder(files, "", null)
      .then((result) => setItems(result.items))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setIsLoading(false))
  }, [files])

  const loadChildren = React.useCallback(
    async ({ path, cursor }: { path: string; cursor: string | null }) => {
      if (!files) return { items: [], nextCursor: null }
      return listFolder(files, path, cursor)
    },
    [files]
  )

  const getFileUrl = React.useCallback(
    async (file: FileSystemFileItem) => {
      if (!files) return ""
      return files.url(file.key ?? file.path, { expiresIn: URL_EXPIRES_IN })
    },
    [files]
  )

  const uploadFile = React.useCallback(
    async (
      key: string,
      file: File,
      onProgress?: (progress: UploadProgress) => void
    ) => {
      if (!files) throw new Error("No active connection")
      try {
        await files.upload(key, file, {
          contentType: file.type || undefined,
          onProgress,
        })
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [files]
  )

  const createFolder = React.useCallback(
    async (path: string) => {
      if (!files) throw new Error("No active connection")

      const key = path.endsWith("/") ? path : `${path}/`

      try {
        await files.upload(key, new Uint8Array(), {
          contentType: "application/x-directory",
        })
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [files]
  )

  return {
    items,
    loadChildren,
    getFileUrl,
    uploadFile,
    createFolder,
    refresh,
    isLoading: Boolean(files && (isLoading || loadedFiles !== files)),
    error,
  }
}
