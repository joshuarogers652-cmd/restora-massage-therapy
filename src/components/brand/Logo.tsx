import { cn } from "@/utils/format";

/** Original RESTORA lotus mark (not trademark-cleared — see docs/SECURITY.md › Brand). */
export function LotusMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id="rm-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#75439A" /><stop offset="1" stopColor="#B89AD6" /></linearGradient>
        <linearGradient id="rm-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B89AD6" /><stop offset="1" stopColor="#75439A" /></linearGradient>
      </defs>
      <path d="M30 41C20 35.5 10 33.8 2 35.6c5.6 6.4 16 8.2 28 5.4Z" fill="#54266F" opacity=".85" />
      <path d="M34 41c10-5.5 20-7.2 28-5.4-5.6 6.4-16 8.2-28 5.4Z" fill="#54266F" opacity=".85" />
      <path d="M31 40C26.4 28.6 18.6 20.4 8.4 17.6 7.6 29.4 16.6 38.4 31 40Z" fill="url(#rm-s)" />
      <path d="M33 40c4.6-11.4 12.4-19.6 22.6-22.4.8 11.8-8.2 20.8-22.6 22.4Z" fill="url(#rm-s)" />
      <path d="M32 4c8.6 9.4 9.4 24.6 0 36.4C22.6 28.6 23.4 13.4 32 4Z" fill="url(#rm-c)" />
      <path d="M8 49c10-4 22-5.2 34-3.4 5.2.8 9.6 2 14 3.4" fill="none" stroke="#54266F" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ descriptor, className }: { descriptor: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LotusMark className="h-9 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.6rem] font-semibold tracking-[0.08em] text-brand-deep">RESTORA</span>
        <span className="mt-0.5 text-[0.56rem] font-medium uppercase tracking-[0.34em] text-brand-royal">{descriptor}</span>
      </span>
    </span>
  );
}
