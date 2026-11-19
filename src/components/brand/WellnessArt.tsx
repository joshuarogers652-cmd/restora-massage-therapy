import { cn } from "@/utils/format";

/**
 * Image slot. Shows a licensed photo when `src` is given (put files in public/images),
 * otherwise a calm botanical illustration in brand colours.
 */
export function WellnessArt({ src, alt = "", variant = 0, className }: { src?: string; alt?: string; variant?: number; className?: string }) {
  if (src) return <img src={src} alt={alt} className={cn("object-cover", className)} loading="lazy" />;
  const tones = [
    ["#EDE3F5", "#B89AD6", "#75439A"],
    ["#F8F4FB", "#D9C6EA", "#8A5BB0"],
    ["#EFE7F6", "#C7AEE0", "#54266F"],
    ["#F3ECF8", "#B89AD6", "#6A3A8C"],
    ["#F6F0FA", "#CDB6E4", "#75439A"],
  ][variant % 5]!;
  const [bg, mid, deep] = tones;
  const id = `wa${variant}`;
  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id={`${id}g`} cx="0.7" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" /><stop offset="1" stopColor={bg} /></radialGradient>
          <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={mid} /><stop offset="1" stopColor={deep} stopOpacity="0.85" /></linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#${id}g)`} />
        <path d="M-20 230C70 190 150 205 230 240s150 30 190 0V320H-20Z" fill={mid} opacity="0.35" />
        <path d="M-20 262C90 232 190 246 270 270s110 18 150 4V320H-20Z" fill={mid} opacity="0.5" />
        <circle cx={variant % 2 ? 300 : 110} cy="96" r="58" fill="#FFFFFF" opacity="0.55" />
        <g transform={`translate(${variant % 2 ? 90 : 250} 70) rotate(${variant % 2 ? -14 : 12})`}>
          <path d="M0 160C4 110 10 60 30 0" fill="none" stroke={deep} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M8 120C-20 108-34 84-30 58c26 6 40 30 38 62Z" fill={`url(#${id}l)`} />
          <path d="M14 92c22-14 46-14 62 4-20 16-44 14-62-4Z" fill={`url(#${id}l)`} opacity="0.9" />
          <path d="M20 54C2 38-2 16 8-4c18 14 22 36 12 58Z" fill={`url(#${id}l)`} opacity="0.8" />
          <path d="M24 34c14-16 34-20 50-10-12 18-32 22-50 10Z" fill={`url(#${id}l)`} opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
