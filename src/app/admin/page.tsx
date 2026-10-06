import { cookies } from "next/headers";
import { api } from "@/lib/api";
import { OverviewClient } from "./OverviewClient";

export const dynamic = "force-dynamic";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  assignments: { role: string }[];
};

export default async function AdminHome() {
  const c = await cookies();
  const cookieHeader = c
    .getAll()
    .map((x) => `${x.name}=${x.value}`)
    .join("; ");

  // Non-fatal: if /me fails for the page, the layout has already redirected.
  let me: Me | null = null;
  try {
    me = await api<Me>("/me", { method: "GET", headers: { cookie: cookieHeader } });
  } catch {
    me = null;
  }

  return (
    <OverviewClient
      userName={me?.user?.display_name ?? "there"}
      roles={me?.assignments.map((a) => a.role) ?? []}
    />
  );
}
