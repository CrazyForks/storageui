"use client"

import * as React from "react"

import { useBucketBrowserStore } from "@/lib/store/bucket-browser-store"
import {
  migrateLegacyConnectionStorage,
  useConnectionStore,
} from "@/lib/store/connection-store"
import { useFileMarksStore } from "@/lib/store/file-marks-store"
import { usePreferencesStore } from "@/lib/store/preferences-store"

export function ConnectionStoreHydrator({
  children,
}: {
  children: React.ReactNode
}) {
  React.useEffect(() => {
    migrateLegacyConnectionStorage()
    void useConnectionStore.persist.rehydrate()
    void usePreferencesStore.persist.rehydrate()
    void useBucketBrowserStore.persist.rehydrate()
    void useFileMarksStore.persist.rehydrate()
  }, [])

  return children
}
