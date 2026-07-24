import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { siteConfig } from "@/lib/config/site"
import { FileBrowser } from "@/components/storage/file-browser"
import { SectionUrlSync } from "@/components/storage/section-url-sync"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata")
  return {
    title: { absolute: siteConfig.name },
    description: t("indexDescription"),
  }
}

export default function IndexPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionUrlSync />
      <FileBrowser />
    </div>
  )
}
