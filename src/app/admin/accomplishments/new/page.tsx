"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Banner, Button, Card } from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Project = { _id: string; name: string; slug: string };

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--am-ink-muted);
  font-weight: 600;
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  font-size: 15px;
  font-family: inherit;
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 1px;
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  font-size: 15px;
  font-family: inherit;
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  font-size: 15px;
  font-family: inherit;
  min-height: 120px;
  resize: vertical;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 8px;
`;

export default function NewAccomplishmentPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState<null | "draft" | "submit">(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "",
    title: "",
    summary: "",
    body_markdown: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    location_label: "",
    beneficiary_count: "",
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ items: Project[] }>("/projects");
        setProjects(data.items);
        if (data.items[0]) setForm((f) => ({ ...f, project_id: data.items[0]._id }));
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(andSubmit: boolean) {
    if (!form.project_id) {
      setErr("Pick a project first.");
      return;
    }
    if (!form.title.trim() || !form.summary.trim() || !form.body_markdown.trim()) {
      setErr("Title, summary, and body are required.");
      return;
    }
    setErr(null);
    setSubmitting(andSubmit ? "submit" : "draft");
    try {
      const created = await api<{ id: string; version: number }>("/accomplishments", {
        json: {
          project_id: form.project_id,
          title: form.title.trim(),
          summary: form.summary.trim(),
          body_markdown: form.body_markdown,
          occurred_on: new Date(form.occurred_on).toISOString(),
          location_label: form.location_label.trim() || undefined,
          beneficiary_count: form.beneficiary_count
            ? Number(form.beneficiary_count)
            : undefined,
        },
      });
      if (andSubmit) {
        await api(`/accomplishments/${created.id}/transition`, {
          json: { transition: "submit", version: created.version },
        });
      }
      router.push(`/admin/accomplishments/${created.id}`);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setSubmitting(null);
    }
  }

  return (
    <Page>
      <Title>New accomplishment</Title>
      {err && (
        <Banner tone="danger" title="Couldn't save">
          {err}
        </Banner>
      )}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field>
            Project
            <Select
              value={form.project_id}
              onChange={(e) => patch("project_id", e.target.value)}
            >
              {projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : null}
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            Title
            <Input
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
              placeholder="A short, specific headline"
              maxLength={200}
            />
          </Field>

          <Field>
            Summary
            <Input
              value={form.summary}
              onChange={(e) => patch("summary", e.target.value)}
              placeholder="One sentence for the public card"
              maxLength={500}
            />
          </Field>

          <Field>
            What happened
            <Textarea
              value={form.body_markdown}
              onChange={(e) => patch("body_markdown", e.target.value)}
              placeholder="Markdown is supported."
            />
          </Field>

          <Row>
            <Field>
              Date it happened
              <Input
                type="date"
                value={form.occurred_on}
                onChange={(e) => patch("occurred_on", e.target.value)}
              />
            </Field>
            <Field>
              Location (optional)
              <Input
                value={form.location_label}
                onChange={(e) => patch("location_label", e.target.value)}
                placeholder="e.g. Kampala central"
              />
            </Field>
          </Row>

          <Field>
            Beneficiary count (optional)
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.beneficiary_count}
              onChange={(e) => patch("beneficiary_count", e.target.value)}
            />
          </Field>

          <Actions>
            <Button
              variant="ghost"
              onClick={() => void save(false)}
              disabled={submitting !== null}
            >
              {submitting === "draft" ? "Saving…" : "Save as draft"}
            </Button>
            <Button
              variant="primary"
              onClick={() => void save(true)}
              disabled={submitting !== null}
            >
              {submitting === "submit" ? "Submitting…" : "Save & submit for review"}
            </Button>
          </Actions>
        </div>
      </Card>
    </Page>
  );
}
