import { useState } from "react";
import { useAdmin, Loadable, when } from "./shared";

type C = { id: string; first_name: string; last_name: string; preferred_name: string | null; email: string | null; phone: string | null; created_at: string; visits: number; no_shows: number; last_visit: string | null; email_opt_in: boolean; sms_opt_in: boolean };

/** Contact and visit information only. Clinical records are visible to the treating therapist. */
export default function Clients() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const state = useAdmin<{ clients: C[] }>(`admin/clients?q=${encodeURIComponent(search)}`);
  return (
    <div className="space-y-5">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <input className="input max-w-md" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        <button className="btn-secondary" type="submit">Search</button>
      </form>
      <Loadable state={state}>
        {(d) => (
          <div className="overflow-x-auto">
            <table className="table-basic">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Visits</th><th>No-shows</th><th>Last visit</th><th>Messages</th><th>Since</th></tr></thead>
              <tbody>
                {d.clients.length === 0 && <tr><td colSpan={8} className="text-ink-muted">No clients yet.</td></tr>}
                {d.clients.map((c) => (
                  <tr key={c.id}>
                    <td>{c.first_name} {c.last_name}{c.preferred_name ? ` (${c.preferred_name})` : ""}</td>
                    <td>{c.email ?? "—"}</td><td>{c.phone ?? "—"}</td><td>{c.visits}</td><td>{c.no_shows}</td>
                    <td>{c.last_visit ? when(c.last_visit) : "—"}</td>
                    <td className="text-xs">{[c.email_opt_in && "email", c.sms_opt_in && "text"].filter(Boolean).join(", ") || "none"}</td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
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
