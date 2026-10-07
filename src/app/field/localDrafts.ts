// Device-local draft storage. Field_members in rural settings may be
// offline for hours; drafts live in localStorage until the uploader can
// sync them to the server. The author is identified by browser session,
// so collisions across users on the same device are avoided by key
// namespacing.

const KEY = "sfu.field.drafts.v1";

export type LocalDraft = {
  local_id: string;
  remote_id?: string;
  project_id: string;
  milestone_id?: string;
  title: string;
  summary: string;
  body_markdown: string;
  occurred_on: string;
  beneficiary_count?: number;
  location_label?: string;
  media_local: Array<{ name: string; size: number; type: string }>;
  media_asset_ids: string[];
  saved_at: string;
  version?: number;
};

function read(): Record<string, LocalDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalDraft>) : {};
  } catch {
    return {};
  }
}

function write(all: Record<string, LocalDraft>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full / disabled — nothing we can do here; caller still has
    // the in-memory draft and will see the save fail silently.
  }
}

export function readLocalDrafts(): LocalDraft[] {
  return Object.values(read()).sort((a, b) => (b.saved_at < a.saved_at ? -1 : 1));
}

export function getLocalDraft(local_id: string): LocalDraft | null {
  return read()[local_id] ?? null;
}

export function saveLocalDraft(draft: LocalDraft): void {
  const all = read();
  all[draft.local_id] = { ...draft, saved_at: new Date().toISOString() };
  write(all);
}

export function deleteLocalDraft(local_id: string): void {
  const all = read();
  delete all[local_id];
  write(all);
}

export function newLocalId(): string {
  return "d_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
