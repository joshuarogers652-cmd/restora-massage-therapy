import { useAdmin, Loadable, usd } from "./shared";
import { Alert } from "@/components/ui";

type O = Record<string, number> & { utilization: { id: string; display_name: string; weekly_minutes: number; booked_minutes: number }[]; integrations: { payments: boolean } };

export default function Overview() {
  const state = useAdmin<O>("admin/overview");
  return (
    <Loadable state={state}>
      {(o) => (
        <div className="space-y-8">
          {o.pending_reviews > 0 && <Alert tone="warning">{o.pending_reviews} appointment(s) are waiting for a therapist's health review.</Alert>}
          {o.manual_refunds > 0 && <Alert tone="warning">{o.manual_refunds} refund(s) need to be handled manually (online payments aren't connected).</Alert>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Today", o.today], ["This week", o.week], ["This month", o.month], ["Completed this month", o.completed_month],
              ["Cancellations (30 days)", o.cancellations_30d], ["No-shows (30 days)", o.no_shows_30d], ["New clients (30 days)", o.new_clients_30d], ["Returning clients (30 days)", o.returning_clients_30d],
              ["Revenue this month", usd(o.revenue_month_cents)], ["Outstanding payments", usd(o.outstanding_cents)], ["SOAP notes outstanding", o.soap_outstanding], ["SOAP notes signed", o.soap_signed],
              ["Waiting for review", o.pending_reviews], ["Unread messages", o.unread_messages], ["Open records requests", o.open_records_requests], ["Online payments", o.integrations.payments ? "Connected" : "Not set up"],
            ].map(([label, value]) => (
              <div key={String(label)} className="card p-5">
                <p className="font-display text-3xl font-semibold text-brand-deep" data-stat={String(label)}>{value}</p>
                <p className="text-sm text-ink-muted">{label}</p>
              </div>
            ))}
          </div>
          <section className="card p-6">
            <h3 className="mb-4 text-xl">Therapist utilization this week</h3>
            {o.utilization.length === 0 ? <p className="text-ink-muted">No therapists yet. Add one under Therapists.</p> : (
              <ul className="space-y-3">
                {o.utilization.map((u) => {
                  const pct = u.weekly_minutes ? Math.min(100, Math.round((u.booked_minutes / u.weekly_minutes) * 100)) : 0;
                  return (
                    <li key={u.id}>
                      <div className="flex justify-between text-sm"><span className="font-medium">{u.display_name}</span><span className="tabular-nums text-ink-muted">{Math.round(u.booked_minutes / 60)}h of {Math.round(u.weekly_minutes / 60)}h · {pct}%</span></div>
                      <div className="mt-1 h-2 rounded-full bg-brand-soft"><div className="h-2 rounded-full bg-brand-royal" style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Loadable>
  );
}
