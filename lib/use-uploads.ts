"use client"

import * as React from "react"

import type { UploadProgress } from "@/lib/use-s3-file-system"

export type UploadTaskStatus = "uploading" | "done" | "error"

export type UploadTask = {
  id: string
  name: string
  key: string
  status: UploadTaskStatus
  loaded: number
  total: number
  error?: string
}

/** Normalize a user-typed destination into a key prefix (no leading slash, trailing slash). */
export function normalizePrefix(input: string): string {
  const trimmed = input.trim().replace(/^\/+/, "")
  if (!trimmed) return ""
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

let counter = 0
function nextId() {
  counter += 1
  return `upload-${counter}`
}

type UploadFn = (
  key: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
) => Promise<void>

/**
 * Manages a queue of browser-direct uploads with per-file progress. Surfaces
 * tasks for a floating progress panel; calls `onBatchComplete` after a batch
 * finishes with at least one success (so the caller can refresh the listing).
 */
export function useUploads({
  uploadFile,
  onBatchComplete,
}: {
  uploadFile: UploadFn
  onBatchComplete?: () => void
}) {
  const [tasks, setTasks] = React.useState<UploadTask[]>([])

  const uploadFileRef = React.useRef(uploadFile)
  uploadFileRef.current = uploadFile
  const onBatchCompleteRef = React.useRef(onBatchComplete)
  onBatchCompleteRef.current = onBatchComplete

  const enqueue = React.useCallback((files: File[], prefix: string) => {
    if (files.length === 0) return
    const dest = normalizePrefix(prefix)
    const entries = files.map((file) => ({
      id: nextId(),
      file,
      key: `${dest}${file.name}`,
    }))

    setTasks((prev) => [
      ...prev,
      ...entries.map((e) => ({
        id: e.id,
        name: e.file.name,
        key: e.key,
        status: "uploading" as UploadTaskStatus,
        loaded: 0,
        total: e.file.size,
      })),
    ])

    void (async () => {
      let successes = 0
      for (const e of entries) {
        try {
          await uploadFileRef.current(e.key, e.file, ({ loaded, total }) => {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === e.id ? { ...t, loaded, total: total ?? t.total } : t
              )
            )
          })
          successes += 1
          setTasks((prev) =>
            prev.map((t) =>
              t.id === e.id ? { ...t, status: "done", loaded: t.total } : t
            )
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          setTasks((prev) =>
            prev.map((t) =>
              t.id === e.id ? { ...t, status: "error", error: message } : t
            )
          )
        }
      }
      if (successes > 0) onBatchCompleteRef.current?.()
    })()
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /** Remove finished tasks; if any are still uploading they stay. */
  const clearFinished = React.useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === "uploading"))
  }, [])

  const activeCount = tasks.filter((t) => t.status === "uploading").length

  return { tasks, enqueue, dismiss, clearFinished, activeCount }
}
