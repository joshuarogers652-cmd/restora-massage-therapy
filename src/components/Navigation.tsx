import { NavLink } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/utils/format";

export const NAV_LINKS = [
  { to: "/services", key: "nav.services" },
  { to: "/enhancements", key: "nav.enhancements" },
  { to: "/about", key: "nav.about" },
  { to: "/contact", key: "nav.contact" },
];

/** Main site links. `vertical` is used in the mobile menu. */
export function Navigation({ vertical = false, onNavigate }: { vertical?: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <ul className={cn(vertical ? "flex flex-col gap-1" : "flex items-center gap-1")}>
      {vertical && (
        <li>
          <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => cn("block rounded-xl px-4 py-3.5 text-lg font-medium hover:bg-brand-soft", isActive && "bg-brand-soft text-brand-deep")}>
            {t("nav.home")}
          </NavLink>
        </li>
      )}
      {NAV_LINKS.map((l) => (
        <li key={l.to}>
          <NavLink
            to={l.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                vertical ? "block rounded-xl px-4 py-3.5 text-lg font-medium" : "rounded-full px-4 py-2 text-[0.95rem] font-medium",
                "text-ink transition-colors hover:bg-brand-soft hover:text-brand-deep",
                isActive && "bg-brand-soft text-brand-deep",
              )
            }
          >
            {t(l.key)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
