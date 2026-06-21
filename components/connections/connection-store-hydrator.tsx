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
    // `setEnvConnections` is what completes hydration, so local + env
    // connections reveal together rather than the env ones popping in later.
    const loadEnvConnections = () => {
      listEnvConnectionsAction()
        .then((envConnections) => {
          useConnectionStore.getState().setEnvConnections(envConnections)
        })
        .catch(() => {
          // The action failed — fall back to no env connections so the default
          // active selection (a local connection) is still applied, and
          // hydration still completes. The "Add connection" flow keeps working.
          useConnectionStore.getState().setEnvConnections([])
        })
    }
    // Run after rehydration whether it resolves or rejects, so the UI never
    // sticks on its pre-hydration loading state.
    void Promise.resolve(useConnectionStore.persist.rehydrate()).then(
      loadEnvConnections,
      loadEnvConnections
    )

    void usePreferencesStore.persist.rehydrate()
    void useBucketBrowserStore.persist.rehydrate()
    void useFileMarksStore.persist.rehydrate()
  }, [])

  return children
}
