import type { Metadata } from "next"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { withUiBasePath } from "@/lib/config/base-path"
import { fontVariables } from "@/lib/config/fonts"
import { META_THEME_COLORS, siteConfig } from "@/lib/config/site"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ActiveThemeProvider } from "@/components/providers/active-theme"
import { TailwindIndicator } from "@/components/providers/tailwind-indicator"
import { ThemeProvider } from "@/components/providers/theme-provider"

import "@/app/globals.css"

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? siteConfig.url),
  description: siteConfig.description,
  keywords: ["Next.js", "React", "Tailwind CSS", "Documents", "Components"],
  authors: [
    {
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL ?? siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? siteConfig.url}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      `${process.env.NEXT_PUBLIC_APP_URL ?? siteConfig.url}/opengraph-image.png`,
    ],
  },
  icons: {
    icon: [
      { url: withUiBasePath("/icon.svg"), type: "image/svg+xml" },
      {
        url: withUiBasePath("/icon.png"),
        sizes: "256x256",
        type: "image/png",
      },
    ],
    shortcut: withUiBasePath("/icon.png"),
    apple: withUiBasePath("/icon.png"),
  },
  manifest: withUiBasePath("/site.webmanifest"),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        <Script
          id="theme-layout-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `,
          }}
        />
        <meta name="theme-color" content={META_THEME_COLORS.light} />
      </head>
      <body
        className={cn(
          "group/body relative overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)]"
        )}
      >
        <ThemeProvider>
          <ActiveThemeProvider>
            <NuqsAdapter>
              <TooltipProvider delayDuration={0}>
                {children}
                <Toaster position="top-center" />
              </TooltipProvider>
            </NuqsAdapter>
            <TailwindIndicator />
          </ActiveThemeProvider>
        </ThemeProvider>
        <Analytics />
        <div id="portal" className="fixed top-0 left-0 z-40" />
      </body>
    </html>
  )
}
