"use client"

// App-level UI preferences persisted in the browser, separate from connection
// state so the two can hydrate and version independently.
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

const STORE_NAME = "filesystem.preferences-store"
const STORE_VERSION = 1

type PersistedPreferencesState = {
  showFileExtensions: boolean
}

type PreferencesStore = PersistedPreferencesState & {
  setShowFileExtensions: (value: boolean) => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      showFileExtensions: true,
      setShowFileExtensions: (value) => set({ showFileExtensions: value }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (state): PersistedPreferencesState => ({
        showFileExtensions: state.showFileExtensions,
      }),
    }
  )
)
