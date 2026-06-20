/**
 * S3 / R2 connection model. This app has no backend, so a connection's
 * credentials live entirely client-side: either baked in at build time from
 * `NEXT_PUBLIC_*` env vars, or added in the UI and persisted by Zustand.
 *
 * Secrets are therefore exposed to the browser — an accepted trade-off for a
 * no-backend, bring-your-own-bucket client. The target bucket must have CORS
 * enabled for direct browser access.
 */

export type ConnectionProvider = "s3" | "r2" | "s3-compatible"

export type Connection = {
  id: string
  name: string
  provider: ConnectionProvider
  bucket: string
  region?: string
  /** Custom endpoint for R2 / S3-compatible services. */
  endpoint?: string
  /** Path-style addressing — required by MinIO and some S3-compatible services. */
  forcePathStyle?: boolean
  /** Cloudflare account id (R2). */
  accountId?: string
  accessKeyId: string
  secretAccessKey: string
  /** Public/CDN origin; when set, `url()` skips signing. */
  publicBaseUrl?: string
  /** Where the connection came from. `env` connections are read-only in the UI. */
  source: "env" | "local"
}

export const ENV_CONNECTION_ID = "env"

/**
 * Build a connection from `NEXT_PUBLIC_*` env vars, if present. Each var is
 * referenced as a literal member access so Next.js inlines it at build time.
 */
export function loadEnvConnection(): Connection | null {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET
  const accessKeyId = process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) return null

  const provider =
    (process.env.NEXT_PUBLIC_S3_PROVIDER as ConnectionProvider | undefined) ??
    "s3"

  return {
    id: ENV_CONNECTION_ID,
    name: process.env.NEXT_PUBLIC_S3_NAME || bucket,
    provider,
    bucket,
    region: process.env.NEXT_PUBLIC_S3_REGION || undefined,
    endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.NEXT_PUBLIC_S3_FORCE_PATH_STYLE === "true",
    accountId: process.env.NEXT_PUBLIC_R2_ACCOUNT_ID || undefined,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || undefined,
    source: "env",
  }
}

export function createConnectionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
