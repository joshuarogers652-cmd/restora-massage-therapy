import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { getAvailability, type Slot } from "@/services/booking";
import { ApiError } from "@/services/api";
import type { PublicSettings } from "@/types";
import { addDays, cn, time, todayIn, weekdayOf } from "@/utils/format";

type Props = {
  serviceId: string;
  minutes: number;
  enhancementIds: string[];
  therapistId: string | null;
  settings: PublicSettings;
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
  excludeAppointmentId?: string;
};

/** Date strip + available times. Availability always comes from the server. */
export function BookingCalendar({ serviceId, minutes, enhancementIds, therapistId, settings, value, onChange, excludeAppointmentId }: Props) {
  const { t, locale } = useI18n();
  const tz = settings.business.timezone;
  const today = todayIn(tz);
  const hoursPublished = Object.keys(settings.business.hours ?? {}).length > 0;
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= settings.booking.maxDaysAhead; i++) out.push(addDays(today, i));
    return out;
  }, [today, settings.booking.maxDaysAhead]);
  const isClosed = (d: string) => hoursPublished && !settings.business.hours[String(weekdayOf(d))];

  const [page, setPage] = useState(0);
  const perPage = 7;
  const [date, setDate] = useState<string>(() => days.find((d) => !isClosed(d)) ?? today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setError(null);
    getAvailability({ serviceId, minutes, enhancementIds, therapistId, date, excludeAppointmentId })
      .then((r) => !cancelled && setSlots(r.slots))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.code : "ERROR"));
    return () => {
      cancelled = true;
    };
  }, [serviceId, minutes, enhancementIds.join(","), therapistId, date, excludeAppointmentId]);

  const visible = days.slice(page * perPage, page * perPage + perPage);
  const fmtDay = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { weekday: "short", timeZone: "UTC" });
  const fmtNum = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans text-base font-semibold text-ink">{t("booking.chooseDate")}</h3>
          <div className="flex gap-1">
            <button type="button" className="btn-ghost btn-sm px-3" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost btn-sm px-3" disabled={(page + 1) * perPage >= days.length} onClick={() => setPage((p) => p + 1)} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t("booking.chooseDate")}>
          {visible.map((d) => {
            const closed = isClosed(d);
            const selected = d === date;
            const asDate = new Date(`${d}T12:00:00Z`);
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={closed}
                data-date={d}
                onClick={() => {
                  setDate(d);
                  onChange(null);
                }}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 text-xs transition-colors",
                  selected ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-white hover:border-brand-lavender",
                  closed && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="uppercase">{fmtDay.format(asDate)}</span>
                <span className="mt-0.5 text-sm font-semibold">{fmtNum.format(asDate)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-sans text-base font-semibold text-ink">{t("booking.chooseTime")}</h3>
        {error ? (
          <p className="text-stop-ink">{t(`errors.${error}`) !== `errors.${error}` ? t(`errors.${error}`) : t("common.error")}</p>
        ) : slots === null ? (
          <p className="flex items-center gap-2 text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t("booking.loadingTimes")}</p>
        ) : slots.length === 0 ? (
          <p className="text-ink-muted">{t("booking.noTimes")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("booking.chooseTime")}>
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                role="radio"
                aria-checked={value?.start === s.start}
                onClick={() => onChange(s)}
                className={cn(
                  "min-h-11 rounded-xl border text-sm font-semibold tabular-nums",
                  value?.start === s.start ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-white text-brand-deep hover:border-brand-lavender hover:bg-brand-lilac",
                )}
              >
                {time(s.start, locale, tz)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
