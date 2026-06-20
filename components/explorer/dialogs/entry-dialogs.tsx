"use client"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FileSystemEntry } from "@/components/explorer/types"

export function NewFolderDialog({
  currentFolderName,
  error,
  isPending,
  name,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  currentFolderName: string
  error: string | null
  isPending: boolean
  name: string
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  open: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onSubmit()
              }}
            >
              <Input
                autoFocus
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
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
              onClick={() => onOpenChange(false)}
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

export function MoveEntriesDialog({
  destination,
  destinations,
  error,
  isPending,
  onDestinationChange,
  onOpenChange,
  onSubmit,
  targets,
}: {
  destination: string
  destinations: Array<{ label: string; value: string }>
  error: string | null
  isPending: boolean
  onDestinationChange: (destination: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  targets: FileSystemEntry[]
}) {
  const open = targets.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {targets.length > 1
                ? `Move ${targets.length} items`
                : `Move ${targets[0].kind === "folder" ? "Folder" : "File"}`}
            </DialogTitle>
            <DialogDescription>
              {targets.length > 1
                ? `Choose a destination folder for these ${targets.length} items.`
                : `Choose a destination folder for “${targets[0].name}”.`}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <form
              id="move-entry-form"
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
            >
              <Select
                value={destination}
                onValueChange={(value) => onDestinationChange(String(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="move-entry-form"
              loading={isPending}
              disabled={targets.every(
                (target) => target.parentPath === destination
              )}
            >
              Move
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
  onOpenChange,
  onSubmit,
  targets,
}: {
  error: string | null
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  targets: FileSystemEntry[]
}) {
  const open = targets.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {error ? (
            <DialogPanel>
              <p className="text-sm text-destructive">{error}</p>
            </DialogPanel>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={onSubmit}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
