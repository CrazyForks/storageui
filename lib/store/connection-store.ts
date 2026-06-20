"use client"

// Connection state and browser persistence live together in this store.
import * as React from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { type Connection } from "@/lib/connections"

const STORE_NAME = "filesystem.connection-store"
const STORE_VERSION = 1
const LEGACY_CONNECTIONS_KEY = "filesystem.connections"
const LEGACY_ACTIVE_CONNECTION_KEY = "filesystem.activeConnectionId"

type PersistedConnectionState = {
  connections: Connection[]
  activeConnectionId: string | null
}

type ConnectionStore = PersistedConnectionState & {
  hasHydrated: boolean
  isAddDialogOpen: boolean
  editingConnection: Connection | null
  setActiveConnection: (id: string) => void
  addConnection: (connection: Connection) => void
  updateConnection: (connection: Connection) => void
  removeConnection: (id: string) => void
  /** Inject the server-resolved (credential-free) env connections. */
  setEnvConnections: (envConnections: Connection[]) => void
  openAddDialog: () => void
  openEditDialog: (connection: Connection) => void
  setAddDialogOpen: (open: boolean) => void
  finishHydration: () => void
}

function localConnections(connections: Connection[]): Connection[] {
  return connections
    .filter((connection) => connection.source === "local")
    .map((connection) => ({ ...connection, source: "local" as const }))
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      hasHydrated: false,
      isAddDialogOpen: false,
      editingConnection: null,

      setActiveConnection: (id) =>
        set((state) =>
          state.connections.some((connection) => connection.id === id)
            ? { activeConnectionId: id }
            : state
        ),

      addConnection: (connection) => {
        const nextConnection = { ...connection, source: "local" as const }
        set((state) => ({
          connections: [
            ...state.connections.filter(
              (candidate) => candidate.id !== nextConnection.id
            ),
            nextConnection,
          ],
          activeConnectionId: nextConnection.id,
        }))
      },

      updateConnection: (connection) => {
        if (connection.source !== "local") return
        set((state) => ({
          connections: state.connections.map((candidate) =>
            candidate.id === connection.id
              ? { ...connection, source: "local" as const }
              : candidate
          ),
        }))
      },

      removeConnection: (id) =>
        set((state) => {
          const connection = state.connections.find(
            (candidate) => candidate.id === id
          )
          if (!connection || connection.source !== "local") return state

          const connections = state.connections.filter(
            (candidate) => candidate.id !== id
          )
          return {
            connections,
            activeConnectionId:
              state.activeConnectionId === id
                ? (connections[0]?.id ?? null)
                : state.activeConnectionId,
          }
        }),

      setEnvConnections: (envConnections) =>
        set((state) => {
          const connections = [
            ...envConnections,
            ...localConnections(state.connections),
          ]
          return {
            connections,
            activeConnectionId: connections.some(
              (connection) => connection.id === state.activeConnectionId
            )
              ? state.activeConnectionId
              : (connections[0]?.id ?? null),
          }
        }),

      openAddDialog: () =>
        set({ editingConnection: null, isAddDialogOpen: true }),

      openEditDialog: (connection) => {
        if (connection.source !== "local") return
        set({ editingConnection: connection, isAddDialogOpen: true })
      },

      setAddDialogOpen: (open) =>
        set(
          open
            ? { isAddDialogOpen: true }
            : { editingConnection: null, isAddDialogOpen: false }
        ),

      finishHydration: () =>
        set((state) => ({
          hasHydrated: true,
          activeConnectionId: state.connections.some(
            (connection) => connection.id === state.activeConnectionId
          )
            ? state.activeConnectionId
            : (state.connections[0]?.id ?? null),
        })),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: (state): PersistedConnectionState => ({
        connections: localConnections(state.connections),
        activeConnectionId: state.activeConnectionId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | Partial<PersistedConnectionState>
          | undefined
        return {
          ...currentState,
          connections: localConnections(
            Array.isArray(persisted?.connections) ? persisted.connections : []
          ),
          activeConnectionId:
            typeof persisted?.activeConnectionId === "string"
              ? persisted.activeConnectionId
              : null,
        }
      },
      onRehydrateStorage: () => (state) => {
        // Always resolve hydration (even on error) so the UI never sticks on
        // its pre-hydration loading state.
        state?.finishHydration()
      },
    }
  )
)

/** Move data written by the pre-Zustand implementation into the persist store. */
export function migrateLegacyConnectionStorage(): void {
  if (window.localStorage.getItem(STORE_NAME) !== null) return

  const rawConnections = window.localStorage.getItem(LEGACY_CONNECTIONS_KEY)
  const activeConnectionId = window.localStorage.getItem(
    LEGACY_ACTIVE_CONNECTION_KEY
  )
  if (!rawConnections && !activeConnectionId) return

  try {
    const parsed = rawConnections ? JSON.parse(rawConnections) : []
    const connections = Array.isArray(parsed)
      ? localConnections(parsed as Connection[])
      : []

    window.localStorage.setItem(
      STORE_NAME,
      JSON.stringify({
        state: { connections, activeConnectionId },
        version: STORE_VERSION,
      })
    )
    window.localStorage.removeItem(LEGACY_CONNECTIONS_KEY)
    window.localStorage.removeItem(LEGACY_ACTIVE_CONNECTION_KEY)
  } catch {
    // Leave malformed legacy data untouched so it can be inspected manually.
  }
}

export function useConnections() {
  const store = useConnectionStore()
  const activeConnection = React.useMemo(
    () =>
      store.connections.find(
        (connection) => connection.id === store.activeConnectionId
      ) ?? null,
    [store.activeConnectionId, store.connections]
  )

  return { ...store, activeConnection }
}
