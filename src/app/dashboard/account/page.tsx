"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type EmailRow = {
  id: string;
  email: string;
  primary: boolean;
  verified: boolean;
  added_at: string;
};

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const loadEmails = useCallback(async () => {
    try {
      setEmails(await api<EmailRow[]>("/me/emails"));
    } catch {
      // non-fatal; render without the section
    }
  }, []);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  // Auto-redeem a ?verify_email=TOKEN query once on mount.
  useEffect(() => {
    const token = search?.get("verify_email");
    if (!token) return;
    void (async () => {
      try {
        const r = await api<{ email: string; linked_donations: number }>(
          "/me/emails/verify",
          { json: { token } },
        );
        toast.push({
          tone: "success",
          message:
            r.linked_donations > 0
              ? `Email verified — linked ${r.linked_donations} prior donation${r.linked_donations === 1 ? "" : "s"}.`
              : "Email verified.",
        });
      } catch (e) {
        toast.push({ tone: "danger", message: (e as ApiClientError).message });
      } finally {
        // Strip the token from the URL and refresh the list.
        router.replace("/dashboard/account");
        void loadEmails();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEmail() {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await api("/me/emails", { json: { email: newEmail.trim() } });
      toast.push({
        tone: "success",
        message: "Check that inbox for a confirmation link.",
      });
      setNewEmail("");
      void loadEmails();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setAdding(false);
    }
  }

  async function removeEmail(id: string) {
    try {
      await api(`/me/emails/${id}`, { method: "DELETE" });
      toast.push({ tone: "success", message: "Email removed" });
      void loadEmails();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function requestExport() {
    try {
      const res = await fetch("/api/v1/me/export", { credentials: "same-origin" });
      if (!res.ok) {
        toast.push({ tone: "danger", message: "Export failed" });
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
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  async function deleteAccount() {
    try {
      const r = await api<{ due_at: string }>("/me/delete", {
        json: { confirm_email: confirmEmail },
      });
      setDue(r.due_at);
      toast.push({ tone: "success", message: "Deletion scheduled" });
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function cancelDeletion() {
    try {
      await api("/me/delete/cancel", { json: {} });
      setDue(null);
      toast.push({ tone: "success", message: "Deletion cancelled" });
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  return (
    <Page>
      <Header>
        <Eyebrow>Account</Eyebrow>
        <Title>Your account</Title>
        <Lede>
          Manage the email addresses connected to your account, export your data, or
          close your supporter account.
        </Lede>
      </Header>

      <Grid>
        <Card>
          <CardHead>
            <h2>Email addresses</h2>
            <p>
              Donations sent to any <em>verified</em> address on this list are linked to
              your account automatically.
            </p>
          </CardHead>

          {emails === null ? (
            <Muted>Loading…</Muted>
          ) : (
            <EmailList>
              {emails.map((e) => (
                <EmailItem key={e.id}>
                  <EmailMain>
                    <EmailAddr>{e.email}</EmailAddr>
                    <Badges>
                      {e.primary ? <Badge $tone="blue">Primary</Badge> : null}
                      {e.verified ? (
                        <Badge $tone="green">Verified</Badge>
                      ) : (
                        <Badge $tone="warn">Pending</Badge>
                      )}
                    </Badges>
                  </EmailMain>
                  {!e.primary ? (
                    <RemoveBtn type="button" onClick={() => removeEmail(e.id)}>
                      Remove
                    </RemoveBtn>
                  ) : null}
                </EmailItem>
              ))}
            </EmailList>
          )}

          <AddRow>
            <Input
              value={newEmail}
              onChange={(ev) => setNewEmail(ev.target.value)}
              type="email"
              placeholder="work@example.com"
              aria-label="New email address"
            />
            <PrimaryBtn type="button" onClick={addEmail} disabled={adding || !newEmail}>
              {adding ? "Sending…" : "Add email"}
            </PrimaryBtn>
          </AddRow>
          <Hint>
            We&apos;ll email a confirmation link to the address. It&apos;s only linked
            after you click it.
          </Hint>
        </Card>

        <Card>
          <CardHead>
            <h2>Export your data</h2>
            <p>
              Download everything we hold about you on the public side — profile, follows,
              donations, notifications — as a JSON file.
            </p>
          </CardHead>
          <PrimaryBtn type="button" onClick={requestExport}>
            Download my data
          </PrimaryBtn>
        </Card>
      </Grid>

      <DangerCard>
        <CardHead>
          <h2>Delete your account</h2>
          <p>
            Scheduling deletion suspends your sign‑in immediately and hard‑deletes your
            profile after 30 days. Donations themselves are retained for audit; the link
            to your account is removed.
          </p>
        </CardHead>

        {due ? (
          <>
            <ScheduledNote>
              Deletion scheduled for <strong>{new Date(due).toLocaleString()}</strong>.
            </ScheduledNote>
            <GhostBtn type="button" onClick={cancelDeletion}>
              Cancel deletion
            </GhostBtn>
          </>
        ) : (
          <DeleteRow>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              type="email"
              placeholder="Type your email to confirm"
            />
            <DangerBtn
              type="button"
              onClick={deleteAccount}
              disabled={!confirmEmail}
            >
              Schedule deletion
            </DangerBtn>
          </DeleteRow>
        )}
      </DangerCard>
    </Page>
  );
}

/* ===================== styles ===================== */

const Page = styled.section`
  display: grid;
  gap: 1.5rem;
`;

const Header = styled.div`
  display: grid;
  gap: 0.3rem;
`;

const Eyebrow = styled.div`
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-weight: 700;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.6rem, 2vw + 1rem, 2.2rem);
  margin: 0;
  color: ${({ theme }) => theme.colors.trustBlue};
`;

const Lede = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.95rem;
  max-width: 60ch;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;

  @media (min-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  padding: 1.25rem 1.3rem;
  display: grid;
  gap: 0.9rem;
`;

const DangerCard = styled(Card)`
  border-color: #fecaca;
  background: #fff8f8;
`;

const CardHead = styled.div`
  display: grid;
  gap: 0.2rem;

  h2 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.88rem;
    line-height: 1.5;
  }
`;

const EmailList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
`;

const EmailItem = styled.li`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const EmailMain = styled.div`
  display: grid;
  gap: 0.3rem;
  min-width: 0;
`;

const EmailAddr = styled.div`
  color: ${({ theme }) => theme.colors.ink};
  font-weight: 600;
  font-size: 0.92rem;
  word-break: break-all;
`;

const Badges = styled.div`
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
`;

const Badge = styled.span<{ $tone: "blue" | "green" | "warn" }>`
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  background: ${({ $tone }) =>
    $tone === "blue"
      ? "rgba(16, 61, 122, 0.1)"
      : $tone === "green"
        ? "rgba(34, 197, 94, 0.14)"
        : "rgba(245, 158, 11, 0.15)"};
  color: ${({ $tone }) =>
    $tone === "blue" ? "#103D7A" : $tone === "green" ? "#15803D" : "#92400E"};
`;

const RemoveBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: #fff;
  color: #991b1b;
  border: 1px solid #fecaca;
  font-size: 0.78rem;
  font-weight: 600;

  &:hover,
  &:focus-visible {
    background: #fef2f2;
  }
`;

const AddRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: #fff;
  color: ${({ theme }) => theme.colors.ink};
  font-size: 0.92rem;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 1px;
    border-color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const PrimaryBtn = styled.button`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #1a0f00;
  font-weight: 700;
  font-size: 0.88rem;
  box-shadow: ${({ theme }) => theme.shadow.glow};
  white-space: nowrap;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const GhostBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  background: #fff;
  color: ${({ theme }) => theme.colors.trustBlue};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: 600;
  font-size: 0.88rem;
  width: fit-content;

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const DangerBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  background: #991b1b;
  color: #fff;
  border: none;
  font-weight: 700;
  font-size: 0.88rem;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Hint = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.8rem;
`;

const Muted = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.9rem;
`;

const DeleteRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ScheduledNote = styled.p`
  margin: 0 0 0.5rem;
  color: ${({ theme }) => theme.colors.ink};
  font-size: 0.95rem;
`;
