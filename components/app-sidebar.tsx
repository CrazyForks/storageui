"use client"

import * as React from "react"

import {
  AppIcon,
  Clock01Icon,
  Edit02Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  PlusSignCircleIcon,
  Settings01Icon,
  Upload01Icon,
} from "@/lib/icons"
import { useConnections } from "@/lib/store/connection-store"
import { useNavStore, type BrowseSection } from "@/lib/store/nav-store"
import { useUploadUiStore } from "@/lib/store/upload-ui-store"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { SettingsDialog } from "@/components/settings-dialog"

// This app has no backend — it talks to S3 / R2 directly from the browser
// using credentials from env vars or the "Add connection" dialog (stored in
// localStorage). The sidebar only surfaces locally-feasible views; server-only
// ideas (Shared links, Trash/restore, live object counts) are left out.

type BrowseItem = {
  title: string
  icon: typeof FolderLibraryIcon
  section: BrowseSection
}

const BROWSE: BrowseItem[] = [
  { title: "All Files", icon: FolderLibraryIcon, section: "all" },
  { title: "Recents", icon: Clock01Icon, section: "recents" },
  { title: "Starred", icon: FavouriteIcon, section: "starred" },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [isSettingsOpen, setSettingsOpen] = React.useState(false)
  const {
    connections,
    activeConnection,
    hasHydrated,
    setActiveConnection,
    openAddDialog,
    openEditDialog,
  } = useConnections()
  const pickFiles = useUploadUiStore((state) => state.pickFiles)
  const section = useNavStore((state) => state.section)
  const setSection = useNavStore((state) => state.setSection)

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <Button
                  variant="default"
                  title="Upload files"
                  disabled={!activeConnection}
                  onClick={() => pickFiles?.()}
                  className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <AppIcon icon={Upload01Icon} />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Upload
                  </span>
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Browse</SidebarGroupLabel>
            <SidebarMenu>
              {BROWSE.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={item.section === section && !!activeConnection}
                    tooltip={item.title}
                    onClick={() => setSection(item.section)}
                  >
                    <AppIcon icon={item.icon} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Connections</SidebarGroupLabel>
            <SidebarMenu>
              {!hasHydrated ? (
                ["w-24", "w-32", "w-20"].map((width, index) => (
                  <SidebarMenuItem key={index}>
                    <div className="flex h-8 items-center gap-2 rounded-lg px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                      <Skeleton className="size-4 shrink-0 rounded" />
                      <Skeleton
                        className={`${width} h-4 group-data-[collapsible=icon]:hidden`}
                      />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                <>
                  {connections.map((connection) => (
                    <SidebarMenuItem key={connection.id}>
                      <SidebarMenuButton
                        isActive={connection.id === activeConnection?.id}
                        tooltip={connection.bucket}
                        onClick={() => {
                          setActiveConnection(connection.id)
                          setSection("all")
                        }}
                      >
                        <AppIcon icon={HardDriveIcon} />
                        <span className="truncate">{connection.name}</span>
                        {connection.source === "env" ? (
                          <span className="ms-auto rounded bg-muted px-1 text-[0.625rem] tracking-wide text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
                            env
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                      {connection.source !== "env" ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          data-sidebar="menu-action"
                          aria-label="Edit connection"
                          title="Edit connection"
                          onClick={() => openEditDialog(connection)}
                          className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden focus-visible:opacity-100"
                        >
                          <AppIcon icon={Edit02Icon} />
                        </Button>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                  {connections.length === 0 ? (
                    <SidebarMenuItem>
                      <span className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        No connections yet
                      </span>
                    </SidebarMenuItem>
                  ) : null}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Add connection"
                      onClick={openAddDialog}
                    >
                      <AppIcon icon={PlusSignCircleIcon} />
                      <span>Add connection</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <AppIcon icon={Settings01Icon} />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
      <SettingsDialog open={isSettingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
