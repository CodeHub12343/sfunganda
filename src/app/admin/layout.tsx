import "@/styles/admin-tokens.css";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api, ApiClientError } from "@/lib/api";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string; scope_type: string; scope_id: string | null }[];
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const cookieHeader = c
    .getAll()
    .map((x) => `${x.name}=${x.value}`)
    .join("; ");

  let me: Me;
  try {
    me = await api<Me>("/me", { method: "GET", headers: { cookie: cookieHeader } });
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.code === "mfa_required") redirect("/mfa?next=/admin");
      if (err.code === "unauthorized") redirect("/sign-in?next=/admin");
    }
    throw err;
  }

  if (!me.user) redirect("/sign-in?next=/admin");
  // Policy on the server already blocks admin actions without MFA; still,
  // bounce staff to /mfa so the shell is not even rendered to a half-authed
  // actor.
  if (!me.session.mfa_verified) {
    // Supporter role doesn't need MFA; everyone else does.
    const staff = me.assignments.some((a) =>
      ["founder", "director", "project_manager", "finance_manager", "media_manager", "field_member"].includes(a.role)
    );
    if (staff) redirect("/mfa?next=/admin");
  }

  const allowed = me.assignments.some((a) =>
    ["founder", "director", "project_manager", "finance_manager", "media_manager"].includes(a.role)
  );
  if (!allowed) redirect("/");

  return <AdminShell me={me}>{children}</AdminShell>;
}
