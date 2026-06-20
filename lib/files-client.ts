import { createFiles as createFilesSdk, type Files } from "files-sdk"
import { r2 } from "files-sdk/r2"
import { s3 } from "files-sdk/s3"
import { zip, type ZipApi } from "files-sdk/zip"

import type { Connection } from "@/lib/connections"

export type FilesClient = Files & ZipApi

const clientCache = new Map<string, FilesClient>()

function buildFiles(connection: Connection): FilesClient {
  if (connection.provider === "r2") {
    return createFilesSdk({
      adapter: r2({
        bucket: connection.bucket,
        accountId: connection.accountId,
        accessKeyId: connection.accessKeyId,
        secretAccessKey: connection.secretAccessKey,
        publicBaseUrl: connection.publicBaseUrl,
      }),
      plugins: [zip()],
    })
  }

  // s3 + s3-compatible. AWS SDK requires a region even with a custom
  // endpoint; "auto" is the conventional value for S3-compatible services.
  return createFilesSdk({
    adapter: s3({
      bucket: connection.bucket,
      region: connection.region || "auto",
      endpoint: connection.endpoint || undefined,
      forcePathStyle: connection.forcePathStyle,
      credentials: {
        accessKeyId: connection.accessKeyId,
        secretAccessKey: connection.secretAccessKey,
      },
      publicBaseUrl: connection.publicBaseUrl || undefined,
    }),
    plugins: [zip()],
  })
}

/** Fingerprint that changes whenever connection credentials/target change. */
function fingerprint(c: Connection): string {
  return JSON.stringify([
    c.id,
    c.provider,
    c.bucket,
    c.region,
    c.endpoint,
    c.forcePathStyle,
    c.accountId,
    c.accessKeyId,
    c.secretAccessKey,
    c.publicBaseUrl,
  ])
}

/** Build (and cache) a `Files` client for a connection. */
export function createFiles(connection: Connection): FilesClient {
  const key = fingerprint(connection)
  let files = clientCache.get(key)
  if (!files) {
    files = buildFiles(connection)
    clientCache.set(key, files)
  }
  return files
}
