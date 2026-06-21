"use server"

import { FilesError } from "files-sdk"

import type { ConnectionRef } from "@/lib/storage/connection-ref"
import type { Connection } from "@/lib/storage/connections"
import {
  listPublicEnvConnections,
  resolveFiles,
  type FilesClient,
} from "@/lib/storage/connections-server"
import type {
  FileSystemItem,
  FileSystemLoadChildrenResult,
} from "@/components/explorer/types"

const PAGE_LIMIT = 1000
const URL_EXPIRES_IN = 3600

/** Minimal, serializable description of an entry to operate on. */
export type EntryRef = { kind: "file" | "folder"; path: string; key?: string }

/** A presigned direct upload, as returned by `files-sdk`'s `signedUploadUrl`. */
export type SignedUpload =
  | { method: "PUT"; url: string; headers?: Record<string, string> }
  | { method: "POST"; url: string; fields: Record<string, string> }

function toError(error: unknown): Error {
  if (error instanceof FilesError)
    return new Error(`${error.message} (${error.code})`)
  if (error instanceof Error) return error
  return new Error(String(error))
}

function parentPath(path: string) {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path
  const separatorIndex = normalized.lastIndexOf("/")
  return separatorIndex < 0 ? "" : normalized.slice(0, separatorIndex + 1)
}

async function listKeys(files: FilesClient, prefix: string) {
  const keys: string[] = []
  for await (const item of files.listAll({ prefix })) {
    keys.push(item.key)
  }
  return keys
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

/** The env connections, with credentials stripped, for the sidebar. */
export async function listEnvConnectionsAction(): Promise<Connection[]> {
  return listPublicEnvConnections()
}

/** Validate a connection's credentials + CORS with a tiny list. */
export async function testConnectionAction(ref: ConnectionRef): Promise<void> {
  try {
    await resolveFiles(ref).list({ limit: 1 })
  } catch (error) {
    throw toError(error)
  }
}

/** One page of a folder, mapped to the FileSystem manifest shape. */
export async function listFolderAction(
  ref: ConnectionRef,
  prefix: string,
  cursor: string | null
): Promise<FileSystemLoadChildrenResult> {
  try {
    const files = resolveFiles(ref)
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
  } catch (error) {
    throw toError(error)
  }
}

/** Presigned GET URL for previewing/downloading a single object. */
export async function signFileUrlAction(
  ref: ConnectionRef,
  key: string
): Promise<string> {
  try {
    return await resolveFiles(ref).url(key, { expiresIn: URL_EXPIRES_IN })
  } catch (error) {
    throw toError(error)
  }
}

/** Presigned direct-upload descriptor so the browser PUTs straight to S3/R2. */
export async function signUploadUrlAction(
  ref: ConnectionRef,
  key: string,
  contentType?: string
): Promise<SignedUpload> {
  try {
    return (await resolveFiles(ref).signedUploadUrl(key, {
      expiresIn: URL_EXPIRES_IN,
      contentType: contentType || undefined,
    })) as SignedUpload
  } catch (error) {
    throw toError(error)
  }
}

/** Create an object-store folder marker at a path ending in `/`. */
export async function createFolderAction(
  ref: ConnectionRef,
  path: string
): Promise<void> {
  const key = path.endsWith("/") ? path : `${path}/`
  try {
    await resolveFiles(ref).upload(key, new Uint8Array(), {
      contentType: "application/x-directory",
    })
  } catch (error) {
    throw toError(error)
  }
}

/** Delete a file or recursively delete every object under a folder. */
export async function deleteEntryAction(
  ref: ConnectionRef,
  item: EntryRef
): Promise<void> {
  try {
    const files = resolveFiles(ref)

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
  } catch (error) {
    throw toError(error)
  }
}

/** Rename a file or recursively move every object under a folder. */
export async function renameEntryAction(
  ref: ConnectionRef,
  item: EntryRef,
  name: string
): Promise<void> {
  const nextName = name.trim()
  if (!nextName) throw new Error("Enter a name.")

  try {
    const files = resolveFiles(ref)

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

    const sourcePrefix = item.path.endsWith("/") ? item.path : `${item.path}/`
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
  } catch (error) {
    throw toError(error)
  }
}

/** Move a file or folder into another folder (`""` is the bucket root). */
export async function moveEntryAction(
  ref: ConnectionRef,
  item: EntryRef,
  destinationFolder: string
): Promise<void> {
  // Normalize the destination to "" (root) or a "prefix/" form.
  const destination =
    !destinationFolder || destinationFolder.endsWith("/")
      ? destinationFolder
      : `${destinationFolder}/`

  try {
    const files = resolveFiles(ref)

    if (item.kind === "file") {
      const sourceKey = item.key ?? item.path
      const name = sourceKey.slice(parentPath(sourceKey).length)
      const destinationKey = `${destination}${name}`

      if (destinationKey === sourceKey) return
      if (
        (await keyExists(files, destinationKey)) ||
        (await prefixExists(files, `${destinationKey}/`))
      ) {
        throw new Error("An item with this name already exists there.")
      }

      await files.move(sourceKey, destinationKey)
      return
    }

    const sourcePrefix = item.path.endsWith("/") ? item.path : `${item.path}/`
    const folderName = sourcePrefix
      .slice(parentPath(sourcePrefix).length)
      .replace(/\/$/, "")
    const destinationPrefix = `${destination}${folderName}/`

    if (destinationPrefix === sourcePrefix) return
    if (destinationPrefix.startsWith(sourcePrefix)) {
      throw new Error("Can’t move a folder into itself.")
    }
    if (
      (await keyExists(files, destinationPrefix.slice(0, -1))) ||
      (await prefixExists(files, destinationPrefix))
    ) {
      throw new Error("An item with this name already exists there.")
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
  } catch (error) {
    throw toError(error)
  }
}
