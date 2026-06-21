import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  isAuthEnabled,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/core"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = {
  title: "Sign in",
}

// Auth state is read from runtime env (and the session cookie), so this page
// must never be prerendered — otherwise the build-time "auth off → redirect"
// result gets frozen into a static response.
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  // With no credentials configured the gate is off — never show a login wall.
  if (!isAuthEnabled()) redirect("/")

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (await verifySessionToken(token)) redirect("/")

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <LoginForm />
    </main>
  )
}
