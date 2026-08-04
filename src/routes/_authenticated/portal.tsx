import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShoppingBag, UserRound } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/_authenticated/portal")({
  component: PortalLayout,
});

const links = [
  { to: "/portal", label: "My Orders", icon: ShoppingBag, exact: true },
  { to: "/portal/profile", label: "Profile", icon: UserRound, exact: false },
] as const;

function PortalLayout() {
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <nav className="mb-6 flex gap-1 overflow-x-auto">
          {links.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              activeProps={{ className: "bg-primary/10 text-primary" }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </PublicLayout>
  );
}
