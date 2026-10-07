import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { api, ApiClientError } from "@/lib/api";
import { DesignGallery } from "./DesignGallery";

export const dynamic = "force-dynamic";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  assignments: { role: string }[];
};

export default async function DesignPage() {
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
      redirect("/sign-in?next=/admin/_design");
    }
    throw err;
  }

  const isFounder = me.assignments.some((a) => a.role === "founder");
  if (!isFounder) redirect("/admin");

  return <DesignGallery />;
}
