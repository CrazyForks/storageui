"use client"

import * as React from "react"

import {
  AppIcon,
  Clock01Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  HardDriveIcon,
  PlusSignCircleIcon,
  Settings01Icon,
  Upload01Icon,
} from "@/lib/icons"
import { useConnections } from "@/lib/store/connection-store"
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
import { SettingsDialog } from "@/components/settings-dialog"

// This app has no backend — it talks to S3 / R2 directly from the browser
// using credentials from env vars or the "Add connection" dialog (stored in
// localStorage). The sidebar only surfaces locally-feasible views; server-only
// ideas (Shared links, Trash/restore, live object counts) are left out.

type BrowseItem = {
  title: string
  icon: typeof FolderLibraryIcon
}

const BROWSE: BrowseItem[] = [
  { title: "All Files", icon: FolderLibraryIcon },
  { title: "Recents", icon: Clock01Icon },
  { title: "Starred", icon: FavouriteIcon },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [isSettingsOpen, setSettingsOpen] = React.useState(false)
  const { connections, activeConnection, setActiveConnection, openAddDialog } =
    useConnections()
  const pickFiles = useUploadUiStore((state) => state.pickFiles)

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
                    isActive={item.title === "All Files" && !!activeConnection}
                    tooltip={item.title}
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
              {connections.map((connection) => (
                <SidebarMenuItem key={connection.id}>
                  <SidebarMenuButton
                    isActive={connection.id === activeConnection?.id}
                    tooltip={connection.bucket}
                    onClick={() => setActiveConnection(connection.id)}
                  >
                    <AppIcon icon={HardDriveIcon} />
                    <span className="truncate">{connection.name}</span>
                    {connection.source === "env" ? (
                      <span className="ms-auto rounded bg-muted px-1 text-[0.625rem] tracking-wide text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
                        env
                      </span>
                    ) : null}
                  </SidebarMenuButton>
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
