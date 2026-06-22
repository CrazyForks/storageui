import { cookies } from "next/headers"
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config"
import { getRequestConfig } from "next-intl/server"

// Request-scoped config: pick the locale from the cookie (falling back to the
// default) and load that catalog. No i18n routing — the locale lives in a cookie.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
