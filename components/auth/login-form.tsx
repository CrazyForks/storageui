"use client"

import * as React from "react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { siteConfig } from "@/lib/config/site"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/foundations/logo"
import { loginAction, type LoginState } from "@/app/actions/auth"

const INITIAL_STATE: LoginState = { error: null }

export function LoginForm() {
  const t = useTranslations("Login")
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_STATE
  )

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-4">
        <Logo className="size-7 text-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {t("signIn")}
          </h1>
          <p className="text-muted-foreground">
            {t("continueTo", { name: siteConfig.name })}
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        <div className="grid grid-cols-[6rem_1fr] items-center gap-x-5 gap-y-4">
          <label htmlFor="username" className="text-sm font-medium">
            {t("username")}
          </label>
          <Input
            id="username"
            name="username"
            placeholder={t("usernamePlaceholder")}
            autoComplete="username"
            autoFocus
            required
            aria-invalid={state.error ? true : undefined}
          />

          <label htmlFor="password" className="text-sm font-medium">
            {t("password")}
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
          />

          {state.error ? (
            <p className="col-start-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </div>

        <Button type="submit" loading={isPending}>
          {t("signIn")}
        </Button>
      </form>
    </div>
  )
}
