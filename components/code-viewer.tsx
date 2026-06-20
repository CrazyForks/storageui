"use client"

import * as React from "react"
import { LanguageDescription } from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import { EditorState, type Extension } from "@codemirror/state"
import { basicSetup, EditorView } from "codemirror"
import { useTheme } from "next-themes"

import { Spinner } from "@/components/ui/spinner"

const MAX_BYTES = 5_000_000 // Don't try to render absurdly large blobs.

const baseTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
    fontSize: "13px",
  },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
})

const darkTheme = EditorView.theme(
  {
    "&": { color: "#e6e6e6" },
    ".cm-gutters": { color: "#6b7280" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
      { backgroundColor: "rgba(120,170,255,0.18)" },
    ".cm-cursor": { borderLeftColor: "#e6e6e6" },
  },
  { dark: true }
)

async function languageExtension(fileName: string): Promise<Extension[]> {
  const description = LanguageDescription.matchFilename(languages, fileName)
  if (!description) return []
  try {
    const support = await description.load()
    return [support]
  } catch {
    return []
  }
}

export function CodeViewer({
  url,
  fileName,
}: {
  url: string
  fileName: string
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [text, setText] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const hostRef = React.useRef<HTMLDivElement>(null)
  const viewRef = React.useRef<EditorView | null>(null)

  // Fetch the file's contents once per url.
  React.useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)

    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        const size = Number(response.headers.get("content-length") ?? "0")
        if (size > MAX_BYTES) {
          throw new Error("File is too large to preview. Download it instead.")
        }
        const body = await response.text()
        if (!cancelled) setText(body)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Failed to load file")
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [url])

  // (Re)build the editor when the text or theme changes.
  React.useEffect(() => {
    if (text === null || !hostRef.current) return

    let cancelled = false
    const host = hostRef.current

    void (async () => {
      const langExt = await languageExtension(fileName)
      if (cancelled) return

      viewRef.current?.destroy()
      viewRef.current = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: text,
          extensions: [
            basicSetup,
            EditorView.editable.of(false),
            EditorState.readOnly.of(true),
            EditorView.lineWrapping,
            baseTheme,
            ...(isDark ? [darkTheme] : []),
            ...langExt,
          ],
        }),
      })
    })()

    return () => {
      cancelled = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [text, isDark, fileName])

  return (
    <div className="relative h-full min-h-0">
      {error ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : text === null ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div ref={hostRef} className="h-full overflow-hidden" />
      )}
    </div>
  )
}
