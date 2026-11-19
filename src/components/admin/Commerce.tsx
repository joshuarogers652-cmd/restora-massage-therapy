import { useState } from "react";
import { api } from "@/services/api";
import { Alert, StatusBadge } from "@/components/ui";
import { useAdmin, Loadable, useAction, usd, when, dollarsToCents } from "./shared";

type Promo = { id: string; code: string; title_en: string; discount_type: string; discount_value: number; starts_on: string; ends_on: string; max_redemptions: number | null; redemptions: number; active: boolean };

export function Promotions({ canEdit }: { canEdit: boolean }) {
  const state = useAdmin<{ promotions: Promo[] }>("admin/promotions");
  const { run, banner } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ code: "", title_en: "", title_es: "", discount_type: "PERCENT", value: "10", starts_on: today, ends_on: today, max: "" });
  return (
    <div className="space-y-6">
      {banner}
      {canEdit && (
        <form className="card grid gap-3 p-5 md:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          const value = f.discount_type === "PERCENT" ? Number(f.value) : dollarsToCents(f.value);
          if (await run(() => api.post("admin/promotions", { code: f.code, title_en: f.title_en, title_es: f.title_es || f.title_en, discount_type: f.discount_type, discount_value: value, starts_on: f.starts_on, ends_on: f.ends_on, max_redemptions: f.max ? Number(f.max) : null }), "Promotion created.")) state.reload();
        }}>
          <label className="text-sm font-medium">Code<input className="input mt-1 uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
          <label className="text-sm font-medium">Title (English)<input className="input mt-1" value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></label>
          <label className="text-sm font-medium">Title (Spanish)<input className="input mt-1" value={f.title_es} onChange={(e) => setF({ ...f, title_es: e.target.value })} /></label>
          <label className="text-sm font-medium">Type<select className="input mt-1" value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value })}><option value="PERCENT">Percent off</option><option value="FIXED_CENTS">Dollars off</option></select></label>
          <label className="text-sm font-medium">{f.discount_type === "PERCENT" ? "Percent" : "Dollars"}<input className="input mt-1" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
          <label className="text-sm font-medium">Starts<input type="date" className="input mt-1" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></label>
          <label className="text-sm font-medium">Ends<input type="date" className="input mt-1" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></label>
          <label className="text-sm font-medium">Max uses (optional)<input type="number" className="input mt-1" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label>
          <button type="submit" className="btn-primary md:col-span-4 md:w-fit">Create promotion</button>
        </form>
      )}
      <Loadable state={state}>
        {(d) => (
          <table className="table-basic">
            <thead><tr><th>Code</th><th>Title</th><th>Discount</th><th>Dates</th><th>Used</th><th>Status</th></tr></thead>
            <tbody>
              {d.promotions.length === 0 && <tr><td colSpan={6} className="text-ink-muted">No promotions yet.</td></tr>}
              {d.promotions.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.code}</td><td>{p.title_en}</td>
                  <td>{p.discount_type === "PERCENT" ? `${p.discount_value}%` : usd(p.discount_value)}</td>
                  <td>{p.starts_on} → {p.ends_on}</td><td>{p.redemptions}{p.max_redemptions ? ` / ${p.max_redemptions}` : ""}</td>
                  <td>{canEdit ? <button type="button" className="btn-ghost btn-sm" onClick={async () => { if (await run(() => api.put(`admin/promotions/${p.id}`, { active: !p.active }), "Saved.")) state.reload(); }}>{p.active ? "Active — turn off" : "Off — turn on"}</button> : p.active ? "Active" : "Off"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Loadable>
    </div>
  );
}

type Card = { id: string; last4: string; initial_cents: number; balance_cents: number; recipient_name: string | null; recipient_email: string | null; expires_on: string | null; created_at: string; disabled_at: string | null };

export function GiftCards({ canEdit }: { canEdit: boolean }) {
  const state = useAdmin<{ giftCards: Card[] }>("admin/gift-cards");
  const { run, banner } = useAction();
  const [f, setF] = useState({ amount: "50", name: "", email: "", expires: "" });
  const [code, setCode] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      {banner}
      <p className="text-sm text-ink-muted">Gift cards are recorded here and redeemed at the front desk. Online gift card purchase and redemption require Stripe and are not turned on.</p>
      {code && <Alert tone="success">Gift card created. Write this code down now — it won't be shown again: <span className="font-mono text-lg font-bold">{code}</span></Alert>}
      {canEdit && (
        <form className="card grid gap-3 p-5 md:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await api.post<{ code: string }>("admin/gift-cards", { amountCents: dollarsToCents(f.amount), recipientName: f.name || null, recipientEmail: f.email || null, expiresOn: f.expires || null });
            setCode(r.code);
            state.reload();
          } catch (err) { void run(() => Promise.reject(err), ""); }
        }}>
          <label className="text-sm font-medium">Amount ($)<input className="input mt-1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="text-sm font-medium">Recipient name<input className="input mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="text-sm font-medium">Recipient email<input type="email" className="input mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="text-sm font-medium">Expires (optional)<input type="date" className="input mt-1" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></label>
          <button type="submit" className="btn-primary md:w-fit">Create gift card</button>
        </form>
      )}
      <Loadable state={state}>
        {(d) => (
          <table className="table-basic">
            <thead><tr><th>Card</th><th>Recipient</th><th>Value</th><th>Balance</th><th>Expires</th><th /></tr></thead>
            <tbody>
              {d.giftCards.length === 0 && <tr><td colSpan={6} className="text-ink-muted">No gift cards yet.</td></tr>}
              {d.giftCards.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono">••••{g.last4}</td><td>{g.recipient_name ?? "—"}<br /><span className="text-xs text-ink-muted">{g.recipient_email}</span></td>
                  <td>{usd(g.initial_cents)}</td><td>{usd(g.balance_cents)}</td><td>{g.expires_on ?? "—"}</td>
                  <td>{canEdit && (
                    <button type="button" className="btn-ghost btn-sm" onClick={async () => {
                      const v = window.prompt("New balance in dollars:", (g.balance_cents / 100).toFixed(2));
                      if (v === null) return;
                      if (await run(() => api.put(`admin/gift-cards/${g.id}`, { balanceCents: dollarsToCents(v) ?? 0, disabled: !!g.disabled_at }), "Balance updated.")) state.reload();
                    }}>Adjust balance</button>
                  )}{g.disabled_at && <span className="chip">disabled</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Loadable>
    </div>
  );
}

type Pay = { id: string; kind: string; status: string; amount_cents: number; refunded_cents: number; receipt_url: string | null; created_at: string; first_name: string | null; last_name: string | null; starts_at: string | null; refunds: { amount_cents: number; status: string; reason: string }[] | null };

export function Payments({ canRefund }: { canRefund: boolean }) {
  const state = useAdmin<{ payments: Pay[]; configured: boolean }>("admin/payments");
  const { run, banner } = useAction();
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-5">
          {banner}
          {!d.configured && <Alert tone="info">Online payments (Stripe) aren't connected yet, so there are no online payments to show. See docs/AZURE_DEPLOYMENT.md, step 7.</Alert>}
          <table className="table-basic">
            <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Amount</th><th>Refunded</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.payments.length === 0 && <tr><td colSpan={7} className="text-ink-muted">No payments yet.</td></tr>}
              {d.payments.map((p) => (
                <tr key={p.id}>
                  <td>{when(p.created_at)}</td><td>{p.first_name} {p.last_name}</td><td>{p.kind.toLowerCase()}</td>
                  <td>{usd(p.amount_cents)}</td><td>{usd(p.refunded_cents)}{p.refunds?.some((r) => r.status === "NEEDS_MANUAL") && <span className="ml-1 text-xs text-caution-ink">manual refund needed</span>}</td>
                  <td><StatusBadge status={p.status} label={p.status.replace(/_/g, " ").toLowerCase()} /></td>
                  <td className="space-x-2">
                    {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-brand-royal underline">Receipt</a>}
                    {canRefund && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && (
                      <button type="button" className="btn-ghost btn-sm" onClick={async () => {
                        const amount = window.prompt("Refund amount in dollars:", ((p.amount_cents - p.refunded_cents) / 100).toFixed(2));
                        if (!amount) return;
                        const reason = window.prompt("Reason for the refund:") ?? "";
                        if (await run(() => api.post(`admin/payments/${p.id}/refund`, { amountCents: dollarsToCents(amount), reason }), "Refund submitted.")) state.reload();
                      }}>Refund</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Loadable>
  );
}

type Rev = { payments: { month: string; collected_cents: number; refunded_cents: number }[]; appointments: { month: string; completed_value_cents: number; completed: number; cancelled: number; no_shows: number }[] };

export function Reports() {
  const state = useAdmin<Rev>("admin/reports/revenue");
  return (
    <Loadable state={state}>
      {(d) => {
        const months = Array.from(new Set([...d.payments.map((p) => p.month), ...d.appointments.map((a) => a.month)])).sort().reverse();
        return (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Last 12 months. "Completed value" is the price of completed appointments; "collected online" is what Stripe processed.</p>
            <table className="table-basic">
              <thead><tr><th>Month</th><th>Completed</th><th>Completed value</th><th>Collected online</th><th>Refunded</th><th>Cancelled</th><th>No-shows</th></tr></thead>
              <tbody>
                {months.length === 0 && <tr><td colSpan={7} className="text-ink-muted">No activity yet.</td></tr>}
                {months.map((m) => {
                  const p = d.payments.find((x) => x.month === m);
                  const a = d.appointments.find((x) => x.month === m);
                  return <tr key={m}><td>{m}</td><td>{a?.completed ?? 0}</td><td>{usd(a?.completed_value_cents ?? 0)}</td><td>{usd(p?.collected_cents ?? 0)}</td><td>{usd(p?.refunded_cents ?? 0)}</td><td>{a?.cancelled ?? 0}</td><td>{a?.no_shows ?? 0}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        );
      }}
    </Loadable>
  );
}
