import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// IntelTrace is single-theme (always dark) — no next-themes needed here.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-panel)",
          "--normal-text": "var(--color-text)",
          "--normal-border": "var(--color-line)",
          "--success-bg": "var(--color-panel)",
          "--success-text": "var(--color-green)",
          "--success-border": "var(--color-green)",
          "--error-bg": "var(--color-panel)",
          "--error-text": "var(--color-red)",
          "--error-border": "var(--color-red)",
          "--warning-bg": "var(--color-panel)",
          "--warning-text": "var(--color-amber)",
          "--warning-border": "var(--color-amber)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: { toast: "cn-toast" },
      }}
      {...props}
    />
  )
}

export { Toaster }
