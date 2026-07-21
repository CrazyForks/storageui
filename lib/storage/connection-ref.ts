import type { Connection } from "@/lib/storage/connections"

/**
 * What the browser sends to a server action to identify the bucket to act on,
 * without exposing env credentials to the client.
 *
 * - `env`  — the connection is configured from server-only env vars; the
 *   browser only knows its id and the server resolves the real credentials.
 * - `local` — a connection the user added in the UI; its credentials live in
 *   the user's own browser (localStorage) and are sent with each call so the
 *   server can sign on their behalf. They are never baked into the public
 *   bundle.
 */
export type ConnectionRef =
  { source: "env"; id: string } | { source: "local"; connection: Connection }

export function toConnectionRef(connection: Connection): ConnectionRef {
  return connection.source === "env"
    ? { source: "env", id: connection.id }
    : { source: "local", connection }
}
