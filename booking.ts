import { api } from "./api";
import type { Concerns, Intake, Profile } from "@/types";

export type Slot = { start: string; therapistIds: string[] };

export function getAvailability(p: { serviceId: string; minutes: number; enhancementIds: string[]; therapistId: string | null; date: string; excludeAppointmentId?: string }) {
  const qs = new URLSearchParams({
    serviceId: p.serviceId,
    minutes: String(p.minutes),
    enhancementIds: p.enhancementIds.join(","),
    therapistId: p.therapistId ?? "any",
    date: p.date,
  });
  if (p.excludeAppointmentId) qs.set("excludeAppointmentId", p.excludeAppointmentId);
  return api.get<{ slots: Slot[]; totalMinutes: number; subtotalCents: number }>(`availability?${qs}`);
}

export type BookingRequest = {
  serviceId: string;
  minutes: number;
  enhancementIds: string[];
  therapistId: string | null;
  startsAt: string;
  profile: Omit<Profile, "preferredName" | "dateOfBirth"> & { preferredName: string | null; dateOfBirth: string | null };
  intake: Intake;
  concerns: Concerns;
  consents: { kind: string; signedName: string }[];
  promotionCode: string | null;
  locale: "en" | "es";
};

export type BookingResult = {
  appointmentId: string;
  status: "HELD" | "PENDING_REVIEW" | "CONFIRMED";
  startsAt: string;
  totalCents: number;
  discountCents: number;
  amountDueNowCents: number;
  needsReview: boolean;
  payment: null | { clientSecret: string; publishableKey: string };
};

export const createBooking = (b: BookingRequest) => api.post<BookingResult>("bookings", b);
export const checkPromotion = (code: string, subtotalCents: number) =>
  api.post<{ title_en: string; title_es: string; discountCents: number }>("promotions/check", { code, subtotalCents });
