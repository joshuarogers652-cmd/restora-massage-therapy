import { type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/utils/format";

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-ink-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode; className?: string }) {
  const styles = {
    info: ["bg-brand-soft/70 text-brand-deep", Info],
    error: ["bg-stop-bg text-stop-ink", AlertCircle],
    success: ["bg-go-bg text-go-ink", CheckCircle2],
    warning: ["bg-caution-bg text-caution-ink", AlertCircle],
  } as const;
  const [cls, Icon] = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl px-4 py-3.5 leading-relaxed", cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Field({ id, label, hint, error, children, optional }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; optional?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="font-normal text-ink-muted"> ({optional})</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-stop-ink">{error}</p>}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, lead, as: Tag = "h2", center }: { eyebrow?: string; title: string; lead?: string; as?: "h1" | "h2"; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl space-y-3", center && "mx-auto text-center")}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className={Tag === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}>{title}</Tag>
      {lead && <p className="text-lg leading-relaxed text-ink-muted">{lead}</p>}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "CONFIRMED" || status === "COMPLETED" || status === "SUCCEEDED" || status === "SIGNED"
      ? "bg-go-bg text-go-ink"
      : status === "PENDING_REVIEW" || status === "HELD" || status === "DRAFT" || status === "REQUIRES_PAYMENT" || status === "NEEDS_MANUAL"
        ? "bg-caution-bg text-caution-ink"
        : status.startsWith("CANCELLED") || status === "NO_SHOW" || status === "FAILED"
          ? "bg-stop-bg text-stop-ink"
          : "bg-brand-soft text-brand-deep";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{label}</span>;
}
