"use client"

import { useTheme } from "next-themes"

import { usePreferencesStore } from "@/lib/store/preferences-store"
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
import { Logo } from "@/components/logo"

const THEME_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

type SettingsDialogProps = {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
}

export function SettingsDialog({
  open,
  onOpenChangeAction,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const showFileExtensions = usePreferencesStore(
    (state) => state.showFileExtensions
  )
  const setShowFileExtensions = usePreferencesStore(
    (state) => state.setShowFileExtensions
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      {open ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage the app appearance and information.
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
                        <SelectValue>
                          {
                            THEME_OPTIONS.find(
                              (option) => option.value === (theme ?? "system")
                            )?.label
                          }
                        </SelectValue>
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
                value="about"
                className="min-h-0 min-w-0 overflow-y-auto pe-1"
              >
                <div className="flex items-center gap-3 border-b pb-4">
                  <Logo className="h-10 w-auto shrink-0 text-foreground" />
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
