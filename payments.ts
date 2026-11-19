import Stripe from "stripe";
import type { PoolClient } from "pg";
import { one, q } from "../database/db";
import { HttpError } from "../errors";

let stripe: Stripe | null = null;

/** Stripe is used only when STRIPE_SECRET_KEY is set. There is no simulated payment mode. */
export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.STRIPE_PUBLISHABLE_KEY;
}

export function getStripe(): Stripe {
  if (!stripeConfigured()) {
    throw new HttpError(503, "PAYMENTS_NOT_CONFIGURED", "Online payments are not set up yet.");
  }
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return stripe;
}

export async function createPaymentIntent(
  input: { appointmentId: string; clientId: string; amountCents: number; kind: "DEPOSIT" | "FULL"; email: string | null },
  client: PoolClient,
) {
  const s = getStripe();
  const intent = await s.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: input.email ?? undefined,
      description: "RESTORA Massage Therapy appointment",
      metadata: { appointment_id: input.appointmentId, kind: input.kind },
    },
    { idempotencyKey: `appt-${input.appointmentId}-${input.kind}` },
  );
  await q(
    `INSERT INTO payments (appointment_id, client_id, kind, status, amount_cents, stripe_payment_intent_id)
     VALUES ($1, $2, $3, 'REQUIRES_PAYMENT', $4, $5)`,
    [input.appointmentId, input.clientId, input.kind, input.amountCents, intent.id],
    client,
  );
  return { clientSecret: intent.client_secret, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY };
}

/**
 * Refund every successful payment on an appointment. Without Stripe credentials
 * the refund is recorded as NEEDS_MANUAL so the owner can handle it.
 */
export async function refundAppointment(appointmentId: string, reason: string, actorId: string | null) {
  const payments = await q<{ id: string; amount_cents: number; refunded_cents: number; stripe_payment_intent_id: string | null }>(
    "SELECT id, amount_cents, refunded_cents, stripe_payment_intent_id FROM payments WHERE appointment_id = $1 AND status IN ('SUCCEEDED','PARTIALLY_REFUNDED')",
    [appointmentId],
  );
  const results: { paymentId: string; status: string }[] = [];
  for (const p of payments) {
    results.push(await refundPayment(p, p.amount_cents - p.refunded_cents, reason, actorId));
  }
  return results;
}

export async function refundPayment(
  p: { id: string; amount_cents: number; refunded_cents: number; stripe_payment_intent_id: string | null },
  amount: number,
  reason: string,
  actorId: string | null,
) {
  if (amount <= 0) return { paymentId: p.id, status: "NOTHING_TO_REFUND" };
  if (amount > p.amount_cents - p.refunded_cents) throw new HttpError(400, "REFUND_TOO_LARGE", "The refund is larger than the amount left on this payment.");
  if (!stripeConfigured() || !p.stripe_payment_intent_id) {
    await q("INSERT INTO refunds (payment_id, amount_cents, reason, status, issued_by) VALUES ($1, $2, $3, 'NEEDS_MANUAL', $4)", [p.id, amount, reason, actorId]);
    return { paymentId: p.id, status: "NEEDS_MANUAL" };
  }
  const refund = await getStripe().refunds.create(
    { payment_intent: p.stripe_payment_intent_id, amount },
    { idempotencyKey: `refund-${p.id}-${p.refunded_cents}-${amount}` },
  );
  const status = refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "failed" ? "FAILED" : "PENDING";
  await q(
    "INSERT INTO refunds (payment_id, amount_cents, reason, status, stripe_refund_id, issued_by) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (stripe_refund_id) DO NOTHING",
    [p.id, amount, reason, status, refund.id, actorId],
  );
  if (status !== "FAILED") {
    const refunded = p.refunded_cents + amount;
    await q("UPDATE payments SET refunded_cents = $2, status = $3, updated_at = now() WHERE id = $1", [
      p.id,
      refunded,
      refunded >= p.amount_cents ? "REFUNDED" : "PARTIALLY_REFUNDED",
    ]);
  }
  return { paymentId: p.id, status };
}

export async function paymentForIntent(intentId: string, client?: PoolClient) {
  return one<{ id: string; appointment_id: string | null; status: string }>(
    "SELECT id, appointment_id, status FROM payments WHERE stripe_payment_intent_id = $1",
    [intentId],
    client,
  );
}
