import type React from "react"

import { AppIcon, Loading03Icon } from "@/lib/icons"
import { cn } from "@/lib/utils"

export function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<typeof AppIcon>, "icon">): React.ReactElement {
  return (
    <AppIcon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      icon={Loading03Icon}
      role="status"
      {...props}
    />
  )
}
