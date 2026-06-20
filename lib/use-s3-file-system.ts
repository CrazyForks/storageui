"use client"

import * as React from "react"
import { FilesError, type Files } from "files-sdk"

import type { Connection } from "@/lib/connections"
import { createFiles, type FilesClient } from "@/lib/files-client"
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
  /** Download a file directly or bundle a folder's contents into a ZIP. */
  downloadEntry: (item: FileSystemItem) => Promise<void>
  /** Delete a file or recursively delete every object under a folder. */
  deleteEntry: (item: FileSystemItem) => Promise<void>
  /** Rename a file or recursively move every object under a folder. */
  renameEntry: (item: FileSystemItem, name: string) => Promise<void>
  /** Re-fetch the bucket root listing (e.g. after an upload). */
  refresh: () => void
  isLoading: boolean
  error: string | null
}

function saveDownload(url: string, name: string, revoke = false) {
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = name
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function listKeys(files: FilesClient, prefix: string) {
  const keys: string[] = []

  for await (const item of files.listAll({ prefix })) {
    keys.push(item.key)
  }

  return keys
}

function parentPath(path: string) {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path
  const separatorIndex = normalized.lastIndexOf("/")

  return separatorIndex < 0 ? "" : normalized.slice(0, separatorIndex + 1)
}

async function prefixExists(files: FilesClient, prefix: string) {
  for await (const _item of files.listAll({ prefix })) return true
  return false
}

async function keyExists(files: FilesClient, key: string) {
  for await (const item of files.listAll({ prefix: key })) {
    if (item.key === key) return true
  }
  return false
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

  const downloadEntry = React.useCallback(
    async (item: FileSystemItem) => {
      if (!files) throw new Error("No active connection")

      try {
        if (item.kind === "file") {
          const key = item.key ?? item.path
          const url = await files.url(key, { expiresIn: URL_EXPIRES_IN })
          const name = item.name ?? key.split("/").pop() ?? "download"

          saveDownload(url, name)
          return
        }

        const prefix = item.path.endsWith("/") ? item.path : `${item.path}/`
        const keys = (await listKeys(files, prefix)).filter(
          (key) => key !== prefix && !key.endsWith("/")
        )

        if (keys.length === 0) {
          throw new Error("This folder has no files to download.")
        }

        const stream = files.zip(keys, {
          name: (key) => key.slice(prefix.length),
        })
        const blob = await new Response(stream, {
          headers: { "Content-Type": "application/zip" },
        }).blob()
        const folderName =
          item.name ?? prefix.slice(0, -1).split("/").pop() ?? "folder"

        saveDownload(URL.createObjectURL(blob), `${folderName}.zip`, true)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [files]
  )

  const deleteEntry = React.useCallback(
    async (item: FileSystemItem) => {
      if (!files) throw new Error("No active connection")

      try {
        if (item.kind === "file") {
          await files.delete(item.key ?? item.path)
          return
        }

        const prefix = item.path.endsWith("/") ? item.path : `${item.path}/`
        const keys = await listKeys(files, prefix)

        if (keys.length === 0) return

        const result = await files.delete(keys)
        if (result.errors?.length) {
          throw new Error(
            `Could not delete ${result.errors.length} object${result.errors.length === 1 ? "" : "s"}.`
          )
        }
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [files]
  )

  const renameEntry = React.useCallback(
    async (item: FileSystemItem, name: string) => {
      if (!files) throw new Error("No active connection")

      const nextName = name.trim()
      if (!nextName) throw new Error("Enter a name.")

      try {
        if (item.kind === "file") {
          const sourceKey = item.key ?? item.path
          const destinationKey = `${parentPath(sourceKey)}${nextName}`

          if (destinationKey === sourceKey) return
          if (
            (await keyExists(files, destinationKey)) ||
            (await prefixExists(files, `${destinationKey}/`))
          ) {
            throw new Error("An item with this name already exists.")
          }

          await files.move(sourceKey, destinationKey)
          return
        }

        const sourcePrefix = item.path.endsWith("/")
          ? item.path
          : `${item.path}/`
        const destinationPrefix = `${parentPath(sourcePrefix)}${nextName}/`

        if (destinationPrefix === sourcePrefix) return
        if (
          (await keyExists(files, destinationPrefix.slice(0, -1))) ||
          (await prefixExists(files, destinationPrefix))
        ) {
          throw new Error("An item with this name already exists.")
        }

        const keys = await listKeys(files, sourcePrefix)
        if (keys.length === 0) throw new Error("This folder no longer exists.")

        for (let index = 0; index < keys.length; index += 8) {
          await Promise.all(
            keys
              .slice(index, index + 8)
              .map((sourceKey) =>
                files.move(
                  sourceKey,
                  `${destinationPrefix}${sourceKey.slice(sourcePrefix.length)}`
                )
              )
          )
        }
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
    downloadEntry,
    deleteEntry,
    renameEntry,
    refresh,
    isLoading: Boolean(files && (isLoading || loadedFiles !== files)),
    error,
  }
}
