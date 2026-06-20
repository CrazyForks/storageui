"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import type { Connection, ConnectionProvider } from "@/lib/connections"
import {
  AppIcon,
  Delete02Icon,
  HardDriveIcon,
  InformationCircleIcon,
  PlusSignCircleIcon,
} from "@/lib/icons"
import { useConnections } from "@/lib/store/connection-store"
import { usePreferencesStore } from "@/lib/store/preferences-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

const PROVIDER_LABELS: Record<ConnectionProvider, string> = {
  s3: "AWS S3",
  r2: "Cloudflare R2",
  "s3-compatible": "S3-compatible",
}

const THEME_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const showFileExtensions = usePreferencesStore(
    (state) => state.showFileExtensions
  )
  const setShowFileExtensions = usePreferencesStore(
    (state) => state.setShowFileExtensions
  )
  const {
    connections,
    activeConnection,
    setActiveConnection,
    removeConnection,
    openAddDialog,
    openEditDialog,
  } = useConnections()
  const [pendingRemovalId, setPendingRemovalId] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    if (!open) setPendingRemovalId(null)
  }, [open])

  function handleAddConnection() {
    onOpenChange(false)
    window.setTimeout(openAddDialog, 0)
  }

  function handleEditConnection(connection: Connection) {
    onOpenChange(false)
    window.setTimeout(() => openEditDialog(connection), 0)
  }

  function handleRemoveConnection(id: string) {
    removeConnection(id)
    setPendingRemovalId(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage the app appearance, storage connections, and information.
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="pt-2">
            <Tabs
              className="h-80 w-full gap-5"
              defaultValue="general"
              orientation="vertical"
            >
              <TabsList className="w-36 shrink-0 self-start">
                <TabsTab value="general">General</TabsTab>
                <TabsTab value="connections">Connections</TabsTab>
                <TabsTab value="about">About</TabsTab>
              </TabsList>

              <TabsPanel
                value="general"
                className="min-h-0 min-w-0 overflow-y-auto pe-1"
              >
                <div className="divide-y">
                  <div className="flex items-center justify-between gap-6 pb-4 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Appearance</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Choose how the interface looks on this device.
                      </p>
                    </div>
                    <Select
                      value={theme ?? "system"}
                      onValueChange={(value) => setTheme(String(value))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THEME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-6 pt-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Show filename extensions
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Display extensions like .pdf or .docx in the file
                        browser.
                      </p>
                    </div>
                    <Switch
                      checked={showFileExtensions}
                      onCheckedChange={setShowFileExtensions}
                    />
                  </label>
                </div>
              </TabsPanel>

              <TabsPanel
                value="connections"
                className="min-h-0 min-w-0 overflow-y-auto pe-1"
              >
                <div className="mb-1 flex items-center justify-between gap-4 border-b pb-3">
                  <div>
                    <p className="text-sm font-medium">Storage connections</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Environment connections are read-only.
                    </p>
                  </div>
                  <Button size="sm" onClick={handleAddConnection}>
                    <AppIcon icon={PlusSignCircleIcon} />
                    Add
                  </Button>
                </div>

                {connections.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <AppIcon icon={HardDriveIcon} className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No connections</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add an S3, R2, or S3-compatible bucket.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {connections.map((connection) => {
                      const isActive = connection.id === activeConnection?.id
                      const isPendingRemoval =
                        connection.id === pendingRemovalId

                      return (
                        <div
                          key={connection.id}
                          className="flex min-w-0 items-center gap-3 py-3"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <AppIcon
                              icon={HardDriveIcon}
                              className="size-4.5"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {connection.name}
                              </p>
                              {isActive ? (
                                <Badge size="sm" variant="success">
                                  Active
                                </Badge>
                              ) : null}
                              {connection.source === "env" ? (
                                <Badge size="sm" variant="outline">
                                  ENV
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {PROVIDER_LABELS[connection.provider]} ·{" "}
                              {connection.bucket}
                            </p>
                          </div>

                          {isPendingRemoval ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setPendingRemovalId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() =>
                                  handleRemoveConnection(connection.id)
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {!isActive ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    setActiveConnection(connection.id)
                                  }
                                >
                                  Use
                                </Button>
                              ) : null}
                              {connection.source === "local" ? (
                                <>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() =>
                                      handleEditConnection(connection)
                                    }
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    aria-label={`Remove ${connection.name}`}
                                    size="icon-xs"
                                    variant="destructive-outline"
                                    onClick={() =>
                                      setPendingRemovalId(connection.id)
                                    }
                                  >
                                    <AppIcon icon={Delete02Icon} />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsPanel>

              <TabsPanel
                value="about"
                className="min-h-0 min-w-0 overflow-y-auto pe-1"
              >
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <AppIcon
                      icon={InformationCircleIcon}
                      className="size-5.5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold">Drive UI</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      A Finder-style browser for S3-compatible object storage.
                    </p>
                  </div>
                </div>

                <dl className="divide-y text-sm">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd>0.1.0</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted-foreground">License</dt>
                    <dd>MIT</dd>
                  </div>
                </dl>
              </TabsPanel>
            </Tabs>
          </DialogPanel>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
