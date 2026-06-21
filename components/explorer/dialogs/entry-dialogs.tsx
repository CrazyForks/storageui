"use client"

import * as React from "react"

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
import { FileSystemFolderGlyph } from "@/components/explorer/internals"
import type {
  FileSystemEntry,
  FileSystemIndex,
} from "@/components/explorer/types"
import { AppIcon, ArrowRight01Icon } from "@/components/foundations/icons"

type BulkProgress = { done: number; total: number }

function BulkProgressBar({
  verb,
  progress,
}: {
  verb: string
  progress: BulkProgress
}) {
  const percent = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {verb} {progress.done} of {progress.total}…
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function NewFolderDialog({
  currentFolderName,
  error,
  isPending,
  name,
  onNameChangeAction,
  onOpenChangeAction,
  onSubmitAction,
  open,
}: {
  currentFolderName: string
  error: string | null
  isPending: boolean
  name: string
  onNameChangeAction: (name: string) => void
  onOpenChangeAction: (open: boolean) => void
  onSubmitAction: () => void
  open: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      {open ? (
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a folder in {currentFolderName}.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <form
              id="new-folder-form"
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmitAction()
              }}
            >
              <Input
                autoFocus
                value={name}
                onChange={(event) => onNameChangeAction(event.target.value)}
                placeholder="Untitled Folder"
                aria-invalid={error ? true : undefined}
              />
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </form>
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChangeAction(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="new-folder-form"
              loading={isPending}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

// Trailing-slash path → display segments and per-segment absolute paths.
function pathSegments(folderPath: string) {
  const trimmed = folderPath.replace(/\/$/, "")
  if (!trimmed) return [] as Array<{ name: string; path: string }>
  const names = trimmed.split("/")
  return names.map((name, index) => ({
    name,
    path: `${names.slice(0, index + 1).join("/")}/`,
  }))
}

export function MoveEntriesDialog({
  error,
  isPending,
  progress,
  index,
  ensureChildrenAction,
  loadingFolders,
  rootLabel = "/",
  onMoveAction,
  onOpenChangeAction,
  targets,
}: {
  error: string | null
  isPending: boolean
  progress?: BulkProgress | null
  index: FileSystemIndex
  ensureChildrenAction: (folderPath: string) => void
  loadingFolders: ReadonlySet<string>
  rootLabel?: string
  onMoveAction: (destination: string) => void
  onOpenChangeAction: (open: boolean) => void
  targets: FileSystemEntry[]
}) {
  const open = targets.length > 0
  // The folder currently being browsed; "" is the bucket root.
  const [navPath, setNavPath] = React.useState("")

  // Reset to root whenever the dialog opens.
  React.useEffect(() => {
    if (open) setNavPath("")
  }, [open])

  // Lazily list the current folder's children as the user drills in.
  React.useEffect(() => {
    if (open) ensureChildrenAction(navPath)
  }, [open, navPath, ensureChildrenAction])

  // Folders being moved (and their descendants) can't be a destination.
  const movedFolderPaths = targets
    .filter((target) => target.kind === "folder")
    .map((target) => target.path)
  const isInsideMoved = movedFolderPaths.some(
    (path) => navPath === path || navPath.startsWith(path)
  )

  const subfolders = (index.children.get(navPath) ?? []).filter(
    (entry) =>
      entry.kind === "folder" &&
      !movedFolderPaths.some(
        (path) => entry.path === path || entry.path.startsWith(path)
      )
  )
  const isLoading = loadingFolders.has(navPath)
  const allAlreadyHere = targets.every(
    (target) => target.parentPath === navPath
  )
  const canMoveHere = !isPending && !isInsideMoved && !allAlreadyHere
  const segments = pathSegments(navPath)

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      {open ? (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {targets.length > 1
                ? `Move ${targets.length} items`
                : `Move ${targets[0].kind === "folder" ? "Folder" : "File"}`}
            </DialogTitle>
            <DialogDescription>
              Pick a destination folder, then move here.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-2">
            {/* Breadcrumb of the browsing path. */}
            <div className="flex flex-wrap items-center gap-0.5 text-sm">
              <button
                type="button"
                onClick={() => setNavPath("")}
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-accent",
                  navPath === "" && "text-foreground"
                )}
              >
                {rootLabel}
              </button>
              {segments.map((segment, index) => (
                <React.Fragment key={segment.path}>
                  {index > 0 || !rootLabel.endsWith("/") ? (
                    <span className="text-muted-foreground">/</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setNavPath(segment.path)}
                    className="max-w-40 truncate rounded px-1.5 py-0.5 transition-colors hover:bg-accent"
                  >
                    {segment.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Subfolder list for the current level. */}
            <div className="h-56 overflow-y-auto rounded-md border p-1">
              {isLoading && subfolders.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : subfolders.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No subfolders here.
                </div>
              ) : (
                subfolders.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() => setNavPath(folder.path)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                  >
                    <FileSystemFolderGlyph className="h-3.5 w-auto shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {folder.name}
                    </span>
                    <AppIcon
                      icon={ArrowRight01Icon}
                      className="size-3.5 shrink-0 text-muted-foreground/60"
                    />
                  </button>
                ))
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {progress ? (
              <BulkProgressBar verb="Moving" progress={progress} />
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChangeAction(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={isPending}
              disabled={!canMoveHere}
              onClick={() => onMoveAction(navPath)}
            >
              {navPath === ""
                ? `Move to ${rootLabel}`
                : `Move to “${segments[segments.length - 1]?.name}”`}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function DeleteEntriesDialog({
  error,
  isPending,
  progress,
  onOpenChangeAction,
  onSubmitAction,
  targets,
}: {
  error: string | null
  isPending: boolean
  progress?: BulkProgress | null
  onOpenChangeAction: (open: boolean) => void
  onSubmitAction: () => void
  targets: FileSystemEntry[]
}) {
  const open = targets.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      {open ? (
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {targets.length > 1
                ? `Delete ${targets.length} items?`
                : `Delete ${targets[0].kind === "folder" ? "Folder" : "File"}?`}
            </DialogTitle>
            <DialogDescription>
              {targets.length > 1
                ? `These ${targets.length} items will be permanently deleted, including everything inside any folders.`
                : `“${targets[0].name}” will be permanently deleted${
                    targets[0].kind === "folder"
                      ? " along with everything inside it."
                      : "."
                  }`}
            </DialogDescription>
          </DialogHeader>
          {error || progress ? (
            <DialogPanel className="space-y-2">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              {progress ? (
                <BulkProgressBar verb="Deleting" progress={progress} />
              ) : null}
            </DialogPanel>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChangeAction(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={onSubmitAction}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
