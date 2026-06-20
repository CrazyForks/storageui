import { Files } from "files-sdk"
import { r2 } from "files-sdk/r2"
import { s3 } from "files-sdk/s3"

import type { Connection } from "@/lib/connections"

const clientCache = new Map<string, Files>()

function buildFiles(connection: Connection): Files {
  if (connection.provider === "r2") {
    return new Files({
      adapter: r2({
        bucket: connection.bucket,
        accountId: connection.accountId,
        accessKeyId: connection.accessKeyId,
        secretAccessKey: connection.secretAccessKey,
        publicBaseUrl: connection.publicBaseUrl,
      }),
    })
  }

  // s3 + s3-compatible. AWS SDK requires a region even with a custom
  // endpoint; "auto" is the conventional value for S3-compatible services.
  return new Files({
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
export function createFiles(connection: Connection): Files {
  const key = fingerprint(connection)
  let files = clientCache.get(key)
  if (!files) {
    files = buildFiles(connection)
    clientCache.set(key, files)
  }
  return files
}
