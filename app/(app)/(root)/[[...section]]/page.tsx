import { type Metadata } from "next"

import { siteConfig } from "@/lib/config/site"
import { FileBrowser } from "@/components/storage/file-browser"
import { SectionUrlSync } from "@/components/storage/section-url-sync"

const description =
  "A macOS Finder-style file browser for flat object-store manifests, with built-in PDF, DOCX, and XLSX preview."

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title: { absolute: siteConfig.name },
  description,
}

export function generateStaticParams() {
  return [{ section: [] }, { section: ["recents"] }, { section: ["starred"] }]
}

export default function IndexPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionUrlSync />
      <FileBrowser />
    </div>
  )
}
