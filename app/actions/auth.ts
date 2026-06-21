"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  createSessionToken,
  isAuthEnabled,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyCredentials,
} from "@/lib/auth/core"

export type LoginState = { error: string | null }

/** Whether a username/password gate is configured (read at runtime). */
export async function isAuthEnabledAction(): Promise<boolean> {
  return isAuthEnabled()
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!verifyCredentials(username, password)) {
    return { error: "Incorrect username or password." }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  // Set-Cookie rides along with the redirect response.
  redirect("/")
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect("/login")
}
