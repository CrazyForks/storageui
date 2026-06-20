"use client"

// Ephemeral UI state for the upload dialog, shared between the sidebar (which
// owns the trigger) and the file browser (which owns the dialog + queue). Not
// persisted — it's transient, unlike the other stores in this folder.
import { create } from "zustand"

type UploadUiStore = {
  isUploadOpen: boolean
  setUploadOpen: (open: boolean) => void
}

export const useUploadUiStore = create<UploadUiStore>((set) => ({
  isUploadOpen: false,
  setUploadOpen: (open) => set({ isUploadOpen: open }),
}))
