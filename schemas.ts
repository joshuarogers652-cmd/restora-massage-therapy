import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const BODY_AREAS = [
  "neck", "shoulders", "upper_back", "lower_back", "arms", "hands", "hips", "legs", "calves", "feet", "face", "jaw",
] as const;
export const PRESSURES = ["LIGHT", "MEDIUM", "FIRM"] as const;
export const GOALS = ["relaxation", "tension", "comfort", "recovery", "wellness", "specific_areas"] as const;

export const profileSchema = z.object({
  firstName: text(80).min(1),
  lastName: text(80).min(1),
  preferredName: optText(80),
  phone: text(40).min(7),
  dateOfBirth: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

/** Health history. Stored encrypted. Only what is needed for safe care. */
export const intakeSchema = z.object({
  conditions: z.array(z.string().regex(/^[a-z_]{2,60}$/)).max(60).default([]),
  allergies: text(1000).default(""),
  skinSensitivities: text(1000).default(""),
  medications: text(1000).default(""),
  injuries: text(1000).default(""),
  surgeries: text(1000).default(""),
  pregnant: z.boolean().nullable().default(null),
  pregnancyWeeks: z.number().int().min(1).max(45).nullable().default(null),
  underPhysicianCare: z.boolean().nullable().default(null),
  physicianClearance: text(500).default(""),
  pressurePreference: z.enum(PRESSURES).nullable().default(null),
  goals: z.array(z.enum(GOALS)).max(GOALS.length).default([]),
  preferences: text(1000).default(""),
  emergencyName: text(120).default(""),
  emergencyPhone: text(40).default(""),
});
export type Intake = z.infer<typeof intakeSchema>;

/** Visit-specific answers. Stored encrypted with the appointment. */
export const concernsSchema = z.object({
  areas: z.array(z.enum(BODY_AREAS)).max(BODY_AREAS.length).default([]),
  bothering: text(2000).default(""),
  howLong: text(500).default(""),
  focus: text(2000).default(""),
  pressure: z.enum(PRESSURES),
});
export type Concerns = z.infer<typeof concernsSchema>;

export const consentSchema = z.object({
  kind: z.enum(["GENERAL_TREATMENT", "AROMATHERAPY", "DYNAMIC_CUPPING", "PRENATAL", "CANCELLATION_POLICY"]),
  signedName: text(120).min(2),
});

export const bookingSchema = z.object({
  serviceId: z.string().uuid(),
  minutes: z.number().int().min(15).max(240),
  enhancementIds: z.array(z.string().uuid()).max(5).default([]),
  therapistId: z.string().uuid().nullable().default(null),
  startsAt: z.string().datetime({ offset: true }),
  profile: profileSchema,
  intake: intakeSchema,
  concerns: concernsSchema,
  consents: z.array(consentSchema).max(10),
  promotionCode: optText(40),
  locale: z.enum(["en", "es"]).default("en"),
});

export const soapContentSchema = z.object({
  subjective: z.object({
    concerns: text(4000).default(""),
    symptoms: text(4000).default(""),
    goals: text(2000).default(""),
    changes: text(2000).default(""),
    healthUpdates: text(2000).default(""),
  }),
  objective: z.object({
    observations: text(4000).default(""),
    areasTreated: z.array(z.enum(BODY_AREAS)).default([]),
    techniques: text(2000).default(""),
    pressure: z.enum(PRESSURES).nullable().default(null),
    durationMinutes: z.number().int().min(0).max(300).nullable().default(null),
    clientResponse: text(2000).default(""),
    enhancementsPerformed: text(1000).default(""),
    cuppingAreas: text(1000).default(""),
    productsUsed: text(1000).default(""),
  }),
  assessment: z.object({
    tolerance: text(2000).default(""),
    progress: text(2000).default(""),
    observedChanges: text(2000).default(""),
    limitations: text(2000).default(""),
    followUp: text(2000).default(""),
  }),
  plan: z.object({
    nextFocus: text(2000).default(""),
    interval: text(500).default(""),
    selfCare: text(2000).default(""),
    referrals: text(1000).default(""),
  }),
});
export type SoapContent = z.infer<typeof soapContentSchema>;

export const reviewSchema = z.object({
  decision: z.enum(["PROCEED", "PROCEED_WITH_MODIFICATIONS", "POSTPONE", "REFER", "CLEARANCE_REQUESTED"]),
  rationale: text(4000).min(10, "Please record the reason for your decision (at least 10 characters)."),
});

export const contactSchema = z.object({
  name: text(120).min(1),
  email: z.string().trim().email().max(200),
  phone: optText(40),
  topic: z.enum(["booking", "services", "other"]),
  message: text(4000).min(10),
  consent: z.literal(true),
  locale: z.enum(["en", "es"]).default("en"),
  company: z.string().max(0).optional(), // honeypot
});
