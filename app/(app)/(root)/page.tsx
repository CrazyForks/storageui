import { type Metadata } from "next"

import { FileBrowser } from "@/components/file-browser"

const title = "File System"
const description =
  "A macOS Finder-style file browser for flat object-store manifests, with built-in PDF, DOCX, and XLSX preview."

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title,
  description,
}

export default function IndexPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileBrowser />
    </div>
  )
}
