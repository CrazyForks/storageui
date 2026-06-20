"use client"

import * as React from "react"

import { useBucketBrowserStore } from "@/lib/store/bucket-browser-store"
import {
  migrateLegacyConnectionStorage,
  useConnectionStore,
} from "@/lib/store/connection-store"
import { useFileMarksStore } from "@/lib/store/file-marks-store"
import { usePreferencesStore } from "@/lib/store/preferences-store"
import { listEnvConnectionsAction } from "@/app/actions/files"

export function ConnectionStoreHydrator({
  children,
}: {
  children: React.ReactNode
}) {
  React.useEffect(() => {
    migrateLegacyConnectionStorage()

    // Rehydrate local connections first, then merge in the env connections the
    // server resolves (their credentials never reach the browser).
    void Promise.resolve(useConnectionStore.persist.rehydrate()).then(() => {
      listEnvConnectionsAction()
        .then((envConnections) => {
          useConnectionStore.getState().setEnvConnections(envConnections)
        })
        .catch(() => {
          // No env connections (or the action failed) — local connections and
          // the "Add connection" flow still work.
        })
    })

    void usePreferencesStore.persist.rehydrate()
    void useBucketBrowserStore.persist.rehydrate()
    void useFileMarksStore.persist.rehydrate()
  }, [])

  return children
}
