// Supported UI locales. The active locale is stored in a cookie (no per-locale
// URL routing), so adding a language is: add it here + a messages/<locale>.json.
export const locales = ["en", "zh"] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

/** Names shown in the language switcher, each in its own language. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
}

export const LOCALE_COOKIE = "NEXT_LOCALE"

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value)
}
