import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 23 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M11.5001 14.329L22.2323 8.10338L11.5001 1.875L0.767734 8.10338L11.5001 14.329Z"
        fill="currentColor"
      />
      <path
        d="M10.7323 15.6658L0 9.44018V21.8966L10.7323 28.125V15.6658Z"
        fill="currentColor"
      />
      <path
        opacity="0.5"
        d="M12.2685 15.6659V28.1251L23.0006 21.8968V9.44031L12.2685 15.6659Z"
        fill="currentColor"
      />
    </svg>
  )
}
