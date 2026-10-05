"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [due, setDue] = useState<string | null>(null);

  async function requestExport() {
    try {
      const res = await fetch("/api/v1/me/export", { credentials: "same-origin" });
      if (!res.ok) {
        toast.show("Export failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sfu-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  async function deleteAccount() {
    try {
      const r = await api<{ due_at: string }>("/me/delete", {
        json: { confirm_email: confirmEmail },
      });
      setDue(r.due_at);
      toast.show("Deletion scheduled", "ok");
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  async function cancelDeletion() {
    try {
      await api("/me/delete/cancel", { json: {} });
      setDue(null);
      toast.show("Deletion cancelled", "ok");
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  async function signOut() {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <h1>Account</h1>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Export your data</h2>
        <p style={{ color: "#6b7280" }}>
          Download everything we hold about you on the public side (profile, follows, donations,
          notifications) as a JSON file.
        </p>
        <Button onClick={requestExport}>Download my data</Button>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Delete your account</h2>
        <p>
          Scheduling deletion suspends your sign-in immediately and hard-deletes your profile after
          30 days. Donations themselves are retained for audit, but we remove the link to your
          account.
        </p>
        {due ? (
          <div>
            <p>
              Deletion scheduled for <strong>{new Date(due).toLocaleString()}</strong>.
            </p>
            <Button variant="ghost" onClick={cancelDeletion}>
              Cancel deletion
            </Button>
          </div>
        ) : (
          <>
            <label>
              <span style={{ display: "block", color: "#6b7280", fontSize: "0.85rem" }}>
                Type your email to confirm
              </span>
              <input
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                type="email"
                style={{ padding: "0.6rem", border: "1px solid #e5e7eb", borderRadius: 6, width: "100%" }}
              />
            </label>
            <div style={{ marginTop: "0.75rem" }}>
              <Button variant="ghost" onClick={deleteAccount} disabled={!confirmEmail}>
                Schedule deletion
              </Button>
            </div>
          </>
        )}
      </section>

      <section style={card}>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </section>
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
};
