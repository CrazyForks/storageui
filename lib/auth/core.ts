// Optional username/password gate. Auth is enabled only when both
// `AUTH_USERNAME` and `AUTH_PASSWORD` env vars are set; otherwise the app is
// open. The session is a stateless HMAC token stored in an httpOnly cookie —
// no database or external session store.
//
// This module is server-side only by intent (it reads non-`NEXT_PUBLIC_` env
// vars, which are `undefined` in the browser bundle anyway). It deliberately
// avoids the `server-only` import and Node-only APIs so it can run in both
// Server Actions (Node) and Middleware (Edge) via the Web Crypto API.

const encoder = new TextEncoder()

export const SESSION_COOKIE_NAME = "fs_session"
const SESSION_PAYLOAD = "filesystem-auth-v1"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

/** Auth is active only when both credentials are configured. */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD)
}

// Signing key for the session token. A dedicated `AUTH_SECRET` is preferred, but
// falling back to the credentials means changing the password invalidates every
// existing session for free.
function sessionSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    `${process.env.AUTH_USERNAME ?? ""}:${process.env.AUTH_PASSWORD ?? ""}`
  )
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AUTH_USERNAME ?? ""
  const expectedPass = process.env.AUTH_PASSWORD ?? ""
  if (!expectedUser || !expectedPass) return false
  return (
    timingSafeEqual(username, expectedUser) &&
    timingSafeEqual(password, expectedPass)
  )
}

export async function createSessionToken(): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(SESSION_PAYLOAD)
  )
  return toHex(new Uint8Array(signature))
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false
  return timingSafeEqual(token, await createSessionToken())
}

function toHex(bytes: Uint8Array): string {
  let out = ""
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0")
  return out
}

// Length-independent, constant-time-ish comparison so a wrong guess doesn't leak
// how far it matched through response timing.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  let diff = aBytes.length ^ bBytes.length
  const length = Math.max(aBytes.length, bBytes.length)
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return diff === 0
}
