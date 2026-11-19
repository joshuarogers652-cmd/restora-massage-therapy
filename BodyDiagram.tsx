import { useState, type KeyboardEvent } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { BODY_AREAS } from "@/types";
import { cn } from "@/utils/format";

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r?: number };

/** Clickable regions for the front and back views (viewBox 0 0 200 420). */
const FRONT: Record<string, Shape[]> = {
  face: [{ kind: "ellipse", cx: 100, cy: 36, rx: 24, ry: 24 }],
  jaw: [{ kind: "ellipse", cx: 100, cy: 64, rx: 17, ry: 8 }],
  neck: [{ kind: "rect", x: 89, y: 73, w: 22, h: 15, r: 5 }],
  shoulders: [{ kind: "ellipse", cx: 64, cy: 97, rx: 21, ry: 11 }, { kind: "ellipse", cx: 136, cy: 97, rx: 21, ry: 11 }],
  arms: [{ kind: "rect", x: 34, y: 106, w: 20, h: 106, r: 10 }, { kind: "rect", x: 146, y: 106, w: 20, h: 106, r: 10 }],
  hands: [{ kind: "ellipse", cx: 44, cy: 228, rx: 11, ry: 14 }, { kind: "ellipse", cx: 156, cy: 228, rx: 11, ry: 14 }],
  hips: [{ kind: "rect", x: 68, y: 206, w: 64, h: 32, r: 12 }],
  legs: [{ kind: "rect", x: 70, y: 242, w: 27, h: 82, r: 12 }, { kind: "rect", x: 103, y: 242, w: 27, h: 82, r: 12 }],
  calves: [{ kind: "rect", x: 72, y: 328, w: 23, h: 56, r: 10 }, { kind: "rect", x: 105, y: 328, w: 23, h: 56, r: 10 }],
  feet: [{ kind: "ellipse", cx: 83, cy: 397, rx: 14, ry: 8 }, { kind: "ellipse", cx: 117, cy: 397, rx: 14, ry: 8 }],
};
const BACK: Record<string, Shape[]> = {
  neck: [{ kind: "rect", x: 89, y: 64, w: 22, h: 24, r: 6 }],
  shoulders: FRONT.shoulders!,
  upper_back: [{ kind: "rect", x: 68, y: 108, w: 64, h: 52, r: 12 }],
  lower_back: [{ kind: "rect", x: 70, y: 162, w: 60, h: 40, r: 12 }],
  arms: FRONT.arms!,
  hands: FRONT.hands!,
  hips: [{ kind: "rect", x: 68, y: 206, w: 64, h: 34, r: 14 }],
  legs: FRONT.legs!,
  calves: FRONT.calves!,
  feet: FRONT.feet!,
};

function ShapeEl({ s, ...rest }: { s: Shape } & React.SVGProps<SVGElement>) {
  if (s.kind === "ellipse") return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...(rest as React.SVGProps<SVGEllipseElement>)} />;
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...(rest as React.SVGProps<SVGRectElement>)} />;
}

export function BodyDiagram({ value, onChange }: { value: string[]; onChange: (areas: string[]) => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<"front" | "back">("front");
  const regions = view === "front" ? FRONT : BACK;
  const toggle = (area: string) => onChange(value.includes(area) ? value.filter((a) => a !== area) : [...value, area]);
  const onKey = (e: KeyboardEvent, area: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(area);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
      <div>
        <div className="mb-3 inline-flex rounded-full bg-brand-soft p-1" role="tablist" aria-label={t("intake.areasTitle")}>
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("min-h-9 rounded-full px-4 text-sm font-medium", view === v ? "bg-white text-brand-deep shadow-soft" : "text-ink-muted")}
            >
              {v === "front" ? t("intake.front") : t("intake.backView")}
            </button>
          ))}
        </div>
        <svg viewBox="0 0 200 420" className="mx-auto h-auto w-full max-w-[15rem]" role="group" aria-label={`${t("intake.areasTitle")} — ${view === "front" ? t("intake.front") : t("intake.backView")}`}>
          {/* silhouette */}
          <g fill="#F3ECF8" stroke="#D9C6EA" strokeWidth="1.5" pointerEvents="none">
            <ellipse cx="100" cy="42" rx="27" ry="31" />
            <rect x="88" y="70" width="24" height="20" rx="6" />
            <rect x="64" y="88" width="72" height="120" rx="22" />
            <rect x="32" y="96" width="24" height="120" rx="12" />
            <rect x="144" y="96" width="24" height="120" rx="12" />
            <rect x="66" y="200" width="68" height="44" rx="16" />
            <rect x="68" y="236" width="31" height="152" rx="14" />
            <rect x="101" y="236" width="31" height="152" rx="14" />
          </g>
          {Object.entries(regions).map(([area, shapes]) => {
            const selected = value.includes(area);
            return (
              <g
                key={area}
                role="checkbox"
                aria-checked={selected}
                aria-label={t(`areas.${area}`)}
                tabIndex={0}
                onClick={() => toggle(area)}
                onKeyDown={(e) => onKey(e, area)}
                className="cursor-pointer outline-none [&:focus-visible>*]:stroke-brand-deep [&:focus-visible>*]:stroke-[3]"
                data-area={area}
              >
                {shapes.map((s, i) => (
                  <ShapeEl
                    key={i}
                    s={s}
                    fill={selected ? "#75439A" : "#B89AD6"}
                    fillOpacity={selected ? 0.85 : 0.28}
                    stroke={selected ? "#54266F" : "#B89AD6"}
                    strokeWidth={1.5}
                  />
                ))}
                <title>{t(`areas.${area}`)}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("intake.areasTitle")}</legend>
        <p className="hint mb-3 mt-0">{t("intake.areasHint")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BODY_AREAS.map((area) => (
            <label key={area} className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm", value.includes(area) ? "border-brand-royal bg-brand-soft text-brand-deep" : "border-line bg-white")}>
              <input type="checkbox" className="h-4 w-4 accent-brand-deep" checked={value.includes(area)} onChange={() => toggle(area)} name={`area-${area}`} />
              {t(`areas.${area}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
