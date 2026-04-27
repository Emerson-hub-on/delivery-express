"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!bg-white !text-zinc-800 !border-zinc-200 !shadow-md",
          title: "!text-zinc-800 !font-semibold",
          description: "!text-zinc-500",
          success: "!text-green-600",
          error: "!text-red-500",
          warning: "!text-yellow-600",
          info: "!text-blue-500",
          actionButton: "!bg-zinc-900 !text-white",
          cancelButton: "!bg-zinc-100 !text-zinc-600",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }