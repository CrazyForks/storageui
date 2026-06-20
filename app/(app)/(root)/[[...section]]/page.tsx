import { type Metadata } from "next"

import { FileBrowser } from "@/components/storage/file-browser"
import { SectionUrlSync } from "@/components/storage/section-url-sync"

const title = "File System"
const description =
  "A macOS Finder-style file browser for flat object-store manifests, with built-in PDF, DOCX, and XLSX preview."

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title,
  description,
}

// Pre-render the browse tabs so `/`, `/Recents`, and `/Starred` all resolve on
// a hard reload or bookmark. The section itself is driven client-side by
// SectionUrlSync, so every path renders the same FileBrowser.
export function generateStaticParams() {
  return [{ section: [] }, { section: ["Recents"] }, { section: ["Starred"] }]
}

export default function IndexPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionUrlSync />
      <FileBrowser />
    </div>
  )
}
