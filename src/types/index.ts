export type Locale = "en" | "es";
export type Pressure = "LIGHT" | "MEDIUM" | "FIRM";
export type Category = "POSTPONE_OR_REFER" | "MODIFY_TREATMENT" | "CLEARANCE_REQUIRED";
export type Role = "client" | "therapist" | "office_manager" | "admin";

export type Duration = { id: string; minutes: number; price_cents: number | null; active: boolean };
export type ScreeningRef = { code: string; category: Category };

export type Service = {
  id: string;
  slug: string;
  name_en: string; name_es: string;
  summary_en: string; summary_es: string;
  description_en: string; description_es: string;
  expect_en: string[]; expect_es: string[];
  benefits_en: string[]; benefits_es: string[];
  candidates_en: string[]; candidates_es: string[];
  notes_en: string[]; notes_es: string[];
  pressure_options: Pressure[];
  requires_consents: string[];
  active: boolean;
  sort_order: number;
  durations: Duration[];
  screening: ScreeningRef[];
};

export type Enhancement = {
  id: string;
  slug: string;
  name_en: string; name_es: string;
  description_en: string; description_es: string;
  benefits_en: string[]; benefits_es: string[];
  requirements_en: string[]; requirements_es: string[];
  added_minutes: number | null;
  price_cents: number | null;
  requires_consents: string[];
  requires_qualification: boolean;
  active: boolean;
  bookable?: boolean;
  screening: ScreeningRef[];
};

export type Rule = {
  id: string;
  kind: "SERVICE_BLOCKS_ENHANCEMENT" | "ENHANCEMENTS_INCOMPATIBLE";
  service_id: string | null;
  enhancement_a: string;
  enhancement_b: string | null;
  reason_en: string; reason_es: string;
};

export type DayHours = { open: string; close: string } | null;

export type PublicSettings = {
  business: {
    phone: string | null; email: string | null; address: string | null; mapUrl: string | null;
    area_en: string; area_es: string; timezone: string; hours: Record<string, DayHours>;
  };
  booking: { onlineBookingEnabled: boolean; maxDaysAhead: number; minNoticeHours: number; cancellationWindowHours: number; rescheduleWindowHours: number };
  payments: { mode: "none" | "deposit" | "full"; depositPercent: number; configured: boolean };
  content: { announcement_en: string; announcement_es: string; lotion_en: string; lotion_es: string };
};

export type TherapistPublic = { id: string; display_name: string; bio_en: string | null; bio_es: string | null; service_ids: string[]; enhancement_ids: string[] };
export type ConsentForm = { kind: string; version: number; title_en: string; title_es: string; body_en: string; body_es: string };

export type Catalog = {
  services: Service[];
  enhancements: Enhancement[];
  rules: Rule[];
  screeningItems: { code: string; label_en: string; label_es: string }[];
  therapists: TherapistPublic[];
  consentForms: ConsentForm[];
  settings: PublicSettings;
};

export type Intake = {
  conditions: string[];
  allergies: string;
  skinSensitivities: string;
  medications: string;
  injuries: string;
  surgeries: string;
  pregnant: boolean | null;
  pregnancyWeeks: number | null;
  underPhysicianCare: boolean | null;
  physicianClearance: string;
  pressurePreference: Pressure | null;
  goals: string[];
  preferences: string;
  emergencyName: string;
  emergencyPhone: string;
};

export type Concerns = { areas: string[]; bothering: string; howLong: string; focus: string; pressure: Pressure };

export type Profile = { firstName: string; lastName: string; preferredName: string; phone: string; dateOfBirth: string };

export type Me = {
  user: { id: string; email: string | null; roles: Role[]; locale: Locale; therapistId: string | null };
  client: null | {
    first_name: string; last_name: string; preferred_name: string | null; phone: string | null; email: string | null;
    date_of_birth: string | null; email_opt_in: boolean; sms_opt_in: boolean; marketing_opt_in: boolean;
  };
};

export type SoapContent = {
  subjective: { concerns: string; symptoms: string; goals: string; changes: string; healthUpdates: string };
  objective: {
    observations: string; areasTreated: string[]; techniques: string; pressure: Pressure | null; durationMinutes: number | null;
    clientResponse: string; enhancementsPerformed: string; cuppingAreas: string; productsUsed: string;
  };
  assessment: { tolerance: string; progress: string; observedChanges: string; limitations: string; followUp: string };
  plan: { nextFocus: string; interval: string; selfCare: string; referrals: string };
};

export const BODY_AREAS = ["neck", "shoulders", "upper_back", "lower_back", "arms", "hands", "hips", "legs", "calves", "feet", "face", "jaw"] as const;

export const emptyIntake = (): Intake => ({
  conditions: [], allergies: "", skinSensitivities: "", medications: "", injuries: "", surgeries: "",
  pregnant: null, pregnancyWeeks: null, underPhysicianCare: null, physicianClearance: "",
  pressurePreference: null, goals: [], preferences: "", emergencyName: "", emergencyPhone: "",
});
