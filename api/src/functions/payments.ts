import type Stripe from "stripe";
import { HttpError, ok, register } from "../http";
import { one, q, tx } from "../database/db";
import { audit } from "../services/audit";
import { notifyAppointment } from "../services/notify";
import { getStripe, paymentForIntent, refundAppointment } from "../services/payments";

/**
 * Stripe webhook. Payment results are trusted only from signed Stripe events,
 * never from the browser. Each event id is processed once.
 */
register({
  name: "stripeWebhook",
  route: "payments/webhook",
  methods: ["POST"],
  handler: async (req) => {
    const stripe = getStripe(); // 503 when not configured
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new HttpError(400, "NO_SIGNATURE");
    const raw = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      throw new HttpError(400, "BAD_SIGNATURE", "Webhook signature verification failed.");
    }
    const fresh = await one("INSERT INTO webhook_events (id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id", [event.id, event.type]);
    if (!fresh) return ok({ received: true, duplicate: true });

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      await handleSucceeded(intent);
    } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const intent = event.data.object as Stripe.PaymentIntent;
      await q("UPDATE payments SET status = $2, failure_reason = $3, updated_at = now() WHERE stripe_payment_intent_id = $1", [
        intent.id,
        event.type === "payment_intent.canceled" ? "CANCELLED" : "FAILED",
        intent.last_payment_error?.message ?? null,
      ]);
    } else if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string" && charge.receipt_url) {
        await q("UPDATE payments SET receipt_url = $2, updated_at = now() WHERE stripe_payment_intent_id = $1", [charge.payment_intent, charge.receipt_url]);
      }
    }
    return ok({ received: true });
  },
});

export async function handleSucceeded(intent: Stripe.PaymentIntent) {
  const payment = await paymentForIntent(intent.id);
  if (!payment) return;
  const result = await tx(async (c) => {
    await q("UPDATE payments SET status = 'SUCCEEDED', updated_at = now() WHERE id = $1", [payment.id], c);
    if (!payment.appointment_id) return null;
    const appt = await one<{ status: string; flagged_count: number }>("SELECT status, flagged_count FROM appointments WHERE id = $1 FOR UPDATE", [payment.appointment_id], c);
    if (!appt || !["HELD", "EXPIRED"].includes(appt.status)) return null;
    const next = appt.flagged_count > 0 ? "PENDING_REVIEW" : "CONFIRMED";
    try {
      await c.query("SAVEPOINT activate");
      await q("UPDATE appointments SET status = $2, hold_expires_at = NULL, updated_at = now() WHERE id = $1", [payment.appointment_id, next], c);
      await c.query("RELEASE SAVEPOINT activate");
      await audit(null, "appointment.payment_confirmed", "appointment", payment.appointment_id, { status: next }, c);
      return next;
    } catch (err) {
      // The hold expired and someone else took the time: release it and refund.
      if ((err as { code?: string }).code !== "23P01") throw err;
      await c.query("ROLLBACK TO SAVEPOINT activate");
      await q("UPDATE appointments SET status = 'EXPIRED', updated_at = now() WHERE id = $1", [payment.appointment_id], c);
      return "CONFLICT";
    }
  });
  if (result === "CONFIRMED") await notifyAppointment(payment.appointment_id!, "booked_confirmed");
  if (result === "PENDING_REVIEW") await notifyAppointment(payment.appointment_id!, "booked_pending_review");
  if (result === "CONFLICT") await refundAppointment(payment.appointment_id!, "Time no longer available after payment", null);
}
