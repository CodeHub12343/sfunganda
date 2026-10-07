import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api, ApiClientError } from "@/lib/api";
import { DashboardShell } from "./DashboardShell";

export const dynamic = "force-dynamic";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string }[];
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const cookieHeader = c
    .getAll()
    .map((x) => `${x.name}=${x.value}`)
    .join("; ");
  let me: Me;
  try {
    me = await api<Me>("/me", { method: "GET", headers: { cookie: cookieHeader } });
  } catch (err) {
    if (err instanceof ApiClientError && err.code === "unauthorized") {
      redirect("/sign-in?next=/dashboard");
    }
    throw err;
  }
  if (!me.user) redirect("/sign-in?next=/dashboard");

  return <DashboardShell me={{ user: me.user }}>{children}</DashboardShell>;
}
