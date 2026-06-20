"use client"

import type React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

export function Switch({
  className,
  ...props
}: SwitchPrimitive.Root.Props): React.ReactElement {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring data-[checked]:bg-primary data-[unchecked]:bg-input data-disabled:cursor-not-allowed data-disabled:opacity-64",
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 translate-x-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform data-[checked]:translate-x-[1.125rem]"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}
