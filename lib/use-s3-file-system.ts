"use client"

import * as React from "react"

import { toConnectionRef, type ConnectionRef } from "@/lib/connection-ref"
import type { Connection } from "@/lib/connections"
import type {
  FileSystemFileItem,
  FileSystemItem,
  FileSystemLoadChildrenResult,
} from "@/components/explorer/types"
import {
  createFolderAction,
  deleteEntryAction,
  listFolderAction,
  moveEntryAction,
  renameEntryAction,
  signFileUrlAction,
  signUploadUrlAction,
  type EntryRef,
  type SignedUpload,
} from "@/app/actions/files"

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function toEntryRef(item: FileSystemItem): EntryRef {
  return {
    kind: item.kind,
    path: item.path,
    key: item.kind === "file" ? item.key : undefined,
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
  /** Move a file or folder into another folder (`""` is the bucket root). */
  moveEntry: (item: FileSystemItem, destinationFolder: string) => Promise<void>
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

/** Direct browser upload to a presigned URL, with byte progress. */
function uploadToSignedUrl(
  signed: SignedUpload,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      onProgress?.({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : undefined,
      })
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`))
    xhr.onerror = () => reject(new Error("Upload failed."))

    if (signed.method === "PUT") {
      xhr.open("PUT", signed.url)
      const headers = signed.headers ?? {}
      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value)
      }
      const hasContentType = Object.keys(headers).some(
        (name) => name.toLowerCase() === "content-type"
      )
      if (!hasContentType && file.type) {
        xhr.setRequestHeader("Content-Type", file.type)
      }
      xhr.send(file)
    } else {
      const form = new FormData()
      for (const [name, value] of Object.entries(signed.fields)) {
        form.append(name, value)
      }
      form.append("file", file)
      xhr.open("POST", signed.url)
      xhr.send(form)
    }
  })
}

/** Adapts a connection's server-side `files-sdk` client to the FileSystem props. */
export function useS3FileSystem(connection: Connection | null): S3FileSystem {
  const [items, setItems] = React.useState<FileSystemItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadedConnection, setLoadedConnection] =
    React.useState<Connection | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const ref = React.useMemo<ConnectionRef | null>(
    () => (connection ? toConnectionRef(connection) : null),
    [connection]
  )

  // Load the bucket root whenever the active connection changes.
  React.useEffect(() => {
    if (!ref) {
      setItems([])
      setLoadedConnection(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    listFolderAction(ref, "", null)
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
          setLoadedConnection(connection)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ref, connection])

  // Re-fetch the root listing on demand (after uploads/deletes). Runs silently
  // — it deliberately doesn't toggle `isLoading`, so re-listing after a
  // mutation swaps the items in without flashing the full-content loading
  // state. The FileSystem's own `reloadToken` handles the visible folder.
  const refresh = React.useCallback(() => {
    if (!ref) return
    listFolderAction(ref, "", null)
      .then((result) => setItems(result.items))
      .catch((err) => setError(errorMessage(err)))
  }, [ref])

  const loadChildren = React.useCallback(
    async ({ path, cursor }: { path: string; cursor: string | null }) => {
      if (!ref) return { items: [], nextCursor: null }
      return listFolderAction(ref, path, cursor)
    },
    [ref]
  )

  const getFileUrl = React.useCallback(
    async (file: FileSystemFileItem) => {
      if (!ref) return ""
      return signFileUrlAction(ref, file.key ?? file.path)
    },
    [ref]
  )

  const uploadFile = React.useCallback(
    async (
      key: string,
      file: File,
      onProgress?: (progress: UploadProgress) => void
    ) => {
      if (!ref) throw new Error("No active connection")
      try {
        const signed = await signUploadUrlAction(
          ref,
          key,
          file.type || undefined
        )
        await uploadToSignedUrl(signed, file, onProgress)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
  )

  const createFolder = React.useCallback(
    async (path: string) => {
      if (!ref) throw new Error("No active connection")
      try {
        await createFolderAction(ref, path)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
  )

  const downloadEntry = React.useCallback(
    async (item: FileSystemItem) => {
      if (!ref) throw new Error("No active connection")

      try {
        if (item.kind === "file") {
          const key = item.key ?? item.path
          const url = await signFileUrlAction(ref, key)
          const name = item.name ?? key.split("/").pop() ?? "download"
          saveDownload(url, name)
          return
        }

        const response = await fetch(`${BASE_PATH}/api/zip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref, path: item.path }),
        })
        if (!response.ok) {
          throw new Error(
            (await response.text()) || "Could not download folder."
          )
        }

        const blob = await response.blob()
        const folderName =
          item.name ?? item.path.replace(/\/$/, "").split("/").pop() ?? "folder"
        saveDownload(URL.createObjectURL(blob), `${folderName}.zip`, true)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
  )

  const deleteEntry = React.useCallback(
    async (item: FileSystemItem) => {
      if (!ref) throw new Error("No active connection")
      try {
        await deleteEntryAction(ref, toEntryRef(item))
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
  )

  const renameEntry = React.useCallback(
    async (item: FileSystemItem, name: string) => {
      if (!ref) throw new Error("No active connection")
      try {
        await renameEntryAction(ref, toEntryRef(item), name)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
  )

  const moveEntry = React.useCallback(
    async (item: FileSystemItem, destinationFolder: string) => {
      if (!ref) throw new Error("No active connection")
      try {
        await moveEntryAction(ref, toEntryRef(item), destinationFolder)
      } catch (err) {
        throw new Error(errorMessage(err))
      }
    },
    [ref]
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
    moveEntry,
    refresh,
    isLoading: Boolean(
      connection && (isLoading || loadedConnection !== connection)
    ),
    error,
  }
}
