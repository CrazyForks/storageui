"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  FileSystemFolderGlyph,
  FileVisual,
  InlineRenameName,
  RenameContext,
  scrollIndexIntoView,
  useFormatEntryName,
  useVirtualWindow,
} from "@/components/explorer/internals"
import type { FileSystemViewProps } from "@/components/explorer/types"
import {
  ARROW_KEYS,
  ICON_GRID_PADDING,
  ICON_MIN_TILE_WIDTH,
  ICON_ROW_GAP,
  ICON_ROW_STRIDE,
  ICON_TILE_GAP_X,
  ICON_TILE_HEIGHT,
  moveGridSelection,
  useEntryTypeAhead,
} from "@/components/explorer/views/shared"

export function FileSystemIconsView({
  entries,
  onOpen,
  onSelect,
  renderFilePreview,
  selectedPath,
  selectedPaths,
}: FileSystemViewProps) {
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const typeAhead = useEntryTypeAhead()
  const formatName = useFormatEntryName()
  const rename = React.useContext(RenameContext)
  // The column count mirrors what `repeat(auto-fill, minmax(6.5rem, 1fr))`
  // produces (the CSS owns the actual layout) so item indices map to grid
  // rows — the windowing below depends on that mapping. It stays null until
  // the first client measure; server markup must not guess.
  const [columnCount, setColumnCount] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (!viewport || typeof ResizeObserver === "undefined") return

    const update = () => {
      const available = viewport.clientWidth - ICON_GRID_PADDING * 2

      setColumnCount(
        Math.max(
          1,
          Math.floor(
            (available + ICON_TILE_GAP_X) /
              (ICON_MIN_TILE_WIDTH + ICON_TILE_GAP_X)
          )
        )
      )
    }
    const observer = new ResizeObserver(update)

    update()
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const resolvedColumnCount = columnCount ?? 1
  const rowCount = Math.ceil(entries.length / resolvedColumnCount)
  const { end, start } = useVirtualWindow({
    count: rowCount,
    itemStride: ICON_ROW_STRIDE,
    leadingPx: ICON_GRID_PADDING,
    overscan: 4,
    viewportRef,
  })
  const visibleEntries = entries.slice(
    start * resolvedColumnCount,
    end * resolvedColumnCount
  )

  // Selection can land outside the window (view switches, shrinking results);
  // bring its row back into the viewport so the tile mounts and is focusable.
  React.useLayoutEffect(() => {
    if (!selectedPath) return

    const entryIndex = entries.findIndex((entry) => entry.path === selectedPath)

    if (entryIndex === -1) return

    scrollIndexIntoView({
      index: Math.floor(entryIndex / resolvedColumnCount),
      itemSize: ICON_TILE_HEIGHT,
      itemStride: ICON_ROW_STRIDE,
      leadingPx: ICON_GRID_PADDING,
      viewport: viewportRef.current,
    })
  }, [entries, resolvedColumnCount, selectedPath])

  // Roving tabindex: the grid is a single tab stop (the selected tile when
  // rendered, else the first rendered one), so Shift+Tab returns to the
  // toolbar like in the list view.
  const tabStopPath = visibleEntries.some(
    (entry) => entry.path === selectedPath
  )
    ? selectedPath
    : (visibleEntries[0]?.path ?? null)

  return (
    <ScrollArea
      orientation="vertical"
      viewportRef={viewportRef}
      viewportClassName="p-3"
      viewportProps={{
        onClick: (event) => {
          if (event.target === event.currentTarget) onSelect(null)
        },
      }}
    >
      <div
        className="relative"
        // The scroll-height spacer needs the measured column count; until
        // then the absolutely positioned grid alone defines the scrollable
        // overflow, so the server-rendered frame doesn't flash an
        // oversized scroll range.
        style={{
          height:
            columnCount !== null && rowCount
              ? rowCount * ICON_ROW_STRIDE - ICON_ROW_GAP
              : undefined,
        }}
      >
        <div
          role="listbox"
          aria-label="Files"
          className="absolute inset-x-0 grid gap-x-1 gap-y-3"
          // The auto-fill expression produces the same column count the
          // ResizeObserver measures (the measurement exists only for the
          // windowing math), so the server-rendered first paint is already
          // a grid instead of flashing a single stacked column until the
          // first client measure.
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(6.5rem, 1fr))",
            top: start * ICON_ROW_STRIDE,
          }}
          onKeyDown={(event) => {
            if (!ARROW_KEYS.has(event.key)) {
              const match = typeAhead(
                event,
                entries,
                entries.findIndex((entry) => entry.path === selectedPath)
              )

              if (match) {
                onSelect(match)
                // The matched tile may be outside the virtual window; the
                // selection effect scrolls it in, and focus follows once it
                // has mounted.
                requestAnimationFrame(() =>
                  itemRefs.current.get(match.path)?.focus()
                )
              }
              return
            }
            if (
              moveGridSelection({
                entries,
                itemRefs: itemRefs.current,
                key: event.key,
                onSelect,
                selectedPath,
              })
            ) {
              event.preventDefault()
            }
          }}
        >
          {visibleEntries.map((entry) => {
            const isSelected = selectedPaths.has(entry.path)
            const isRenaming = rename?.targetPath === entry.path
            const isSaving = rename?.pendingPaths.has(entry.path) ?? false

            const glyph = (
              <span
                className={cn(
                  "relative flex h-16 w-20 shrink-0 items-center justify-center rounded-lg p-1 transition-colors",
                  isSelected && "bg-accent"
                )}
              >
                {entry.kind === "folder" ? (
                  <FileSystemFolderGlyph className="h-13 w-auto drop-shadow-sm" />
                ) : (
                  <FileVisual
                    file={entry}
                    className={cn(
                      "rounded-sm shadow-xs",
                      // Landscape thumbnails get extra width so they fill
                      // the tile instead of rendering as a short sliver.
                      (entry.previewAspectRatio ?? 0.78) > 1.2
                        ? "w-[4.75rem]"
                        : "w-12"
                    )}
                    previewAspectRatio={0.78}
                    renderFilePreview={renderFilePreview}
                  />
                )}
                {isSaving ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                    <Spinner className="size-5 text-muted-foreground" />
                  </span>
                ) : null}
              </span>
            )

            // The tile is a <button>, which can't contain an <input>; while
            // renaming, render a plain container with the inline editor.
            if (isRenaming) {
              return (
                <div
                  key={entry.path}
                  className="flex h-[6.375rem] flex-col items-center gap-1.5"
                >
                  {glyph}
                  <InlineRenameName
                    entry={entry}
                    multiline
                    className="w-20 text-center text-xs leading-tight"
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
                data-file-system-path={entry.path}
                tabIndex={entry.path === tabStopPath ? 0 : -1}
                ref={(element) => {
                  if (element) {
                    itemRefs.current.set(entry.path, element)
                  } else {
                    itemRefs.current.delete(entry.path)
                  }
                }}
                onClick={(event) =>
                  onSelect(entry, {
                    toggle: event.metaKey || event.ctrlKey,
                    range: event.shiftKey,
                  })
                }
                onDoubleClick={() => onOpen(entry)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(entry)
                }}
                className="group flex h-[6.375rem] flex-col items-center gap-1.5 outline-none"
              >
                {glyph}
                <span
                  className={cn(
                    "max-w-full rounded-sm px-1.5 py-px text-center text-xs leading-tight wrap-break-word",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  <span className="line-clamp-2">{formatName(entry)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}

// One sortable column header for the list view; the active column shows the
// direction chevron on its right.
