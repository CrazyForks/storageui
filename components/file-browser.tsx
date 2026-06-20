"use client"

import * as React from "react"

import {
  AppIcon,
  CloudServerIcon,
  PlusSignCircleIcon,
  Upload01Icon,
} from "@/lib/icons"
import {
  bucketBrowserKey,
  DEFAULT_BUCKET_BROWSER_SETTINGS,
  useBucketBrowserStore,
} from "@/lib/store/bucket-browser-store"
import { useConnections } from "@/lib/store/connection-store"
import { usePreferencesStore } from "@/lib/store/preferences-store"
import { useUploadUiStore } from "@/lib/store/upload-ui-store"
import { useS3FileSystem } from "@/lib/use-s3-file-system"
import { useUploads } from "@/lib/use-uploads"
import { Button } from "@/components/ui/button"
import {
  FileSystem,
  type FileSystemFileItem,
} from "@/components/ui/file-system"
import { FileViewerDialog } from "@/components/file-viewer-dialog"
import { UploadProgressPanel } from "@/components/upload-progress-panel"

function EmptyState() {
  const { openAddDialog } = useConnections()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <AppIcon icon={CloudServerIcon} className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">No bucket connected</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connect an S3, R2, or S3-compatible bucket to browse its objects.
          Credentials stay in your browser; the bucket must allow CORS.
        </p>
      </div>
      <Button onClick={openAddDialog}>
        <AppIcon icon={PlusSignCircleIcon} className="size-4" />
        Add connection
      </Button>
    </div>
  )
}

export function FileBrowser() {
  const { activeConnection } = useConnections()
  const bucketKey = activeConnection ? bucketBrowserKey(activeConnection) : ""
  const browserSettings = useBucketBrowserStore(
    (state) => state.buckets[bucketKey] ?? DEFAULT_BUCKET_BROWSER_SETTINGS
  )
  const setBucketView = useBucketBrowserStore((state) => state.setView)
  const setBucketSort = useBucketBrowserStore((state) => state.setSort)
  const setBucketFilters = useBucketBrowserStore((state) => state.setFilters)
  const showFileExtensions = usePreferencesStore(
    (state) => state.showFileExtensions
  )
  const {
    items,
    loadChildren,
    getFileUrl,
    uploadFile,
    createFolder,
    refresh,
    isLoading,
    error,
  } = useS3FileSystem(activeConnection)
  const [opened, setOpened] = React.useState<{
    file: FileSystemFileItem
    url: string | null
  } | null>(null)
  // The Upload trigger lives in the sidebar, but the file input (and the
  // current folder) live here. Expose an opener through the shared store so the
  // sidebar can pop the native picker; selected files upload straight to the
  // current folder, no intermediate dialog.
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const setPickFiles = useUploadUiStore((state) => state.setPickFiles)
  React.useEffect(() => {
    setPickFiles(() => fileInputRef.current?.click())
    return () => setPickFiles(null)
  }, [setPickFiles])
  // The folder FileSystem is currently showing, tagged with the connection it
  // belongs to. On a connection switch the path is stale, so we fall back to
  // the root — otherwise the remount opens a non-root folder with no back
  // history and the back button gets stuck disabled.
  const [folder, setFolder] = React.useState<{ connId: string; path: string }>({
    connId: "",
    path: "",
  })
  const currentPath = folder.connId === activeConnection?.id ? folder.path : ""
  const [isDragging, setIsDragging] = React.useState(false)
  const dragDepth = React.useRef(0)
  // Bumped after a successful upload to remount FileSystem and re-list the bucket.
  const [refreshNonce, setRefreshNonce] = React.useState(0)

  const { tasks, enqueue, dismiss, clearFinished, activeCount } = useUploads({
    uploadFile,
    onBatchComplete: () => {
      // Re-fetch root, then remount FileSystem so the current folder re-lists
      // (its children are cached inside the component) while staying put.
      refresh()
      setRefreshNonce((n) => n + 1)
    },
  })

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files.length) {
      enqueue(Array.from(e.dataTransfer.files), currentPath)
    }
  }

  if (!activeConnection) {
    return <EmptyState />
  }

  if (error && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="text-base font-semibold">Couldn’t load this bucket</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <p className="text-xs text-muted-foreground">
          Check the credentials and that the bucket’s CORS policy allows this
          origin.
        </p>
      </div>
    )
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return
        dragDepth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files"))
          e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setIsDragging(false)
      }}
      onDrop={handleDrop}
    >
      <FileSystem
        key={`${activeConnection.id}:${refreshNonce}`}
        items={items}
        isLoading={isLoading}
        title={activeConnection.name}
        view={browserSettings.view}
        onViewChange={(view) => setBucketView(bucketKey, view)}
        sort={browserSettings.sort}
        onSortChange={(sort) => setBucketSort(bucketKey, sort)}
        filters={browserSettings.filters}
        onFiltersChange={(filters) => setBucketFilters(bucketKey, filters)}
        showFileExtensions={showFileExtensions}
        className="min-h-0 flex-1 rounded-none border-0"
        defaultPath={currentPath}
        loadChildren={loadChildren}
        getFileUrl={getFileUrl}
        onCreateFolder={async (path) => {
          await createFolder(path)
          refresh()
          setRefreshNonce((nonce) => nonce + 1)
        }}
        onPathChange={(path) =>
          setFolder({ connId: activeConnection.id, path })
        }
        onFileOpen={(file, url) => setOpened({ file, url })}
      />

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-primary/5 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/80 px-8 py-6 text-center shadow-sm">
            <AppIcon icon={Upload01Icon} className="size-7 text-primary" />
            <p className="text-sm font-medium">Drop files to upload</p>
            <p className="text-xs text-muted-foreground">
              {currentPath ? `to ${currentPath}` : "to the bucket root"}
            </p>
          </div>
        </div>
      ) : null}

      <FileViewerDialog
        file={opened?.file ?? null}
        url={opened?.url ?? null}
        open={opened !== null}
        onOpenChange={(next) => {
          if (!next) setOpened(null)
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            enqueue(Array.from(e.target.files), currentPath)
          }
          e.target.value = ""
        }}
      />

      <UploadProgressPanel
        tasks={tasks}
        activeCount={activeCount}
        onDismiss={dismiss}
        onClear={clearFinished}
      />
    </div>
  )
}
