import { useMemo, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Alert } from "@/components/ui";
import { useI18n } from "@/contexts/I18nContext";

/**
 * Stripe Payment Element. Card details go directly to Stripe and never touch
 * RESTORA's servers. The appointment is confirmed only when the server receives
 * Stripe's signed webhook — never from this page alone.
 */
export default function PaymentStep({ clientSecret, publishableKey, amountLabel }: { clientSecret: string; publishableKey: string; amountLabel: string }) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#54266F", borderRadius: "12px" } } }}>
      <PayForm amountLabel={amountLabel} />
    </Elements>
  );
}

function PayForm({ amountLabel }: { amountLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "processing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setState("processing");
    setError(null);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/account?payment=returned` },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? t("common.error"));
      setState("idle");
    } else {
      setState("done");
    }
  }

  if (state === "done") return <Alert tone="success">{t("booking.paymentDone")} <a className="font-semibold underline" href="/account">{t("booking.viewAppointments")}</a></Alert>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && <Alert tone="error">{error}</Alert>}
      <button type="submit" className="btn-primary btn-lg w-full" disabled={!stripe || state === "processing"}>
        {state === "processing" ? t("booking.paymentProcessing") : t("booking.payButton", { amount: amountLabel })}
      </button>
    </form>
  );
}
