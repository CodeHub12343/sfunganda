import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api, ApiClientError } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Field — Sarah's Foundation",
  manifest: "/field/manifest.webmanifest",
};

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string }[];
};

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const cookieHeader = c
    .getAll()
    .map((x) => `${x.name}=${x.value}`)
    .join("; ");
  let me: Me;
  try {
    me = await api<Me>("/me/", { method: "GET", headers: { cookie: cookieHeader } });
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.code === "mfa_required") redirect("/mfa?next=/field");
      if (err.code === "unauthorized") redirect("/sign-in?next=/field");
    }
    throw err;
  }
  if (!me.user) redirect("/sign-in?next=/field");
  const ok = me.assignments.some((a) =>
    ["founder", "director", "project_manager", "field_member"].includes(a.role)
  );
  if (!ok) redirect("/");
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "1.5rem 1rem 3rem",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Field</h1>
        <small style={{ color: "#6b7280" }}>Capture accomplishments from the field.</small>
      </header>
      {children}
    </div>
  );
}
