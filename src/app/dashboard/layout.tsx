import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api, ApiClientError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string }[];
};

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/follows", label: "Following" },
  { href: "/dashboard/donations", label: "Donations" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/preferences", label: "Preferences" },
  { href: "/dashboard/account", label: "Account" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const cookieHeader = c
    .getAll()
    .map((x) => `${x.name}=${x.value}`)
    .join("; ");
  let me: Me;
  try {
    me = await api<Me>("/me/", { method: "GET", headers: { cookie: cookieHeader } });
  } catch (err) {
    if (err instanceof ApiClientError && err.code === "unauthorized") {
      redirect("/sign-in?next=/dashboard");
    }
    throw err;
  }
  if (!me.user) redirect("/sign-in?next=/dashboard");

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "2rem",
      }}
    >
      <aside>
        <h1 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
          {me.user.display_name}
        </h1>
        <nav aria-label="Dashboard">
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.25rem" }}>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  style={{
                    display: "block",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 8,
                    color: "#111827",
                    textDecoration: "none",
                  }}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
