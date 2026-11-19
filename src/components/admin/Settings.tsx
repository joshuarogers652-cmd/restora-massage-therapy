import { useState } from "react";
import { api } from "@/services/api";
import { Alert } from "@/components/ui";
import { useAdmin, Loadable, useAction } from "./shared";

type S = {
  business: { phone: string | null; email: string | null; address: string | null; mapUrl: string | null; area_en: string; area_es: string; timezone: string; hours: Record<string, { open: string; close: string } | null> };
  booking: { onlineBookingEnabled: boolean; slotIntervalMinutes: number; bufferMinutes: number; minNoticeHours: number; maxDaysAhead: number; cancellationWindowHours: number; rescheduleWindowHours: number; newClientSameDayAllowed: boolean };
  payments: { mode: "none" | "deposit" | "full"; depositPercent: number; holdMinutes: number };
  content: { announcement_en: string; announcement_es: string; lotion_en: string; lotion_es: string };
  notifications: { emailEnabled: boolean; smsEnabled: boolean };
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsAdmin() {
  const state = useAdmin<{ settings: S; integrations: { payments: boolean } }>("admin/settings");
  return <Loadable state={state}>{(d) => <SettingsForm initial={d.settings} paymentsConfigured={d.integrations.payments} reload={state.reload} />}</Loadable>;
}

function SettingsForm({ initial, paymentsConfigured, reload }: { initial: S; paymentsConfigured: boolean; reload: () => void }) {
  const [s, setS] = useState<S>(initial);
  const { run, banner } = useAction();
  const save = (key: keyof S) => run(() => api.put(`admin/settings/${key}`, s[key]), "Settings saved.").then((ok) => ok && reload());
  const b = s.business;
  const setB = (patch: Partial<S["business"]>) => setS({ ...s, business: { ...b, ...patch } });
  const bk = s.booking;
  const setBk = (patch: Partial<S["booking"]>) => setS({ ...s, booking: { ...bk, ...patch } });

  return (
    <div className="space-y-8">
      {banner}
      <section className="card space-y-4 p-6" data-settings="business">
        <h3 className="text-2xl">Contact details &amp; business hours</h3>
        <p className="text-sm text-ink-muted">Shown on the Home and Contact pages. Leave blank until you're ready; the website shows "Coming soon".</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Phone<input name="phone" className="input mt-1" value={b.phone ?? ""} onChange={(e) => setB({ phone: e.target.value || null })} /></label>
          <label className="text-sm font-medium">Email<input name="email" type="email" className="input mt-1" value={b.email ?? ""} onChange={(e) => setB({ email: e.target.value || null })} /></label>
          <label className="text-sm font-medium">Street address<input name="address" className="input mt-1" value={b.address ?? ""} onChange={(e) => setB({ address: e.target.value || null })} /></label>
          <label className="text-sm font-medium">Map link (https://…)<input name="mapUrl" className="input mt-1" value={b.mapUrl ?? ""} onChange={(e) => setB({ mapUrl: e.target.value || null })} /></label>
          <label className="text-sm font-medium">Service area (English)<input className="input mt-1" value={b.area_en} onChange={(e) => setB({ area_en: e.target.value })} /></label>
          <label className="text-sm font-medium">Service area (Spanish)<input className="input mt-1" value={b.area_es} onChange={(e) => setB({ area_es: e.target.value })} /></label>
          <label className="text-sm font-medium">Time zone<input className="input mt-1" value={b.timezone} onChange={(e) => setB({ timezone: e.target.value })} /></label>
        </div>
        <div>
          <p className="label">Business hours (online booking only offers times inside these hours)</p>
          <div className="space-y-2">
            {DAYS.map((name, i) => {
              const h = b.hours[String(i)] ?? null;
              const published = Object.keys(b.hours).length > 0;
              return (
                <div key={name} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24">{name}</span>
                  <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-deep" checked={!!h} onChange={(e) => setB({ hours: { ...b.hours, [String(i)]: e.target.checked ? { open: "09:00", close: "17:00" } : null } })} />Open</label>
                  {h && <><input type="time" className="input w-32" value={h.open} onChange={(e) => setB({ hours: { ...b.hours, [String(i)]: { ...h, open: e.target.value } } })} />–<input type="time" className="input w-32" value={h.close} onChange={(e) => setB({ hours: { ...b.hours, [String(i)]: { ...h, close: e.target.value } } })} /></>}
                  {!h && published && <span className="text-ink-muted">Closed</span>}
                </div>
              );
            })}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => void save("business")}>Save contact details &amp; hours</button>
      </section>

      <section className="card space-y-4 p-6" data-settings="booking">
        <h3 className="text-2xl">Booking rules</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={bk.onlineBookingEnabled} onChange={(e) => setBk({ onlineBookingEnabled: e.target.checked })} />Online booking is on</label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["slotIntervalMinutes", "Start times every (minutes)"], ["bufferMinutes", "Cleanup time between clients (minutes)"], ["minNoticeHours", "Minimum notice (hours)"],
            ["maxDaysAhead", "Book up to (days ahead)"], ["cancellationWindowHours", "Online cancellation closes (hours before)"], ["rescheduleWindowHours", "Online rescheduling closes (hours before)"],
          ] as const).map(([k, label]) => (
            <label key={k} className="text-sm font-medium">{label}<input type="number" min={0} className="input mt-1" value={bk[k]} onChange={(e) => setBk({ [k]: Number(e.target.value) } as Partial<S["booking"]>)} /></label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={bk.newClientSameDayAllowed} onChange={(e) => setBk({ newClientSameDayAllowed: e.target.checked })} />Allow new clients to book for the same day</label>
        <button type="button" className="btn-primary" onClick={() => void save("booking")}>Save booking rules</button>
      </section>

      <section className="card space-y-4 p-6" data-settings="payments">
        <h3 className="text-2xl">Online payments</h3>
        {!paymentsConfigured && <Alert tone="info">Stripe isn't connected. Clients pay at their visit. To take deposits or full payment online, add the Stripe keys in Azure (see docs/AZURE_DEPLOYMENT.md, step 7).</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Collect online
            <select className="input mt-1" value={s.payments.mode} onChange={(e) => setS({ ...s, payments: { ...s.payments, mode: e.target.value as S["payments"]["mode"] } })}>
              <option value="none">Nothing (pay at visit)</option>
              <option value="deposit" disabled={!paymentsConfigured}>A deposit</option>
              <option value="full" disabled={!paymentsConfigured}>The full amount</option>
            </select>
          </label>
          <label className="text-sm font-medium">Deposit %<input type="number" min={1} max={100} className="input mt-1" value={s.payments.depositPercent} onChange={(e) => setS({ ...s, payments: { ...s.payments, depositPercent: Number(e.target.value) } })} /></label>
          <label className="text-sm font-medium">Hold time while paying (minutes)<input type="number" min={5} max={60} className="input mt-1" value={s.payments.holdMinutes} onChange={(e) => setS({ ...s, payments: { ...s.payments, holdMinutes: Number(e.target.value) } })} /></label>
        </div>
        <button type="button" className="btn-primary" onClick={() => void save("payments")}>Save payment settings</button>
      </section>

      <section className="card space-y-4 p-6" data-settings="content">
        <h3 className="text-2xl">Website content</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Announcement banner (English)<input className="input mt-1" value={s.content.announcement_en} onChange={(e) => setS({ ...s, content: { ...s.content, announcement_en: e.target.value } })} /></label>
          <label className="text-sm font-medium">Announcement banner (Spanish)<input className="input mt-1" value={s.content.announcement_es} onChange={(e) => setS({ ...s, content: { ...s.content, announcement_es: e.target.value } })} /></label>
          <label className="text-sm font-medium">Lotion policy (English)<textarea className="textarea mt-1" value={s.content.lotion_en} onChange={(e) => setS({ ...s, content: { ...s.content, lotion_en: e.target.value } })} /></label>
          <label className="text-sm font-medium">Lotion policy (Spanish)<textarea className="textarea mt-1" value={s.content.lotion_es} onChange={(e) => setS({ ...s, content: { ...s.content, lotion_es: e.target.value } })} /></label>
        </div>
        <button type="button" className="btn-primary" onClick={() => void save("content")}>Save website content</button>
      </section>

      <section className="card space-y-4 p-6" data-settings="notifications">
        <h3 className="text-2xl">Client messages</h3>
        <p className="text-sm text-ink-muted">Confirmation and cancellation messages are sent through Azure Communication Services once it's set up. They never include health details.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={s.notifications.emailEnabled} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, emailEnabled: e.target.checked } })} />Send email</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-deep" checked={s.notifications.smsEnabled} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, smsEnabled: e.target.checked } })} />Send text messages (to clients who opted in)</label>
        <button type="button" className="btn-primary" onClick={() => void save("notifications")}>Save message settings</button>
      </section>
    </div>
  );
}
