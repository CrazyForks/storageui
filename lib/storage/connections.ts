/**
 * Object-storage connection model.
 *
 * Credentials never reach the browser as part of the build: env-configured
 * buckets live in server-only env vars (see `connections-server.ts`) and are
 * exercised through server actions + presigned URLs. Connections the user adds
 * in the UI keep their credentials in that user's own browser (localStorage)
 * and are sent to the server per call to sign requests.
 *
 * For an `env` connection the client only ever holds the public fields below
 * (its `accessKeyId` / `secretAccessKey` are blanked); for a `local`
 * connection they are populated. The target bucket must allow CORS for the
 * browser's direct presigned GET/PUT requests.
 */

export type ConnectionProvider =
  | "s3"
  | "r2"
  | "alibaba"
  | "backblaze-b2"
  | "minio"
  | "s3-compatible"

export type Connection = {
  id: string
  name: string
  provider: ConnectionProvider
  bucket: string
  region?: string
  /** Custom endpoint for R2, Alibaba OSS, Backblaze B2, or S3-compatible services. */
  endpoint?: string
  /** Path-style addressing — required by MinIO and some S3-compatible services. */
  forcePathStyle?: boolean
  /** Cloudflare account id (R2). */
  accountId?: string
  accessKeyId: string
  secretAccessKey: string
  /** Public/CDN origin; when set, `url()` skips signing. */
  publicBaseUrl?: string
  /** Disallow uploads and every other mutating operation. */
  readOnly?: boolean
  /** Where the connection came from. `env` definitions cannot be edited in the UI. */
  source: "env" | "local"
}

/** Stable id of the legacy single-bucket env connection. */
export const ENV_CONNECTION_ID = "env"
/** Prefix for indexed env connections, e.g. `env-1`, `env-2`. */
export const ENV_CONNECTION_ID_PREFIX = "env-"

export function createConnectionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
