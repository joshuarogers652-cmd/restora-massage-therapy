import { EmailClient } from "@azure/communication-email";
import { SmsClient } from "@azure/communication-sms";
import { DateTime } from "luxon";
import { one, q } from "../database/db";
import { getSetting } from "./settings";

/**
 * Appointment messages through Azure Communication Services.
 * Messages contain only the date, time and service name — never health details.
 * Without ACS settings, each message is recorded as NOT_CONFIGURED (nothing is sent).
 */
export function emailConfigured() {
  return !!process.env.ACS_EMAIL_CONNECTION_STRING && !!process.env.ACS_EMAIL_SENDER;
}
export function smsConfigured() {
  return !!process.env.ACS_SMS_CONNECTION_STRING && !!process.env.ACS_SMS_FROM;
}

export type Template = "booked_confirmed" | "booked_pending_review" | "cancelled" | "rescheduled" | "review_confirmed" | "review_follow_up";

const copy: Record<Template, { en: [string, string]; es: [string, string] }> = {
  booked_confirmed: {
    en: ["Your RESTORA appointment is confirmed", "Your {service} appointment is confirmed for {when}."],
    es: ["Su cita en RESTORA está confirmada", "Su cita de {service} está confirmada para el {when}."],
  },
  booked_pending_review: {
    en: [
      "We received your RESTORA booking request",
      "We received your request for {service} on {when}. A therapist will review your health form, and we'll confirm your appointment soon.",
    ],
    es: [
      "Recibimos su solicitud de reserva en RESTORA",
      "Recibimos su solicitud de {service} para el {when}. Un terapeuta revisará su formulario de salud y confirmaremos su cita pronto.",
    ],
  },
  cancelled: {
    en: ["Your RESTORA appointment was cancelled", "Your {service} appointment on {when} was cancelled."],
    es: ["Su cita en RESTORA fue cancelada", "Su cita de {service} del {when} fue cancelada."],
  },
  rescheduled: {
    en: ["Your RESTORA appointment was rescheduled", "Your {service} appointment is now on {when}."],
    es: ["Su cita en RESTORA fue reprogramada", "Su cita de {service} ahora es el {when}."],
  },
  review_confirmed: {
    en: ["Your RESTORA appointment is confirmed", "Thank you for waiting. Your {service} appointment on {when} is confirmed."],
    es: ["Su cita en RESTORA está confirmada", "Gracias por esperar. Su cita de {service} del {when} está confirmada."],
  },
  review_follow_up: {
    en: ["About your RESTORA appointment", "We need to follow up about your {service} appointment on {when}. Please sign in or contact us."],
    es: ["Sobre su cita en RESTORA", "Necesitamos comunicarnos con usted sobre su cita de {service} del {when}. Inicie sesión o contáctenos."],
  },
};

export async function notifyAppointment(appointmentId: string, template: Template) {
  try {
    const a = await one<{
      client_id: string;
      email: string | null;
      phone: string | null;
      email_opt_in: boolean;
      sms_opt_in: boolean;
      locale: "en" | "es" | null;
      starts_at: Date;
      name_en: string;
      name_es: string;
    }>(
      `SELECT c.id AS client_id, c.email, c.phone, c.email_opt_in, c.sms_opt_in, u.preferred_locale AS locale,
              a.starts_at, s.name_en, s.name_es
         FROM appointments a JOIN clients c ON c.id = a.client_id JOIN services s ON s.id = a.service_id
         LEFT JOIN users u ON u.id = c.user_id WHERE a.id = $1`,
      [appointmentId],
    );
    if (!a) return;
    const [settings, business] = await Promise.all([getSetting("notifications"), getSetting("business")]);
    const locale = a.locale ?? "en";
    const when = DateTime.fromJSDate(a.starts_at)
      .setZone(business.timezone)
      .setLocale(locale === "es" ? "es-US" : "en-US")
      .toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
    const [subject, body] = copy[template][locale];
    const text = body.replace("{service}", locale === "es" ? a.name_es : a.name_en).replace("{when}", when);

    if (a.email) {
      let status: string;
      let error: string | null = null;
      if (!a.email_opt_in || !settings.emailEnabled) status = "SUPPRESSED";
      else if (!emailConfigured()) status = "NOT_CONFIGURED";
      else {
        try {
          const clientE = new EmailClient(process.env.ACS_EMAIL_CONNECTION_STRING!);
          await clientE.beginSend({
            senderAddress: process.env.ACS_EMAIL_SENDER!,
            content: { subject, plainText: `${text}\n\nRESTORA Massage Therapy` },
            recipients: { to: [{ address: a.email }] },
          });
          status = "SENT";
        } catch (e) {
          status = "FAILED";
          error = (e as Error).message.slice(0, 500);
        }
      }
      await q("INSERT INTO notifications (client_id, appointment_id, channel, template, status, error) VALUES ($1,$2,'EMAIL',$3,$4,$5)", [
        a.client_id, appointmentId, template, status, error,
      ]);
    }
    if (a.phone) {
      let status: string;
      let error: string | null = null;
      if (!a.sms_opt_in || !settings.smsEnabled) status = "SUPPRESSED";
      else if (!smsConfigured()) status = "NOT_CONFIGURED";
      else {
        try {
          const sms = new SmsClient(process.env.ACS_SMS_CONNECTION_STRING!);
          const [res] = await sms.send({ from: process.env.ACS_SMS_FROM!, to: [a.phone], message: `RESTORA: ${text} Reply STOP to opt out.` });
          status = res?.successful ? "SENT" : "FAILED";
          error = res?.errorMessage ?? null;
        } catch (e) {
          status = "FAILED";
          error = (e as Error).message.slice(0, 500);
        }
      }
      await q("INSERT INTO notifications (client_id, appointment_id, channel, template, status, error) VALUES ($1,$2,'SMS',$3,$4,$5)", [
        a.client_id, appointmentId, template, status, error,
      ]);
    }
  } catch {
    // A notification failure must never undo or block a booking.
  }
}
