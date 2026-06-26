"use client"

// App-level UI preferences persisted in the browser, separate from connection
// state so the two can hydrate and version independently.
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

const STORE_NAME = "filesystem.preferences-store"
const STORE_VERSION = 1

export type TimeFormat = "12h" | "24h"

type PersistedPreferencesState = {
  showFileExtensions: boolean
  timeFormat: TimeFormat
}

type PreferencesStore = PersistedPreferencesState & {
  setShowFileExtensions: (value: boolean) => void
  setTimeFormat: (value: TimeFormat) => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      showFileExtensions: true,
      timeFormat: "12h",
      setShowFileExtensions: (value) => set({ showFileExtensions: value }),
      setTimeFormat: (value) => set({ timeFormat: value }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (state): PersistedPreferencesState => ({
        showFileExtensions: state.showFileExtensions,
        timeFormat: state.timeFormat,
      }),
    }
  )
)
