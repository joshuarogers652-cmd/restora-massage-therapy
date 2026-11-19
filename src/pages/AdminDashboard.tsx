import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { cn } from "@/utils/format";
import Overview from "@/components/admin/Overview";
import Appointments from "@/components/admin/Appointments";
import Clients from "@/components/admin/Clients";
import ServicesAdmin from "@/components/admin/Services";
import TherapistsAdmin from "@/components/admin/Therapists";
import SettingsAdmin from "@/components/admin/Settings";
import { GiftCards, Payments, Promotions, Reports } from "@/components/admin/Commerce";
import { AuditLog, Messages, RecordsRequests, TimeOff, Users } from "@/components/admin/Inbox";

// Staff screens are in English. Office managers see scheduling and front-desk tools;
// administrators also manage pricing, settings, staff roles, refunds and the audit log.
const TABS = [
  { id: "overview", label: "Overview", admin: false },
  { id: "appointments", label: "Appointments", admin: false },
  { id: "time-off", label: "Time off & closures", admin: false },
  { id: "clients", label: "Clients", admin: false },
  { id: "therapists", label: "Therapists", admin: false },
  { id: "services", label: "Services & pricing", admin: false },
  { id: "promotions", label: "Promotions", admin: false },
  { id: "gift-cards", label: "Gift cards", admin: false },
  { id: "payments", label: "Payments", admin: false },
  { id: "messages", label: "Messages", admin: false },
  { id: "reports", label: "Reports", admin: true },
  { id: "records", label: "Records requests", admin: true },
  { id: "users", label: "Users & roles", admin: true },
  { id: "settings", label: "Settings", admin: true },
  { id: "audit", label: "Audit log", admin: true },
] as const;

export default function AdminDashboard() {
  const { me } = useAuth();
  const { catalog } = useCatalog();
  const isAdmin = !!me?.user.roles.includes("admin");
  const tabs = TABS.filter((t) => !t.admin || isAdmin);
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((t) => t.id === params.get("tab"))?.id ?? "overview";
  const tz = catalog?.settings.business.timezone ?? "America/Chicago";

  return (
    <div className="container-page py-10 sm:py-14">
      <p className="eyebrow">{isAdmin ? "Administrator" : "Office manager"}</p>
      <h1 className="text-4xl">Business dashboard</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Dashboard sections">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {tabs.map((t) => (
              <li key={t.id} className="shrink-0">
                <button type="button" onClick={() => setParams({ tab: t.id })} aria-current={tab === t.id ? "page" : undefined}
                  className={cn("w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium", tab === t.id ? "bg-brand-deep text-white" : "text-ink hover:bg-brand-soft")}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <h2 className="mb-6 text-3xl">{tabs.find((t) => t.id === tab)?.label}</h2>
          {tab === "overview" && <Overview />}
          {tab === "appointments" && <Appointments tz={tz} />}
          {tab === "time-off" && <TimeOff />}
          {tab === "clients" && <Clients />}
          {tab === "therapists" && <TherapistsAdmin canEdit={isAdmin} />}
          {tab === "services" && <ServicesAdmin canEdit={isAdmin} />}
          {tab === "promotions" && <Promotions canEdit={isAdmin} />}
          {tab === "gift-cards" && <GiftCards canEdit={isAdmin} />}
          {tab === "payments" && <Payments canRefund={isAdmin} />}
          {tab === "messages" && <Messages />}
          {tab === "reports" && <Reports />}
          {tab === "records" && <RecordsRequests />}
          {tab === "users" && me && <Users myId={me.user.id} />}
          {tab === "settings" && <SettingsAdmin />}
          {tab === "audit" && <AuditLog />}
        </div>
      </div>
    </div>
  );
}
