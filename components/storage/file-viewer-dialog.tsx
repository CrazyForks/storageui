"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { getFileKind, type FileKind } from "@/lib/file-kind"
import {
  AppIcon,
  Cancel01Icon,
  Download01Icon,
  FavouriteIcon,
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
import { Spinner } from "@/components/ui/spinner"
import type { FileSystemFileItem } from "@/components/explorer/types"
import {
  CodeViewer,
  type CodeViewerHandle,
} from "@/components/viewers/code/code-viewer"

const LazyPDFViewer = React.lazy(() =>
  import("@/components/viewers/pdf/pdf-viewer").then((mod) => ({
    default: mod.PDFViewer,
  }))
)
const LazyDocxViewerPreview = React.lazy(() =>
  import("@/components/viewers/docx/docx-viewer").then((mod) => ({
    default: mod.DocxViewerPreview,
  }))
)
const LazyXlsxViewerPreview = React.lazy(() =>
  import("@/components/viewers/xlsx/xlsx-viewer").then((mod) => ({
    default: mod.XlsxViewerPreview,
  }))
)
const LazyVideoPlayer = React.lazy(() => import("react-player"))

const DIALOG_CLASSNAMES: Record<FileKind, string> = {
  text: "h-[85vh] w-[min(96vw,80rem)] max-w-none p-0",
  pdf: "h-[88vh] w-[min(96vw,68rem)] max-w-none p-0",
  docx: "h-[88vh] w-[min(96vw,68rem)] max-w-none p-0",
  xlsx: "h-[85vh] w-[min(96vw,100rem)] max-w-none p-0",
  image: "max-h-[88vh] w-fit min-w-[18rem] max-w-[min(96vw,64rem)] p-0",
  video: "w-[min(96vw,72rem)] max-w-none p-0",
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
          <LazyPDFViewer src={url} showUpload={false} className="h-full" />
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
          className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
        />
      )
    case "video":
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <React.Suspense fallback={<ViewerFallback />}>
            <LazyVideoPlayer src={url} controls width="100%" height="100%" />
          </React.Suspense>
        </div>
      )
    default:
      return <UnsupportedFile fileName={fileName} url={url} />
  }
}

function StarButton({
  isStarred,
  onToggleStar,
}: {
  isStarred: boolean
  onToggleStar: () => void
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={isStarred ? "Remove star" : "Add star"}
      title={isStarred ? "Remove star" : "Add star"}
      onClick={onToggleStar}
      className={isStarred ? "text-amber-500 hover:text-amber-500" : undefined}
    >
      <AppIcon
        icon={FavouriteIcon}
        className={isStarred ? "fill-current" : undefined}
      />
    </Button>
  )
}

export function FileViewerDialog({
  file,
  url,
  open,
  onOpenChange,
  isStarred = false,
  onToggleStar,
}: {
  file: FileSystemFileItem | null
  url: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isStarred?: boolean
  onToggleStar?: () => void
}) {
  const kind = file ? getFileKind(file) : "other"
  const fileName = file
    ? (file.name ?? file.path.split("/").pop() ?? file.path)
    : ""
  const codeViewerRef = React.useRef<CodeViewerHandle>(null)

  // These viewers render their own top toolbars, which would collide with the
  // dialog's default top-right close button. Give them a dedicated title bar
  // with the close control instead, and hide the built-in one.
  // Image and video get a header bar (title + close) like the document viewers,
  // and their media is centered below it.
  const isMedia = kind === "image" || kind === "video"

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
          showCloseButton={kind === "other"}
          className={cn("overflow-hidden", DIALOG_CLASSNAMES[kind])}
        >
          <DialogTitle className="sr-only">{fileName}</DialogTitle>
          {kind === "other" ? (
            body
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {/* The text, PDF, XLSX, image, and video viewers don't show the
                  filename themselves, so this bar provides the title (plus
                  search/download for text and the star toggle). DOCX renders
                  its own titled toolbar, so its bar is close-only. */}
              <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
                {kind !== "docx" ? (
                  <span className="min-w-0 truncate text-sm font-medium">
                    {fileName}
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {onToggleStar ? (
                    <StarButton
                      isStarred={isStarred}
                      onToggleStar={onToggleStar}
                    />
                  ) : null}
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
              <div
                className={
                  isMedia
                    ? "flex min-h-0 flex-1 items-center justify-center p-2"
                    : "min-h-0 flex-1"
                }
              >
                {body}
              </div>
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
