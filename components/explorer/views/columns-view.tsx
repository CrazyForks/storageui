"use client"

import * as React from "react"

import { AppIcon, ArrowRight01Icon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollAreaPrimitive } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  fileKindLabel,
  filePreviewUrls,
  FileSystemFolderGlyph,
  FileTypeIcon,
  FileVisual,
  folderHasChildren,
  formatByteSize,
  formatTimestamp,
  InlineRenameName,
  pathParent,
  RenameContext,
  scrollIndexIntoView,
  useFormatEntryName,
  useVirtualWindow,
} from "@/components/explorer/internals"
import type {
  FileEntry,
  FileSystemEntry,
  FileSystemIndex,
  FileSystemViewProps,
} from "@/components/explorer/types"
import {
  ARROW_KEYS,
  useEntryTypeAhead,
} from "@/components/explorer/views/shared"

export function FileSystemColumnsView(props: FileSystemViewProps) {
  const {
    currentPath,
    index,
    loadPreviewImageUrl,
    loadingFolders,
    onOpen,
    onSelect,
    pageUrlCache,
    renderFilePreview,
    selectedEntry,
    selectedPath,
  } = props
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const rowRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const formatName = useFormatEntryName()

  // The selection highlight tracks every keypress; mounting the trailing
  // child column and the preview pane is deferred so holding an arrow key
  // doesn't pay that DOM churn per step.
  const deferredSelectedEntry = React.useDeferredValue(selectedEntry)
  const deferredSelectedPath = React.useDeferredValue(selectedPath)
  const pendingFocusPathRef = React.useRef<string | null>(null)
  const typeAhead = useEntryTypeAhead()

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!ARROW_KEYS.has(event.key)) {
      // Type-ahead moves within the active column's rows, like Finder.
      const siblings =
        selectedEntry && selectedPath?.startsWith(currentPath)
          ? (index.children.get(selectedEntry.parentPath) ?? [])
          : (index.children.get(currentPath) ?? [])
      const match = typeAhead(
        event,
        siblings,
        siblings.findIndex((sibling) => sibling.path === selectedPath)
      )

      if (match) {
        onSelect(match)

        const row = rowRefs.current.get(match.path)

        if (row) {
          row.focus()
        } else {
          pendingFocusPathRef.current = match.path
        }
      }
      return
    }

    let nextEntry: FileSystemEntry | null | undefined

    if (!selectedEntry || !selectedPath?.startsWith(currentPath)) {
      nextEntry = index.children.get(currentPath)?.[0]
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const siblings = index.children.get(selectedEntry.parentPath) ?? []
      const currentIndex = siblings.findIndex(
        (sibling) => sibling.path === selectedEntry.path
      )

      nextEntry = siblings[currentIndex + (event.key === "ArrowUp" ? -1 : 1)]
    } else if (event.key === "ArrowLeft") {
      if (selectedEntry.parentPath !== currentPath) {
        nextEntry = index.folders.get(selectedEntry.parentPath)
      }
    } else if (selectedEntry.kind === "folder") {
      nextEntry = index.children.get(selectedEntry.path)?.[0]
    }

    if (!nextEntry) return

    onSelect(nextEntry)

    const row = rowRefs.current.get(nextEntry.path)

    if (row) {
      pendingFocusPathRef.current = null
      row.focus()
    } else {
      // The target row lives in a deferred column that hasn't mounted yet;
      // focus it from the effect below once it exists.
      pendingFocusPathRef.current = nextEntry.path
    }
    event.preventDefault()
  }

  React.useEffect(() => {
    const path = pendingFocusPathRef.current

    if (!path) return

    const row = rowRefs.current.get(path)

    if (row) {
      pendingFocusPathRef.current = null
      row.focus()
    }
  })

  const columnPaths = React.useMemo(() => {
    const paths = [currentPath]

    if (!deferredSelectedPath?.startsWith(currentPath)) return paths

    const targetFolder =
      deferredSelectedEntry?.kind === "folder"
        ? deferredSelectedEntry.path
        : (deferredSelectedEntry?.parentPath ?? currentPath)
    const relativePath = targetFolder.slice(currentPath.length)
    let walkedPath = currentPath

    for (const segment of relativePath.split("/")) {
      if (!segment) continue
      walkedPath = `${walkedPath}${segment}/`
      paths.push(walkedPath)
    }
    return paths
  }, [currentPath, deferredSelectedEntry, deferredSelectedPath])
  // Roving tabindex: all columns together form a single tab stop (the
  // selected row when its column is mounted, else the first row), so
  // Shift+Tab returns to the toolbar like in the list view.
  const tabStopPath = React.useMemo(() => {
    if (selectedPath) {
      for (const columnPath of columnPaths) {
        if (
          index.children
            .get(columnPath)
            ?.some((entry) => entry.path === selectedPath)
        ) {
          return selectedPath
        }
      }
    }
    return index.children.get(columnPaths[0] ?? "")?.[0]?.path ?? null
  }, [columnPaths, index, selectedPath])
  const selectedFile =
    deferredSelectedEntry?.kind === "file"
      ? (deferredSelectedEntry as FileEntry)
      : null
  const selectedFileSize = selectedFile
    ? formatByteSize(selectedFile.size)
    : null

  React.useEffect(() => {
    const container = scrollContainerRef.current

    if (container) container.scrollLeft = container.scrollWidth
  }, [columnPaths.length, deferredSelectedPath])

  return (
    <ScrollArea
      orientation="horizontal"
      viewportRef={scrollContainerRef}
      viewportClassName="overscroll-x-contain"
    >
      {/* The Content part's ResizeObserver tells the scroll area when the
          trail shrinks (deselect, shallower selection) so the horizontal
          scrollbar hides; the viewport alone only observes its own box. Its
          built-in inline min-width (fit-content) would beat a min-w-full
          class, so the full-width floor is inline too. */}
      <ScrollAreaPrimitive.Content
        className="flex h-full w-max"
        style={{ minWidth: "100%" }}
        onKeyDown={handleKeyDown}
      >
        {columnPaths.map((columnPath, columnIndex) => (
          <FileSystemColumn
            key={columnPath || "(root)"}
            entries={index.children.get(columnPath) ?? []}
            index={index}
            isLoading={loadingFolders.has(columnPath)}
            onOpen={onOpen}
            onSelect={onSelect}
            rowRefs={rowRefs}
            // Scalar per-column props so the memoized column only
            // re-renders when its own rows change — a selection deeper in
            // the trail leaves ancestor columns untouched.
            selectedChildPath={
              selectedPath && pathParent(selectedPath) === columnPath
                ? selectedPath
                : null
            }
            tabStopChildPath={
              tabStopPath && pathParent(tabStopPath) === columnPath
                ? tabStopPath
                : null
            }
            trailChildPath={columnPaths[columnIndex + 1] ?? null}
          />
        ))}
        {selectedFile ? (
          // contain-inline-size zeroes the pane's intrinsic width so its
          // max-content contribution is exactly the min-w-60 floor — matching
          // a column's w-60. Otherwise long filenames or wide thumbnails
          // would nudge the overflowing trail's scroll width as the arrow-key
          // selection alternates between files and folders.
          <ScrollArea
            orientation="vertical"
            className="min-w-60 flex-1 contain-inline-size"
            viewportClassName="flex justify-center p-4"
          >
            <div className="flex w-full max-w-lg flex-col items-stretch gap-3">
              {/* Width derives from the aspect ratio so the thumbnail grows
                  with the pane up to a 20rem height cap. */}
              <div
                className="mx-auto w-full shrink-0"
                style={{
                  maxWidth: `min(100%, ${(selectedFile.previewAspectRatio ?? 0.78) * 20}rem)`,
                }}
              >
                <FileVisual
                  file={selectedFile}
                  className="w-full"
                  loadPreviewImageUrl={loadPreviewImageUrl}
                  pageable
                  pageUrlCache={pageUrlCache}
                  previewAspectRatio={0.78}
                  renderFilePreview={renderFilePreview}
                />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold break-words">
                  {formatName(selectedFile)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fileKindLabel(selectedFile)}
                  {selectedFileSize ? ` - ${selectedFileSize}` : null}
                </div>
              </div>
              <FileSystemInformation entry={selectedFile} index={index} />
            </div>
          </ScrollArea>
        ) : null}
      </ScrollAreaPrimitive.Content>
    </ScrollArea>
  )
}

// Column row geometry (px at the default 16px root font size).
export const COLUMN_PADDING = 6 // p-1.5
export const COLUMN_ROW_HEIGHT = 28 // h-7
export const COLUMN_ROW_GAP = 1 // gap-px
export const COLUMN_ROW_STRIDE = COLUMN_ROW_HEIGHT + COLUMN_ROW_GAP

// Memoized with scalar selection props: pressing into a deep trail only
// re-renders the columns whose rows actually change.
export const FileSystemColumn = React.memo(function FileSystemColumn({
  entries,
  index,
  isLoading,
  onOpen,
  onSelect,
  rowRefs,
  selectedChildPath,
  tabStopChildPath,
  trailChildPath,
}: {
  entries: FileSystemEntry[]
  index: FileSystemIndex
  isLoading: boolean
  onOpen: (entry: FileSystemEntry) => void
  onSelect: (entry: FileSystemEntry | null) => void
  rowRefs: React.RefObject<Map<string, HTMLButtonElement>>
  selectedChildPath: string | null
  tabStopChildPath: string | null
  trailChildPath: string | null
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const formatName = useFormatEntryName()
  const rename = React.useContext(RenameContext)
  const { end, start } = useVirtualWindow({
    count: entries.length,
    itemStride: COLUMN_ROW_STRIDE,
    leadingPx: COLUMN_PADDING,
    overscan: 10,
    viewportRef,
  })

  // Keyboard navigation can select a row this column hasn't mounted; scroll
  // it into the viewport so it mounts and the pending-focus effect can land.
  React.useLayoutEffect(() => {
    if (!selectedChildPath) return

    scrollIndexIntoView({
      index: entries.findIndex((entry) => entry.path === selectedChildPath),
      itemSize: COLUMN_ROW_HEIGHT,
      itemStride: COLUMN_ROW_STRIDE,
      leadingPx: COLUMN_PADDING,
      viewport: viewportRef.current,
    })
  }, [entries, selectedChildPath])

  return (
    <ScrollArea
      orientation="vertical"
      className="w-60 shrink-0 border-r"
      viewportRef={viewportRef}
      viewportClassName="p-1.5"
      viewportProps={{ "aria-label": "Files", role: "listbox" }}
    >
      {isLoading && entries.length === 0 ? (
        <div className="animate-pulse px-2 py-1.5 text-xs text-muted-foreground motion-reduce:animate-none">
          Loading…
        </div>
      ) : (
        <div
          className="relative"
          style={{
            height: entries.length
              ? entries.length * COLUMN_ROW_STRIDE - COLUMN_ROW_GAP
              : undefined,
          }}
        >
          <div
            className="absolute inset-x-0 flex flex-col gap-px"
            style={{ top: start * COLUMN_ROW_STRIDE }}
          >
            {entries.slice(start, end).map((entry) => {
              const isSelected = entry.path === selectedChildPath
              const isOnTrail =
                entry.kind === "folder" && entry.path === trailChildPath

              const coverUrl =
                entry.kind === "file" ? filePreviewUrls(entry)[0] : undefined
              const isRenaming = rename?.targetPath === entry.path
              const isSaving = rename?.pendingPaths.has(entry.path) ?? false

              const rowIcon =
                entry.kind === "folder" ? (
                  <FileSystemFolderGlyph className="h-3.5 w-auto shrink-0" />
                ) : coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    draggable={false}
                    className="size-4 shrink-0 rounded-[3px] bg-white object-cover"
                  />
                ) : (
                  <FileTypeIcon
                    fileName={entry.name}
                    className="size-4 shrink-0"
                  />
                )

              // The row is a <button>, which can't contain an <input>; while
              // renaming, render a plain container with the inline editor.
              if (isRenaming) {
                return (
                  <div
                    key={entry.path}
                    className="flex h-7 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-sm"
                  >
                    {rowIcon}
                    <InlineRenameName
                      entry={entry}
                      className="min-w-0 flex-1 text-sm"
                    >
                      {formatName(entry)}
                    </InlineRenameName>
                  </div>
                )
              }

              return (
                <button
                  key={entry.path}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  // Selected rows sit on the primary surface — the opposite
                  // of the mode's background — so the file-type icon swaps
                  // to the opposite palette.
                  data-file-system-path={entry.path}
                  data-file-system-on-primary={isSelected ? "" : undefined}
                  tabIndex={entry.path === tabStopChildPath ? 0 : -1}
                  ref={(element) => {
                    if (element) {
                      rowRefs.current.set(entry.path, element)
                    } else {
                      rowRefs.current.delete(entry.path)
                    }
                  }}
                  // Selecting on press (mouse only) starts mounting the
                  // child column a beat before mouseup — the immediacy
                  // @pierre/trees rows have. Touch keeps selection on the
                  // click so scroll gestures don't select.
                  onPointerDown={(event) => {
                    if (event.pointerType === "mouse" && event.button === 0) {
                      onSelect(entry)
                    }
                  }}
                  onClick={() => onSelect(entry)}
                  onDoubleClick={() => onOpen(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpen(entry)
                  }}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isOnTrail
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                  )}
                >
                  {rowIcon}
                  <span className="min-w-0 flex-1 truncate">
                    {formatName(entry)}
                  </span>
                  {isSaving ? (
                    <Spinner
                      className={cn(
                        "size-3.5 shrink-0",
                        !isSelected && "text-muted-foreground"
                      )}
                    />
                  ) : entry.kind === "folder" &&
                    folderHasChildren(index, entry) ? (
                    <AppIcon
                      icon={ArrowRight01Icon}
                      className={cn(
                        "size-3.5 shrink-0",
                        !isSelected && "text-muted-foreground/60"
                      )}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </ScrollArea>
  )
})

export function FileSystemInformation({
  entry,
  index,
}: {
  entry: FileSystemEntry
  index: FileSystemIndex
}) {
  const rows: Array<[string, string]> = []
  const created = formatTimestamp(entry.createdAt)
  const updated = formatTimestamp(entry.updatedAt)

  if (created) rows.push(["Created", created])
  if (updated) rows.push(["Modified", updated])
  if (entry.kind === "file") {
    const size = formatByteSize(entry.size)

    if (size) rows.push(["Size", size])
  } else {
    const childCount = index.children.get(entry.path)?.length

    if (childCount !== undefined) {
      rows.push(["Items", `${childCount}`])
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="border-t pt-3">
      <div className="mb-1.5 text-xs font-semibold">Information</div>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="text-right" suppressHydrationWarning>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// Filmstrip geometry (px at the default 16px root font size).
