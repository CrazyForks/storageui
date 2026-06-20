"use client"

import * as React from "react"

import {
  AppIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  File01Icon,
} from "@/lib/icons"
import type { UploadTask } from "@/lib/use-uploads"
import { cn } from "@/lib/utils"

export function UploadProgressPanel({
  tasks,
  activeCount,
  onDismissAction,
  onClearAction,
}: {
  tasks: UploadTask[]
  activeCount: number
  onDismissAction: (id: string) => void
  onClearAction: () => void
}) {
  if (tasks.length === 0) return null

  const allDone = activeCount === 0
  const title =
    activeCount > 0
      ? `Uploading ${activeCount} file${activeCount === 1 ? "" : "s"}…`
      : "Uploads complete"

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="truncate text-sm font-medium">{title}</span>
        <button
          type="button"
          onClick={onClearAction}
          disabled={!allDone}
          className={cn(
            "rounded-sm text-muted-foreground transition-colors hover:text-foreground",
            !allDone && "pointer-events-none opacity-40"
          )}
          aria-label="Dismiss completed uploads"
        >
          <AppIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>

      <ul className="max-h-72 overflow-y-auto p-2">
        {tasks.map((task) => {
          const pct =
            task.total > 0
              ? Math.min(100, Math.round((task.loaded / task.total) * 100))
              : task.status === "done"
                ? 100
                : 0
          return (
            <li key={task.id} className="rounded-md px-1.5 py-1.5">
              <div className="flex items-center gap-2">
                <AppIcon
                  icon={
                    task.status === "done"
                      ? CheckmarkCircle01Icon
                      : task.status === "error"
                        ? CancelCircleIcon
                        : File01Icon
                  }
                  className={cn(
                    "size-4 shrink-0",
                    task.status === "done" && "text-emerald-500",
                    task.status === "error" && "text-destructive",
                    task.status === "uploading" && "text-muted-foreground"
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {task.name}
                </span>
                {task.status === "uploading" ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {pct}%
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDismissAction(task.id)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <AppIcon icon={Cancel01Icon} className="size-3.5" />
                  </button>
                )}
              </div>
              {task.status === "uploading" ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
              {task.status === "error" && task.error ? (
                <p className="mt-1 pl-6 text-xs text-destructive">
                  {task.error}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
