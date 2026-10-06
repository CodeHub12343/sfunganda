"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Modal,
  SegmentedControl,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Org = {
  id: string;
  slug: string;
  name: string;
  base_currency: string;
  branding: {
    display_name: string;
    tagline: string;
    hero_markdown: string;
    accent_color: string;
    footer_line: string;
  };
  domains: string[];
  inter_org: {
    send_enabled: boolean;
    receive_enabled: boolean;
    allowed_recipient_slugs: string[];
  };
  version?: number;
};

type Transfer = {
  _id: string;
  id?: string;
  from_organization_id: string;
  to_organization_id: string;
  amount_cents: number;
  currency: string;
  state: "pending" | "posted" | "failed" | "cancelled";
  memo: string | null;
  initiated_by: string;
  initiated_at: string;
  posted_at: string | null;
  failure_reason: string | null;
  initiator_name?: string | null;
  approver_name?: string | null;
  to_slug?: string | null;
};

type TransferOption = {
  slug: string;
  name: string;
  funds: { id: string; name: string }[];
};

type FromFund = { id: string; name: string };

type RoleRow = {
  role: string;
  permissions: string[];
};

export default function AdminOrganization() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileOrg /> : <LegacyOrg />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const TABS = [
  { value: "identity" as const, label: "Identity" },
  { value: "team" as const, label: "Team" },
  { value: "transfers" as const, label: "Transfers" },
  { value: "danger" as const, label: "Danger zone" },
];
type Tab = (typeof TABS)[number]["value"];

// A fixed roles×permissions matrix. Mirrors `src/lib/policy` conceptually; the
// server remains the source of truth for authorisation checks.
const ROLE_MATRIX: RoleRow[] = [
  {
    role: "founder",
    permissions: ["everything"],
  },
  { role: "director", permissions: ["projects.*", "finance.*", "media.*", "social.*"] },
  { role: "project_manager", permissions: ["projects.*", "accomplishments.*", "media.read"] },
  { role: "finance_manager", permissions: ["finance.*", "reports.*"] },
  { role: "media_manager", permissions: ["media.*", "social.compose"] },
  { role: "field_member", permissions: ["production.submit", "accomplishments.submit"] },
  { role: "safeguarding_lead", permissions: ["beneficiaries.*"] },
];

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const IdentityCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const Logo = styled.div<{ $color: string }>`
  width: 48px;
  height: 48px;
  border-radius: var(--am-radius-md);
  background: ${({ $color }) => $color};
  color: var(--am-ink-on-brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
`;

const Mono = styled.code`
  font-family: var(--am-font-mono, monospace);
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;

const Input = styled.input`
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
`;

const Textarea = styled.textarea`
  min-height: 100px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
  resize: vertical;
`;

const MatrixWrap = styled(Card)`
  padding: 0;
  overflow-x: auto;
`;

const Matrix = styled.table`
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--am-border);
    vertical-align: top;
  }
  th {
    font-size: 12px;
    color: var(--am-ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td.role {
    font-weight: 600;
    color: var(--am-ink);
    text-transform: capitalize;
  }
`;

const Stepper = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
`;

const Dot = styled.span<{ $filled: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: var(--am-radius-pill);
  background: ${({ $filled }) =>
    $filled ? "var(--am-success-600)" : "var(--am-border-strong)"};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
`;

const Line = styled.span<{ $filled: boolean }>`
  height: 2px;
  background: ${({ $filled }) =>
    $filled ? "var(--am-success-600)" : "var(--am-border)"};
  display: block;
`;

const DangerBlock = styled(Card)`
  border: 1px solid var(--am-danger-200, #fecaca);
  background: var(--am-danger-50, #fef2f2);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  ${amMedia.md} {
    grid-template-columns: repeat(4, 1fr);
  }
`;

function money(cents: number, ccy: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: ccy });
  } catch {
    return `${ccy} ${(cents / 100).toFixed(2)}`;
  }
}

function stateTone(s: Transfer["state"]): "success" | "warning" | "danger" | "neutral" {
  if (s === "posted") return "success";
  if (s === "pending") return "warning";
  if (s === "failed") return "danger";
  return "neutral";
}

function MobileOrg() {
  const toast = useAdminToast();
  const [tab, setTab] = useState<Tab>("identity");
  const [org, setOrg] = useState<Org | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [domainsOpen, setDomainsOpen] = useState(false);
  const [interOrgOpen, setInterOrgOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferOptions, setTransferOptions] = useState<TransferOption[]>([]);
  const [fromFunds, setFromFunds] = useState<FromFund[]>([]);
  const [confirmDanger, setConfirmDanger] = useState<null | {
    action: "disable-send" | "disable-receive" | "clear-allowlist";
    subject: string;
    consequence: string;
    run: () => Promise<void>;
  }>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setOrg(await api<Org>("/admin/organization"));
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      const [rows, opts] = await Promise.all([
        api<Transfer[]>("/admin/organization/transfers"),
        api<{ receivers: TransferOption[]; from_funds: FromFund[] }>(
          "/admin/organization/transfers/options"
        ).catch(() => ({ receivers: [], from_funds: [] })),
      ]);
      setTransfers(rows);
      setTransferOptions(opts.receivers ?? []);
      setFromFunds(opts.from_funds ?? []);
    } catch {
      // Non-fatal — the Transfers tab shows its own banner on failure.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "transfers") void loadTransfers();
  }, [tab, loadTransfers]);

  async function patch(path: string, body: unknown, successMsg = "Saved") {
    try {
      await api(path, { method: "PATCH", json: body });
      toast.push({ tone: "success", message: successMsg });
      await load();
      return true;
    } catch (e) {
      toast.push({
        tone: "danger",
        message: (e as ApiClientError).message,
      });
      return false;
    }
  }

  async function initiateTransfer(body: unknown) {
    try {
      await api("/admin/organization/transfers", { json: body });
      toast.push({ tone: "success", message: "Transfer initiated." });
      setTransferOpen(false);
      await loadTransfers();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (err) return <ErrorState message={err} retry={load} />;

  return (
    <Page>
      <PageTitle>Organisation</PageTitle>

      {!org ? (
        <>
          <Skeleton height={44} />
          <Skeleton height={160} />
        </>
      ) : (
        <>
          <SegmentedControl label="Settings tab" options={TABS} value={tab} onChange={(v) => setTab(v)} />

          {tab === "identity" && (
            <>
              <IdentityCard>
                <Row>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Logo $color={org.branding.accent_color || "var(--am-brand-600)"}>
                      {(org.branding.display_name || org.name)
                        .split(/\s+/)
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Logo>
                    <div>
                      <strong>{org.branding.display_name || org.name}</strong>
                      <div style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>
                        {org.branding.tagline || "—"}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setBrandingOpen(true)}>
                    Edit
                  </Button>
                </Row>
                <Row>
                  <span style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Slug</span>
                  <Mono>{org.slug}</Mono>
                </Row>
                <Row>
                  <span style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Base currency</span>
                  <Badge tone="info">{org.base_currency}</Badge>
                </Row>
                <Row>
                  <span style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Domains</span>
                  <Button variant="ghost" size="sm" onClick={() => setDomainsOpen(true)}>
                    {org.domains.length} host{org.domains.length === 1 ? "" : "s"}
                  </Button>
                </Row>
              </IdentityCard>

              <StatRow>
                <Card padding="sm">
                  <strong style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>Billing</strong>
                  <div style={{ fontSize: 14 }}>Manage via Stripe dashboard.</div>
                </Card>
                <Card padding="sm">
                  <strong style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>Hero</strong>
                  <div style={{ fontSize: 14 }}>
                    {org.branding.hero_markdown
                      ? `${org.branding.hero_markdown.slice(0, 60)}${org.branding.hero_markdown.length > 60 ? "…" : ""}`
                      : "Not set"}
                  </div>
                </Card>
                <Card padding="sm">
                  <strong style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>Footer</strong>
                  <div style={{ fontSize: 14 }}>
                    {org.branding.footer_line || "Default"}
                  </div>
                </Card>
                <Card padding="sm">
                  <strong style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>Accent</strong>
                  <div
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      fontSize: 14,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: org.branding.accent_color || "#000",
                        display: "inline-block",
                      }}
                    />
                    <Mono>{org.branding.accent_color || "—"}</Mono>
                  </div>
                </Card>
              </StatRow>
            </>
          )}

          {tab === "team" && (
            <>
              <Card>
                <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 15 }}>Team</h3>
                <p style={{ margin: 0, color: "var(--am-ink-muted)", fontSize: 13 }}>
                  Users are managed in a dedicated section.
                </p>
                <div style={{ marginTop: 10 }}>
                  <NextLink href="/admin/users" style={{ textDecoration: "none" }}>
                    <Button variant="secondary" size="sm">
                      Open Users →
                    </Button>
                  </NextLink>
                </div>
              </Card>
              <h3 style={{ margin: 0, fontSize: 14, color: "var(--am-ink-muted)" }}>
                Roles &amp; permissions
              </h3>
              <MatrixWrap>
                <Matrix>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_MATRIX.map((r) => (
                      <tr key={r.role}>
                        <td className="role">{r.role.replace(/_/g, " ")}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {r.permissions.map((p) => (
                              <Badge key={p} tone="neutral">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Matrix>
              </MatrixWrap>
            </>
          )}

          {tab === "transfers" && (
            <>
              <Card>
                <Row>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Inter-org transfers</h3>
                    <div style={{ fontSize: 13, color: "var(--am-ink-muted)", marginTop: 2 }}>
                      Pay-it-forward between organisations. Both sides must opt in.
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setInterOrgOpen(true)}>
                    Settings
                  </Button>
                </Row>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Badge tone={org.inter_org.send_enabled ? "success" : "neutral"}>
                    Sending {org.inter_org.send_enabled ? "on" : "off"}
                  </Badge>
                  <Badge tone={org.inter_org.receive_enabled ? "success" : "neutral"}>
                    Receiving {org.inter_org.receive_enabled ? "on" : "off"}
                  </Badge>
                  <Badge tone="info">
                    {org.inter_org.allowed_recipient_slugs.length === 0
                      ? "No allow-list (any sender)"
                      : `${org.inter_org.allowed_recipient_slugs.length} allowed sender(s)`}
                  </Badge>
                </div>
              </Card>

              <Row>
                <h3 style={{ margin: 0, fontSize: 14, color: "var(--am-ink-muted)" }}>
                  Recent transfers
                </h3>
                <Button
                  size="sm"
                  onClick={() => setTransferOpen(true)}
                  disabled={!org.inter_org.send_enabled}
                >
                  + New transfer
                </Button>
              </Row>
              {transfers.length === 0 ? (
                <Card padding="none">
                  <EmptyState
                    title="No transfers yet"
                    description={
                      org.inter_org.send_enabled
                        ? "Initiate a transfer to another organisation."
                        : "Enable sending in settings to initiate transfers."
                    }
                  />
                </Card>
              ) : (
                <Card padding="none">
                  {transfers.map((t) => {
                    const posted = t.state === "posted";
                    return (
                      <div
                        key={t._id || t.id}
                        style={{
                          padding: 14,
                          borderTop: "1px solid var(--am-border)",
                        }}
                      >
                        <Row>
                          <div style={{ minWidth: 0 }}>
                            <strong>
                              → {t.to_slug ?? t.to_organization_id.slice(-6)}
                            </strong>
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--am-ink-muted)",
                                marginTop: 2,
                              }}
                            >
                              {new Date(t.initiated_at).toLocaleString()}
                              {t.memo ? ` · ${t.memo}` : ""}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 4,
                            }}
                          >
                            <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                              {money(t.amount_cents, t.currency)}
                            </strong>
                            <Badge tone={stateTone(t.state)}>{t.state}</Badge>
                          </div>
                        </Row>
                        {/* Two-signer stepper: initiator → recipient-side post */}
                        <Stepper aria-label="Two-signer approval">
                          <Dot $filled>✓</Dot>
                          <Line $filled />
                          <Dot $filled={posted}>{posted ? "✓" : "2"}</Dot>
                          <Line $filled={posted} />
                        </Stepper>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            color: "var(--am-ink-muted)",
                            marginTop: 4,
                          }}
                        >
                          <span>
                            Initiator{" "}
                            {t.initiator_name ? (
                              <strong style={{ color: "var(--am-ink)" }}>
                                {t.initiator_name}
                              </strong>
                            ) : (
                              <Mono>{t.initiated_by.slice(-6)}</Mono>
                            )}
                          </span>
                          <span>
                            {posted
                              ? `Recipient posted ${t.posted_at ? new Date(t.posted_at).toLocaleDateString() : ""}`
                              : t.state === "failed"
                                ? `Failed — ${t.failure_reason ?? ""}`
                                : "Awaiting recipient post"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </>
          )}

          {tab === "danger" && (
            <>
              <Banner tone="warning" title="Danger zone">
                These actions change payment surfaces or disable settings relied on by
                other organisations. Each one requires an explicit confirm with the
                subject named.
              </Banner>
              <DangerBlock>
                <strong>Disable sending transfers</strong>
                <p style={{ margin: 0, fontSize: 13, color: "var(--am-ink-muted)" }}>
                  Prevents this organisation from initiating new inter-org transfers.
                  Posted transfers are not affected.
                </p>
                <Button
                  variant="danger"
                  disabled={!org.inter_org.send_enabled}
                  onClick={() =>
                    setConfirmDanger({
                      action: "disable-send",
                      subject: org.name,
                      consequence:
                        "New inter-organisation transfers from this org will be refused by the API until re-enabled.",
                      run: async () => {
                        const ok = await patch(
                          "/admin/organization/inter-org",
                          { send_enabled: false },
                          "Sending disabled."
                        );
                        if (ok) setConfirmDanger(null);
                      },
                    })
                  }
                >
                  Disable sending for {org.name}
                </Button>
              </DangerBlock>
              <DangerBlock>
                <strong>Disable receiving transfers</strong>
                <p style={{ margin: 0, fontSize: 13, color: "var(--am-ink-muted)" }}>
                  Prevents other organisations from sending transfers here.
                </p>
                <Button
                  variant="danger"
                  disabled={!org.inter_org.receive_enabled}
                  onClick={() =>
                    setConfirmDanger({
                      action: "disable-receive",
                      subject: org.name,
                      consequence:
                        "Incoming transfers from any organisation will be refused until re-enabled.",
                      run: async () => {
                        const ok = await patch(
                          "/admin/organization/inter-org",
                          { receive_enabled: false },
                          "Receiving disabled."
                        );
                        if (ok) setConfirmDanger(null);
                      },
                    })
                  }
                >
                  Disable receiving for {org.name}
                </Button>
              </DangerBlock>
              <DangerBlock>
                <strong>Clear sender allow-list</strong>
                <p style={{ margin: 0, fontSize: 13, color: "var(--am-ink-muted)" }}>
                  Removes every entry from the allow-list ({" "}
                  {org.inter_org.allowed_recipient_slugs.length} currently). An empty
                  allow-list means <em>any</em> opted-in organisation may send to you.
                </p>
                <Button
                  variant="danger"
                  disabled={org.inter_org.allowed_recipient_slugs.length === 0}
                  onClick={() =>
                    setConfirmDanger({
                      action: "clear-allowlist",
                      subject: org.name,
                      consequence:
                        "The allow-list is removed. Any opted-in organisation can send transfers to this org.",
                      run: async () => {
                        const ok = await patch(
                          "/admin/organization/inter-org",
                          { allowed_recipient_slugs: [] },
                          "Allow-list cleared."
                        );
                        if (ok) setConfirmDanger(null);
                      },
                    })
                  }
                >
                  Clear allow-list for {org.name}
                </Button>
              </DangerBlock>
            </>
          )}
        </>
      )}

      {/* Branding sheet */}
      {org && (
        <BrandingSheet
          open={brandingOpen}
          onClose={() => setBrandingOpen(false)}
          org={org}
          onSave={async (body) => {
            const ok = await patch("/admin/organization/branding", body, "Branding saved.");
            if (ok) setBrandingOpen(false);
          }}
        />
      )}

      {/* Domains sheet */}
      {org && (
        <DomainsSheet
          open={domainsOpen}
          onClose={() => setDomainsOpen(false)}
          org={org}
          onSave={async (domains) => {
            const ok = await patch(
              "/admin/organization/domains",
              { domains },
              "Domains saved."
            );
            if (ok) setDomainsOpen(false);
          }}
        />
      )}

      {/* Inter-org settings sheet */}
      {org && (
        <InterOrgSheet
          open={interOrgOpen}
          onClose={() => setInterOrgOpen(false)}
          org={org}
          onSave={async (body) => {
            const ok = await patch("/admin/organization/inter-org", body, "Saved.");
            if (ok) setInterOrgOpen(false);
          }}
        />
      )}

      {/* New transfer sheet */}
      <TransferSheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        receivers={transferOptions}
        fromFunds={fromFunds}
        baseCurrency={org?.base_currency ?? "USD"}
        onSubmit={initiateTransfer}
      />

      {/* Danger-zone confirm — subject named per §10 */}
      <Modal
        open={!!confirmDanger}
        onClose={() => setConfirmDanger(null)}
        title={
          confirmDanger
            ? confirmDanger.action === "disable-send"
              ? `Disable sending transfers for "${confirmDanger.subject}"?`
              : confirmDanger.action === "disable-receive"
                ? `Disable receiving transfers for "${confirmDanger.subject}"?`
                : `Clear sender allow-list for "${confirmDanger.subject}"?`
            : "Confirm"
        }
        description={confirmDanger?.consequence}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDanger(null)}>
              Keep as is
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void confirmDanger?.run();
              }}
            >
              {confirmDanger?.action === "clear-allowlist"
                ? "Clear"
                : "Disable"}
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </Page>
  );
}

function BrandingSheet({
  open,
  onClose,
  org,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  org: Org;
  onSave: (body: Partial<Org["branding"]>) => Promise<void>;
}) {
  const [form, setForm] = useState(org.branding);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(org.branding), [org]);

  async function save() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={saving ? () => undefined : onClose}
      variant="full"
      title="Branding"
      description="Logo, hero copy, and accent colour."
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button fullWidth onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field>
          <span>Display name</span>
          <Input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </Field>
        <Field>
          <span>Tagline</span>
          <Input
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </Field>
        <Field>
          <span>Hero copy (markdown)</span>
          <Textarea
            rows={5}
            value={form.hero_markdown}
            onChange={(e) => setForm({ ...form, hero_markdown: e.target.value })}
          />
        </Field>
        <Field>
          <span>Accent colour (#RRGGBB)</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              style={{ flex: 1 }}
              value={form.accent_color}
              onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              pattern="#[0-9a-fA-F]{6}"
            />
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 32,
                height: 32,
                borderRadius: 6,
                background: form.accent_color,
                border: "1px solid var(--am-border)",
              }}
            />
          </div>
        </Field>
        <Field>
          <span>Footer line</span>
          <Input
            value={form.footer_line}
            onChange={(e) => setForm({ ...form, footer_line: e.target.value })}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function DomainsSheet({
  open,
  onClose,
  org,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  org: Org;
  onSave: (domains: string[]) => Promise<void>;
}) {
  const [text, setText] = useState(org.domains.join("\n"));
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(org.domains.join("\n")), [org]);

  const parsed = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [text]
  );

  async function save() {
    setSaving(true);
    try {
      await onSave(parsed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Domains"
      description="One host per line. No scheme, no port."
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button fullWidth onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <Field>
        <span>Hosts ({parsed.length})</span>
        <Textarea
          rows={6}
          style={{ fontFamily: "var(--am-font-mono, monospace)" }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
    </Sheet>
  );
}

function InterOrgSheet({
  open,
  onClose,
  org,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  org: Org;
  onSave: (body: Partial<Org["inter_org"]>) => Promise<void>;
}) {
  const [form, setForm] = useState(org.inter_org);
  const [allowed, setAllowed] = useState(org.inter_org.allowed_recipient_slugs.join(", "));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(org.inter_org);
    setAllowed(org.inter_org.allowed_recipient_slugs.join(", "));
  }, [org]);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        send_enabled: form.send_enabled,
        receive_enabled: form.receive_enabled,
        allowed_recipient_slugs: allowed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Inter-org transfers"
      description="Both sides must opt in. Allow-list optional."
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button fullWidth onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.send_enabled}
            onChange={(e) => setForm({ ...form, send_enabled: e.target.checked })}
          />
          <span>Sending enabled</span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.receive_enabled}
            onChange={(e) => setForm({ ...form, receive_enabled: e.target.checked })}
          />
          <span>Receiving enabled</span>
        </label>
        <Field>
          <span>Allow-list (comma-separated sender slugs; empty = any sender)</span>
          <Input value={allowed} onChange={(e) => setAllowed(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function TransferSheet({
  open,
  onClose,
  receivers,
  fromFunds,
  baseCurrency,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  receivers: TransferOption[];
  fromFunds: FromFund[];
  baseCurrency: string;
  onSubmit: (body: unknown) => Promise<void>;
}) {
  const [toSlug, setToSlug] = useState("");
  const [fromFund, setFromFund] = useState("");
  const [toFund, setToFund] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState(baseCurrency);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setCurrency(baseCurrency), [baseCurrency]);

  const toFunds = useMemo(
    () => receivers.find((r) => r.slug === toSlug)?.funds ?? [],
    [receivers, toSlug]
  );

  async function go() {
    if (!toSlug || !fromFund || !toFund || amount <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        to_organization_slug: toSlug,
        from_fund_id: fromFund,
        to_fund_id: toFund,
        amount_cents: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        memo: memo || undefined,
        idempotency_key: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={submitting ? () => undefined : onClose}
      variant="full"
      title="New inter-org transfer"
      description="A pending transfer that posts once the recipient confirms."
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={go}
            loading={submitting}
            disabled={!toSlug || !fromFund || !toFund || amount <= 0}
          >
            Initiate
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field>
          <span>Recipient organisation</span>
          <select
            value={toSlug}
            onChange={(e) => {
              setToSlug(e.target.value);
              setToFund("");
            }}
            style={{
              minHeight: 44,
              padding: "0 12px",
              borderRadius: "var(--am-radius-md)",
              border: "1px solid var(--am-border-strong)",
            }}
          >
            <option value="">Pick an organisation…</option>
            {receivers.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name} ({r.slug})
              </option>
            ))}
          </select>
          {receivers.length === 0 && (
            <small style={{ color: "var(--am-ink-muted)" }}>
              No opted-in receivers found. Verify the recipient has receiving enabled.
            </small>
          )}
        </Field>
        <Field>
          <span>From fund (your org)</span>
          <select
            value={fromFund}
            onChange={(e) => setFromFund(e.target.value)}
            style={{
              minHeight: 44,
              padding: "0 12px",
              borderRadius: "var(--am-radius-md)",
              border: "1px solid var(--am-border-strong)",
            }}
          >
            <option value="">Pick a fund…</option>
            {fromFunds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <span>To fund (recipient)</span>
          <select
            value={toFund}
            onChange={(e) => setToFund(e.target.value)}
            style={{
              minHeight: 44,
              padding: "0 12px",
              borderRadius: "var(--am-radius-md)",
              border: "1px solid var(--am-border-strong)",
            }}
          >
            <option value="">Pick a fund…</option>
            {toFunds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <span>Amount &amp; currency</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
            />
          </div>
        </Field>
        <Field>
          <span>Memo (optional)</span>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

function LegacyOrg() {
  const toast = useToast();
  const [org, setOrg] = useState<Org | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setOrg(await api<Org>("/admin/organization"));
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(path: string, body: unknown) {
    try {
      await api(path, { method: "PATCH", json: body });
      toast.push({ tone: "success", message: "Saved" });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (err) return <ErrorState message={err} retry={load} />;
  if (!org) return <LoadingState />;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{org.name}</h1>
      <p style={{ color: "#6b7280" }}>
        slug: <code>{org.slug}</code> · base currency: {org.base_currency}
      </p>
      <LegacyBranding
        org={org}
        onSave={(body) => patch("/admin/organization/branding", body)}
      />
      <LegacyDomains
        org={org}
        onSave={(domains) => patch("/admin/organization/domains", { domains })}
      />
      <LegacyInterOrg
        org={org}
        onSave={(body) => patch("/admin/organization/inter-org", body)}
      />
    </section>
  );
}

function LegacyBranding({
  org,
  onSave,
}: {
  org: Org;
  onSave: (b: Partial<Org["branding"]>) => Promise<void>;
}) {
  const [form, setForm] = useState(org.branding);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    void onSave(form);
  }
  return (
    <form onSubmit={submit} style={legacyCard()}>
      <h2 style={{ marginTop: 0 }}>Branding</h2>
      <LegacyField
        label="Display name"
        value={form.display_name}
        onChange={(v) => setForm({ ...form, display_name: v })}
      />
      <LegacyField
        label="Tagline"
        value={form.tagline}
        onChange={(v) => setForm({ ...form, tagline: v })}
      />
      <label style={{ display: "block", marginTop: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem" }}>Hero copy (markdown)</span>
        <textarea
          rows={5}
          value={form.hero_markdown}
          onChange={(e) => setForm({ ...form, hero_markdown: e.target.value })}
          style={{ width: "100%" }}
        />
      </label>
      <LegacyField
        label="Footer line"
        value={form.footer_line}
        onChange={(v) => setForm({ ...form, footer_line: v })}
      />
      <LegacyButton type="submit">Save branding</LegacyButton>
    </form>
  );
}

function LegacyDomains({
  org,
  onSave,
}: {
  org: Org;
  onSave: (d: string[]) => Promise<void>;
}) {
  const [text, setText] = useState(org.domains.join("\n"));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    void onSave(
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  return (
    <form onSubmit={submit} style={legacyCard()}>
      <h2 style={{ marginTop: 0 }}>Domains</h2>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", fontFamily: "monospace" }}
      />
      <LegacyButton type="submit">Save domains</LegacyButton>
    </form>
  );
}

function LegacyInterOrg({
  org,
  onSave,
}: {
  org: Org;
  onSave: (b: Partial<Org["inter_org"]>) => Promise<void>;
}) {
  const [form, setForm] = useState(org.inter_org);
  const [allowed, setAllowed] = useState(org.inter_org.allowed_recipient_slugs.join(", "));
  function submit(e: React.FormEvent) {
    e.preventDefault();
    void onSave({
      send_enabled: form.send_enabled,
      receive_enabled: form.receive_enabled,
      allowed_recipient_slugs: allowed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return (
    <form onSubmit={submit} style={legacyCard()}>
      <h2 style={{ marginTop: 0 }}>Pay-it-forward</h2>
      <label style={{ display: "block" }}>
        <input
          type="checkbox"
          checked={form.send_enabled}
          onChange={(e) => setForm({ ...form, send_enabled: e.target.checked })}
        />{" "}
        Sending enabled
      </label>
      <label style={{ display: "block" }}>
        <input
          type="checkbox"
          checked={form.receive_enabled}
          onChange={(e) => setForm({ ...form, receive_enabled: e.target.checked })}
        />{" "}
        Receiving enabled
      </label>
      <LegacyField label="Allow-list" value={allowed} onChange={setAllowed} />
      <LegacyButton type="submit">Save</LegacyButton>
    </form>
  );
}

function LegacyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "block", marginTop: "0.5rem" }}>
      <span style={{ fontSize: "0.85rem" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function legacyCard(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "1rem 1.25rem",
    margin: "1rem 0",
  };
}
