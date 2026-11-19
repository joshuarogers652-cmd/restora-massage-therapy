import { useState } from "react";
import { api } from "@/services/api";
import { StatusBadge } from "@/components/ui";
import { useAdmin, Loadable, useAction, usd, when } from "./shared";

type A = { id: string; starts_at: string; status: string; total_cents: number; flagged_count: number; first_name: string; last_name: string; phone: string | null; therapist_name: string; service_name: string; minutes: number; payment_status: string | null; soap_status: string | null; cancel_reason: string | null };

export default function Appointments({ tz }: { tz: string }) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState("");
  const to = new Date(new Date(`${from}T00:00:00`).getTime() + days * 86400000).toISOString();
  const state = useAdmin<{ appointments: A[] }>(`admin/appointments?from=${new Date(`${from}T00:00:00`).toISOString()}&to=${to}${status ? `&status=${status}` : ""}`);
  const { run, banner } = useAction();
  return (
    <div className="space-y-5">
      {banner}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">From<input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Range<select className="input mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>1 day</option><option value={7}>7 days</option><option value={31}>31 days</option></select></label>
        <label className="text-sm">Status<select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>{["PENDING_REVIEW", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_BUSINESS", "NO_SHOW", "HELD"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
        </select></label>
      </div>
      <Loadable state={state}>
        {(d) => (
          <div className="overflow-x-auto">
            <table className="table-basic">
              <thead><tr><th>When</th><th>Client</th><th>Service</th><th>Therapist</th><th>Status</th><th>Payment</th><th>SOAP</th><th>Total</th><th /></tr></thead>
              <tbody>
                {d.appointments.length === 0 && <tr><td colSpan={9} className="text-ink-muted">No appointments in this range.</td></tr>}
                {d.appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{when(a.starts_at, tz)}</td>
                    <td>{a.first_name} {a.last_name}<br /><span className="text-xs text-ink-muted">{a.phone}</span></td>
                    <td>{a.service_name} · {a.minutes}m{a.flagged_count > 0 && <span className="ml-1 text-xs font-semibold text-caution-ink">({a.flagged_count} flag)</span>}</td>
                    <td>{a.therapist_name}</td>
                    <td><StatusBadge status={a.status} label={a.status.replace(/_/g, " ").toLowerCase()} />{a.cancel_reason && <p className="mt-1 text-xs text-ink-muted">{a.cancel_reason}</p>}</td>
                    <td className="text-xs">{a.payment_status?.toLowerCase() ?? "—"}</td>
                    <td className="text-xs">{a.soap_status?.toLowerCase() ?? (a.status === "COMPLETED" ? "missing" : "—")}</td>
                    <td className="tabular-nums">{usd(a.total_cents)}</td>
                    <td>
                      {["HELD", "PENDING_REVIEW", "CONFIRMED"].includes(a.status) && (
                        <button type="button" className="btn-danger btn-sm" onClick={async () => {
                          const reason = window.prompt("Reason for cancelling (the client is notified):");
                          if (!reason) return;
                          if (await run(() => api.post(`admin/appointments/${a.id}/cancel`, { reason, refund: true }), "Appointment cancelled.")) state.reload();
                        }}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loadable>
    </div>
  );
}
