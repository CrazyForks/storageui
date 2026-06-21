const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.extend.ai/ui"

export const siteConfig = {
  name: "Drive UI",
  url: appUrl,
  ogImage: `${appUrl}/opengraph-image.png`,
  description:
    "A Finder-style file browser for S3 / R2 object stores, with built-in PDF, DOCX, and XLSX preview.",
}

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
}
