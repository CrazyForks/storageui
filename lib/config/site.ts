const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.extend.ai/ui"

export const siteConfig = {
  name: "Storage UI",
  url: appUrl,
  ogImage: `${appUrl}/opengraph-image.png`,
  description:
    "A Finder-style file browser for S3, R2, Alibaba OSS, Tencent COS, Backblaze B2, and compatible object stores, with built-in document preview.",
}

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
}
