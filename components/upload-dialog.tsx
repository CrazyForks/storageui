"use client"

import * as React from "react"

import { AppIcon, Cancel01Icon, File01Icon, Upload01Icon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function UploadDialog({
  open,
  onOpenChange,
  defaultPrefix = "",
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Folder the browser is currently viewing; pre-fills the destination. */
  defaultPrefix?: string
  /** Hand the chosen files + destination to the upload queue. */
  onSubmit: (files: File[], prefix: string) => void
}) {
  const [prefix, setPrefix] = React.useState(defaultPrefix)
  const [files, setFiles] = React.useState<File[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setPrefix(defaultPrefix)
      setFiles([])
      setIsDragging(false)
    }
  }, [open, defaultPrefix])

  const addFiles = React.useCallback((incoming: FileList | File[]) => {
    const next = Array.from(incoming)
    if (next.length) setFiles((prev) => [...prev, ...next])
  }, [])

  const handleSubmit = () => {
    if (files.length === 0) return
    onSubmit(files, prefix)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload files</DialogTitle>
            <DialogDescription>
              Files are uploaded directly to the bucket from your browser.
            </DialogDescription>
          </DialogHeader>

          <DialogPanel>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label
                  htmlFor="upload-destination"
                  className="text-sm font-medium"
                >
                  Destination folder
                </label>
                <Input
                  id="upload-destination"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="(root)"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to upload to the bucket root. Example:{" "}
                  <code className="font-mono">invoices/2026/</code>
                </p>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    inputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  if (e.dataTransfer.files.length)
                    addFiles(e.dataTransfer.files)
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                )}
              >
                <AppIcon
                  icon={Upload01Icon}
                  className="size-6 text-muted-foreground"
                />
                <div>
                  <span className="font-medium text-foreground">
                    Click to choose
                  </span>{" "}
                  <span className="text-muted-foreground">
                    or drag and drop files here
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </div>

              {files.length > 0 ? (
                <ul className="grid gap-2">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border bg-card p-2.5"
                    >
                      <AppIcon
                        icon={File01Icon}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove"
                      >
                        <AppIcon icon={Cancel01Icon} className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </DialogPanel>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={files.length === 0}
            >
              <AppIcon icon={Upload01Icon} className="size-4" />
              {files.length > 0
                ? `Upload ${files.length} file${files.length === 1 ? "" : "s"}`
                : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
