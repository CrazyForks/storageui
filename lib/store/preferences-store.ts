"use client"

// App-level UI preferences persisted in the browser, separate from connection
// state so the two can hydrate and version independently.
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

const STORE_NAME = "filesystem.preferences-store"
const STORE_VERSION = 1

export type TimeFormat = "12h" | "24h"

type PersistedPreferencesState = {
  showImagePreviews: boolean
  showFileExtensions: boolean
  timeFormat: TimeFormat
}

type PreferencesStore = PersistedPreferencesState & {
  setShowImagePreviews: (value: boolean) => void
  setShowFileExtensions: (value: boolean) => void
  setTimeFormat: (value: TimeFormat) => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      showImagePreviews: true,
      showFileExtensions: true,
      timeFormat: "12h",
      setShowImagePreviews: (value) => set({ showImagePreviews: value }),
      setShowFileExtensions: (value) => set({ showFileExtensions: value }),
      setTimeFormat: (value) => set({ timeFormat: value }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (state): PersistedPreferencesState => ({
        showImagePreviews: state.showImagePreviews,
        showFileExtensions: state.showFileExtensions,
        timeFormat: state.timeFormat,
      }),
    }
  )
)
