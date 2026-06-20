"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { getFileKind, type FileKind } from "@/lib/file-kind"
import {
  AppIcon,
  Cancel01Icon,
  Download01Icon,
  File01Icon,
  Search01Icon,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { type FileSystemFileItem } from "@/components/ui/file-system"
import { Spinner } from "@/components/ui/spinner"
import { CodeViewer, type CodeViewerHandle } from "@/components/code-viewer"

const LazyPDFViewer = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((mod) => ({
    default: mod.PDFViewer,
  }))
)
const LazyDocxViewerPreview = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((mod) => ({
    default: mod.DocxViewerPreview,
  }))
)
const LazyXlsxViewerPreview = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((mod) => ({
    default: mod.XlsxViewerPreview,
  }))
)

const DIALOG_CLASSNAMES: Record<FileKind, string> = {
  text: "h-[85vh] w-[min(96vw,80rem)] max-w-none p-0",
  pdf: "h-[88vh] w-[min(96vw,68rem)] max-w-none p-0",
  docx: "h-[88vh] w-[min(96vw,68rem)] max-w-none p-0",
  xlsx: "h-[85vh] w-[min(96vw,100rem)] max-w-none p-0",
  image: "max-h-[88vh] w-fit max-w-[min(96vw,64rem)] p-2",
  other: "max-w-md",
}

function ViewerFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
}

function UnsupportedFile({ fileName, url }: { fileName: string; url: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <AppIcon icon={File01Icon} className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No inline preview</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          This file type can’t be previewed. Download it or open it in a new
          tab.
        </p>
      </div>
      <div className="flex gap-2">
        <Button render={<a href={url} download={fileName} />}>
          <AppIcon icon={Download01Icon} className="size-4" />
          Download
        </Button>
        <Button
          variant="outline"
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
        >
          Open in new tab
        </Button>
      </div>
    </div>
  )
}

function ViewerBody({
  kind,
  fileName,
  url,
  codeViewerRef,
}: {
  kind: FileKind
  fileName: string
  url: string
  codeViewerRef: React.RefObject<CodeViewerHandle | null>
}) {
  const { resolvedTheme } = useTheme()
  const [isDark, setIsDark] = React.useState(resolvedTheme === "dark")
  React.useEffect(() => {
    setIsDark(resolvedTheme === "dark")
  }, [resolvedTheme])

  switch (kind) {
    case "text":
      return <CodeViewer ref={codeViewerRef} url={url} fileName={fileName} />
    case "pdf":
      return (
        <React.Suspense fallback={<ViewerFallback />}>
          <LazyPDFViewer src={url} className="h-full" />
        </React.Suspense>
      )
    case "docx":
      return (
        <React.Suspense fallback={<ViewerFallback />}>
          <LazyDocxViewerPreview
            src={url}
            fileName={fileName}
            className="h-full"
            isDark={isDark}
            onIsDarkChange={setIsDark}
          />
        </React.Suspense>
      )
    case "xlsx":
      return (
        <React.Suspense fallback={<ViewerFallback />}>
          <LazyXlsxViewerPreview
            src={url}
            fileName={fileName}
            className="h-full"
            isDark={isDark}
            onIsDarkChange={setIsDark}
          />
        </React.Suspense>
      )
    case "image":
      return (
        <img
          src={url}
          alt={fileName}
          className="max-h-[84vh] w-auto max-w-full rounded-lg object-contain"
        />
      )
    default:
      return <UnsupportedFile fileName={fileName} url={url} />
  }
}

export function FileViewerDialog({
  file,
  url,
  open,
  onOpenChange,
}: {
  file: FileSystemFileItem | null
  url: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const kind = file ? getFileKind(file) : "other"
  const fileName = file
    ? (file.name ?? file.path.split("/").pop() ?? file.path)
    : ""
  const codeViewerRef = React.useRef<CodeViewerHandle>(null)

  // These viewers render their own top toolbars, which would collide with the
  // dialog's default top-right close button. Give them a dedicated title bar
  // with the close control instead, and hide the built-in one.
  const isFramed =
    kind === "text" || kind === "pdf" || kind === "docx" || kind === "xlsx"

  const body = url ? (
    <ViewerBody
      kind={kind}
      fileName={fileName}
      url={url}
      codeViewerRef={codeViewerRef}
    />
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
      Couldn’t resolve a URL for this file.
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && file ? (
        <DialogContent
          showCloseButton={!isFramed}
          className={cn("overflow-hidden", DIALOG_CLASSNAMES[kind])}
        >
          <DialogTitle className="sr-only">{fileName}</DialogTitle>
          {isFramed ? (
            <div className="flex h-full min-h-0 flex-col">
              {/* Text and PDF viewers don't show the filename themselves, so
                  this bar provides the title (and download for text). DOCX/XLSX
                  render their own titled toolbars, so the bar is close-only. */}
              <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
                {kind === "text" || kind === "pdf" ? (
                  <span className="min-w-0 truncate text-sm font-medium">
                    {fileName}
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {kind === "text" ? (
                    <Button
                      aria-label="Search"
                      title="Search"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => codeViewerRef.current?.toggleSearch()}
                    >
                      <AppIcon icon={Search01Icon} />
                    </Button>
                  ) : null}
                  {kind === "text" && url ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      render={<a href={url} download={fileName} />}
                    >
                      <AppIcon icon={Download01Icon} className="size-4" />
                      Download
                    </Button>
                  ) : null}
                  <DialogClose
                    aria-label="Close"
                    render={<Button size="icon" variant="ghost" />}
                  >
                    <AppIcon icon={Cancel01Icon} />
                  </DialogClose>
                </div>
              </div>
              <div className="min-h-0 flex-1">{body}</div>
            </div>
          ) : (
            body
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
