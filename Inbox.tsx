import { api } from "@/services/api";
import { useAdmin, Loadable, useAction, when } from "./shared";

type Msg = { id: string; name: string; email: string; phone: string | null; topic: string; message: string; locale: string; created_at: string; handled_at: string | null };
export function Messages() {
  const state = useAdmin<{ messages: Msg[] }>("admin/messages");
  const { run, banner } = useAction();
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-3">
          {banner}
          {d.messages.length === 0 && <p className="text-ink-muted">No messages yet.</p>}
          {d.messages.map((m) => (
            <article key={m.id} className={`card space-y-2 p-5 ${m.handled_at ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{m.name} · <a className="text-brand-royal underline" href={`mailto:${m.email}`}>{m.email}</a>{m.phone ? ` · ${m.phone}` : ""}</p>
                <p className="text-sm text-ink-muted">{when(m.created_at)} · {m.topic} · {m.locale === "es" ? "Spanish" : "English"}</p>
              </div>
              <p className="whitespace-pre-wrap">{m.message}</p>
              {!m.handled_at && <button type="button" className="btn-secondary btn-sm" onClick={async () => { if (await run(() => api.post(`admin/messages/${m.id}/handled`), "Marked as handled.")) state.reload(); }}>Mark handled</button>}
            </article>
          ))}
        </div>
      )}
    </Loadable>
  );
}

type Req = { id: string; details: string; created_at: string; fulfilled_at: string | null; notes: string | null; first_name: string; last_name: string; email: string | null };
export function RecordsRequests() {
  const state = useAdmin<{ requests: Req[] }>("admin/records-requests");
  const { run, banner } = useAction();
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-3">
          {banner}
          <p className="text-sm text-ink-muted">Respond within the time Texas law requires (see docs/ADMIN_GUIDE.md). Verify the client's identity before sending records.</p>
          {d.requests.length === 0 && <p className="text-ink-muted">No records requests.</p>}
          {d.requests.map((r) => (
            <article key={r.id} className="card space-y-2 p-5">
              <p className="font-semibold">{r.first_name} {r.last_name} · {r.email} · {when(r.created_at)}</p>
              <p>{r.details}</p>
              {r.fulfilled_at ? <p className="text-sm text-go-ink">Completed {when(r.fulfilled_at)} — {r.notes}</p> : (
                <button type="button" className="btn-secondary btn-sm" onClick={async () => {
                  const notes = window.prompt("How was this request fulfilled? (for example: 'PDF of SOAP notes emailed after ID check')");
                  if (notes && (await run(() => api.post(`admin/records-requests/${r.id}/fulfil`, { notes }), "Marked complete."))) state.reload();
                }}>Mark completed</button>
              )}
            </article>
          ))}
        </div>
      )}
    </Loadable>
  );
}

type U = { id: string; email: string | null; identity_provider: string; created_at: string; last_login_at: string | null; roles: string[] };
const ROLES = ["client", "therapist", "office_manager", "admin"];
export function Users({ myId }: { myId: string }) {
  const state = useAdmin<{ users: U[] }>("admin/users");
  const { run, banner } = useAction();
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="space-y-4">
          {banner}
          <p className="text-sm text-ink-muted">Everyone who has signed in. Give staff the role they need and nothing more. Office managers handle scheduling and payments but can't read clinical notes.</p>
          <table className="table-basic">
            <thead><tr><th>Email</th><th>Last sign-in</th>{ROLES.map((r) => <th key={r}>{r.replace("_", " ")}</th>)}</tr></thead>
            <tbody>
              {d.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ?? "(no email)"}</td><td>{when(u.last_login_at)}</td>
                  {ROLES.map((r) => (
                    <td key={r}>
                      <input type="checkbox" aria-label={`${r} for ${u.email}`} className="h-4 w-4 accent-brand-deep" checked={u.roles.includes(r)} disabled={u.id === myId && r === "admin"}
                        onChange={async () => {
                          const roles = u.roles.includes(r) ? u.roles.filter((x) => x !== r) : [...u.roles, r];
                          if (await run(() => api.put(`admin/users/${u.id}/roles`, { roles }), "Roles updated.")) state.reload();
                        }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Loadable>
  );
}

type L = { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; actor: string | null };
export function AuditLog() {
  const state = useAdmin<{ entries: L[] }>("admin/audit");
  return (
    <Loadable state={state}>
      {(d) => (
        <div className="overflow-x-auto">
          <p className="mb-3 text-sm text-ink-muted">The latest 300 entries. Every view and change of clinical records is recorded. Entries can't be edited or deleted.</p>
          <table className="table-basic">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
            <tbody>{d.entries.map((e) => <tr key={e.id}><td className="whitespace-nowrap">{when(e.created_at)}</td><td>{e.actor ?? "system"}</td><td className="font-mono text-xs">{e.action}</td><td className="text-xs">{e.entity_type} {e.entity_id?.slice(0, 8)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Loadable>
  );
}

type Off = { id: string; therapist_id: string | null; display_name: string | null; starts_at: string; ends_at: string; reason: string | null };
export function TimeOff() {
  const state = useAdmin<{ timeOff: Off[] }>("admin/time-off");
  const therapists = useAdmin<{ therapists: { id: string; display_name: string }[] }>("admin/therapists");
  const { run, banner } = useAction();
  return (
    <div className="space-y-5">
      {banner}
      <form className="card grid gap-3 p-5 md:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = { therapistId: (fd.get("therapist") as string) || null, startsAt: new Date(fd.get("start") as string).toISOString(), endsAt: new Date(fd.get("end") as string).toISOString(), reason: fd.get("reason") };
        if (await run(() => api.post("admin/time-off", body), "Blocked time added.")) state.reload();
      }}>
        <label className="text-sm font-medium">Who<select name="therapist" className="input mt-1"><option value="">Whole business (holiday)</option>{therapists.data?.therapists.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select></label>
        <label className="text-sm font-medium">From<input name="start" type="datetime-local" required className="input mt-1" /></label>
        <label className="text-sm font-medium">To<input name="end" type="datetime-local" required className="input mt-1" /></label>
        <label className="text-sm font-medium">Reason<input name="reason" className="input mt-1" /></label>
        <button type="submit" className="btn-primary md:w-fit">Block this time</button>
      </form>
      <Loadable state={state}>
        {(d) => (
          <table className="table-basic">
            <thead><tr><th>Who</th><th>From</th><th>To</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {d.timeOff.length === 0 && <tr><td colSpan={5} className="text-ink-muted">No blocked time.</td></tr>}
              {d.timeOff.map((o) => <tr key={o.id}><td>{o.display_name ?? "Whole business"}</td><td>{when(o.starts_at)}</td><td>{when(o.ends_at)}</td><td>{o.reason}</td>
                <td><button type="button" className="btn-ghost btn-sm" onClick={async () => { if (await run(() => api.del(`admin/time-off/${o.id}`), "Removed.")) state.reload(); }}>Remove</button></td></tr>)}
            </tbody>
          </table>
        )}
      </Loadable>
    </div>
  );
}
