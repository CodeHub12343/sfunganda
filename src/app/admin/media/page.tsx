"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Button as LegacyButton } from "@/components/ui/Button";
import { Uploader } from "@/components/ui/Uploader";
import { useToast } from "@/components/ui/Toast";
import {
  EmptyState as LegacyEmpty,
  ErrorState,
  LoadingState,
} from "@/components/ui/States";
import { api, ApiClientError } from "@/lib/api";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  Modal,
  SearchField,
  SegmentedControl,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
  useUploads,
  type UploadKind,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: "photo" | "document" | "video";
  status:
    | "ticketed"
    | "uploading"
    | "pending_scan"
    | "pending_processing"
    | "ready"
    | "rejected"
    | "deleted";
  visibility: "internal" | "public";
  bytes: number;
  mime: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  exif_stripped: boolean;
  alt_text: string | null;
  caption: string | null;
  flags: { reason: string; at: string }[];
  original_filename: string;
  created_at: string;
  provider_ready: boolean;
  // Not always present — populated on-detail for the preview modal.
  url?: string | null;
  thumbnail_url?: string | null;
  usage_count?: number;
};

export default function AdminMedia() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileMedia /> : <LegacyMedia />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const KIND_OPTIONS = [
  { value: "photo" as const, label: "Images" },
  { value: "video" as const, label: "Videos" },
  { value: "document" as const, label: "Documents" },
];

type Kind = (typeof KIND_OPTIONS)[number]["value"];
type ViewMode = "grid" | "list";

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

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ToolRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ToggleGroup = styled.div`
  display: inline-flex;
  background: var(--am-bg-soft);
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  padding: 2px;
  flex-shrink: 0;
`;

const ToggleBtn = styled.button<{ $active: boolean }>`
  min-width: 36px;
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  background: ${({ $active }) => ($active ? "var(--am-surface)" : "transparent")};
  color: ${({ $active }) => ($active ? "var(--am-ink)" : "var(--am-ink-muted)")};
  box-shadow: ${({ $active }) => ($active ? "var(--am-shadow-1)" : "none")};
  border-radius: calc(var(--am-radius-md) - 2px);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Chips = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;

  ${amMedia.sm} {
    grid-template-columns: repeat(3, 1fr);
  }
  ${amMedia.md} {
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  ${amMedia.lg} {
    grid-template-columns: repeat(6, 1fr);
  }
`;

const Thumb = styled.button`
  position: relative;
  aspect-ratio: 1 / 1;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--am-radius-md);
  background: var(--am-bg-soft);
  overflow: hidden;
  cursor: pointer;
  display: block;
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const ThumbIcon = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--am-ink-subtle);
`;

const Overlay = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 8px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Flag = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
`;

const ListWrap = styled(Card)`
  padding: 0;
  overflow: hidden;
`;

const ListItem = styled.button`
  width: 100%;
  background: var(--am-surface);
  border: 0;
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  & + & {
    border-top: 1px solid var(--am-border);
  }
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: -2px;
  }
`;

const SmallThumb = styled.div`
  width: 48px;
  height: 48px;
  border-radius: var(--am-radius-sm);
  background: var(--am-bg-soft);
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--am-ink-subtle);
`;

const SmallThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Fab = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: var(--am-radius-pill);
  background: var(--am-brand-600);
  color: var(--am-ink-on-brand);
  border: 0;
  box-shadow: var(--am-shadow-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: var(--am-z-sticky);
  &:active {
    transform: scale(0.96);
  }
  ${amMedia.lg} {
    bottom: 24px;
  }
`;

const UploadActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UploadAction = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  border: 1px solid var(--am-border);
  cursor: pointer;
  &:hover {
    background: var(--am-bg-soft);
  }
  input {
    display: none;
  }
  span.title {
    font-weight: 600;
    font-size: 15px;
  }
  span.sub {
    display: block;
    font-size: 12px;
    color: var(--am-ink-muted);
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;


const Textarea = styled.textarea`
  min-height: 76px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
  resize: vertical;
`;

const PreviewMedia = styled.div`
  background: #0b0f14;
  border-radius: var(--am-radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  margin-bottom: 12px;
  img,
  video {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }
`;

const DL = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  font-size: 13px;
  margin: 0 0 12px;
  dt {
    color: var(--am-ink-muted);
  }
  dd {
    margin: 0;
    color: var(--am-ink);
    overflow-wrap: anywhere;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

function KindIcon({ kind, size = 32 }: { kind: Row["kind"]; size?: number }) {
  if (kind === "video") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M21 7v10l-4-3V10l4-3z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "document") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 3h7l5 5v13H7V3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 18l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function statusTone(s: Row["status"]): "success" | "warning" | "danger" | "neutral" {
  if (s === "ready") return "success";
  if (s === "rejected") return "danger";
  if (s === "deleted") return "neutral";
  return "warning";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function MobileMedia() {
  const toast = useAdminToast();
  const uploads = useUploads();
  const [kind, setKind] = useState<Kind>("photo");
  const [status, setStatus] = useState<string>("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<Row | null>(null);
  const [altDraft, setAltDraft] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = new URLSearchParams();
      q.set("kind", kind);
      if (status) q.set("status", status);
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/media?${q.toString()}`
      );
      setRows(data.items);
      // Lazily hydrate thumbnail URLs for `ready` photos/videos. The list
      // endpoint intentionally doesn't include URLs (private storage), so we
      // mint short-TTL ones client-side. Limit the first wave to keep the
      // signed-URL endpoint from being hammered on huge libraries.
      const toHydrate = data.items
        .filter((r) => r.status === "ready" && (r.kind === "photo" || r.kind === "video"))
        .slice(0, 24);
      void Promise.all(
        toHydrate.map(async (r) => {
          try {
            const resolved = await api<{ url: string }>(`/media/${r.id}/signed-url`);
            return { id: r.id, url: resolved.url } as const;
          } catch {
            return null;
          }
        })
      ).then((results) => {
        const map = new Map(results.filter(Boolean).map((x) => [x!.id, x!.url]));
        if (map.size === 0) return;
        setRows((cur) =>
          cur
            ? cur.map((r) =>
                map.has(r.id) ? { ...r, thumbnail_url: map.get(r.id) ?? r.thumbnail_url } : r
              )
            : cur
        );
      });
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, [kind, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload whenever an upload finishes successfully (survives route changes).
  useEffect(() => {
    const off = uploads.onUploadComplete(() => void load());
    return off;
  }, [uploads, load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.original_filename.toLowerCase().includes(q) ||
        (r.alt_text ?? "").toLowerCase().includes(q) ||
        (r.caption ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  function pickFiles(files: FileList | null, source: "camera" | "library" | "files") {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      const inferredKind: UploadKind = f.type.startsWith("video/")
        ? "video"
        : f.type.startsWith("image/")
          ? "photo"
          : "document";
      void uploads.start({
        file: f,
        kind: kind === "photo" && source === "camera" ? "photo" : inferredKind,
        viaProvider: inferredKind === "video",
      });
    }
    setUploadOpen(false);
  }

  async function updateAlt(id: string, alt: string) {
    try {
      await api(`/media/${id}`, { method: "PATCH", json: { alt_text: alt } });
      toast.push({ tone: "success", message: "Alt text saved." });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  async function toggleVisibility(r: Row) {
    const next = r.visibility === "public" ? "internal" : "public";
    try {
      await api(`/media/${r.id}`, { method: "PATCH", json: { visibility: next } });
      toast.push({ tone: "success", message: `Now ${next}.` });
      setPreview(null);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  async function flag(r: Row) {
    try {
      await api(`/media/${r.id}/flag`, { json: { reason: "unsafe" } });
      toast.push({ tone: "warning", message: "Flagged for review." });
      setPreview(null);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete ${r.original_filename}?`)) return;
    try {
      await api(`/media/${r.id}`, { method: "DELETE" });
      toast.push({ tone: "success", message: "Deleted." });
      setPreview(null);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  async function openPreview(r: Row) {
    setPreview(r);
    setAltDraft(r.alt_text ?? "");
    // `GET /media/:id/signed-url` returns a short-TTL URL (CDN for public
    // derivatives, presigned R2 for private assets, local-mode PUT/GET URL
    // in dev). The list endpoint doesn't include a URL, so we fetch lazily
    // when the preview opens.
    if (r.status !== "ready") return;
    try {
      const resolved = await api<{ url: string; expires_at: string | null; kind: string }>(
        `/media/${r.id}/signed-url`
      );
      setPreview((cur) => (cur && cur.id === r.id ? { ...cur, url: resolved.url } : cur));
    } catch {
      // Non-fatal — the modal falls back to the kind icon.
    }
  }

  const previewUrl = preview?.url ?? preview?.thumbnail_url ?? null;

  return (
    <Page>
      <PageTitle>Media library</PageTitle>

      <Toolbar>
        <SegmentedControl
          label="Media type"
          options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={kind}
          onChange={(v) => setKind(v)}
        />
        <ToolRow>
          <div style={{ flex: 1 }}>
            <SearchField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search filename, alt, caption"
            />
          </div>
          <ToggleGroup role="group" aria-label="View mode">
            <ToggleBtn
              type="button"
              $active={view === "grid"}
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </ToggleBtn>
            <ToggleBtn
              type="button"
              $active={view === "list"}
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 4h10M3 8h10M3 12h10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </ToggleBtn>
          </ToggleGroup>
        </ToolRow>
        <Chips>
          <FilterChip active={!status} onClick={() => setStatus("")}>
            All statuses
          </FilterChip>
          <FilterChip active={status === "ready"} onClick={() => setStatus("ready")}>
            Ready
          </FilterChip>
          <FilterChip
            active={status === "pending_scan"}
            onClick={() => setStatus("pending_scan")}
          >
            Pending scan
          </FilterChip>
          <FilterChip
            active={status === "pending_processing"}
            onClick={() => setStatus("pending_processing")}
          >
            Processing
          </FilterChip>
          <FilterChip active={status === "rejected"} onClick={() => setStatus("rejected")}>
            Rejected
          </FilterChip>
        </Chips>
      </Toolbar>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load media"
          action={
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {err}
        </Banner>
      )}

      {rows === null ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={120} />
          ))}
        </Grid>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No media yet" : "No matches"}
            description={
              rows.length === 0
                ? "Upload the first file using the + button."
                : "Try a different search or filter."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setUploadOpen(true)}>Upload</Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : view === "grid" ? (
        <Grid>
          {filtered!.map((r) => (
            <Thumb key={r.id} onClick={() => openPreview(r)} aria-label={r.original_filename}>
              {r.thumbnail_url || r.url ? (
                <ThumbImg
                  src={(r.thumbnail_url ?? r.url)!}
                  alt={r.alt_text ?? r.original_filename}
                  loading="lazy"
                />
              ) : (
                <ThumbIcon>
                  <KindIcon kind={r.kind} />
                </ThumbIcon>
              )}
              <Flag>
                {r.flags.length > 0 ? <Badge tone="danger">flagged</Badge> : null}
                {r.visibility === "public" ? <Badge tone="success">public</Badge> : null}
              </Flag>
              <Overlay>{r.original_filename}</Overlay>
            </Thumb>
          ))}
        </Grid>
      ) : (
        <ListWrap>
          {filtered!.map((r) => (
            <ListItem key={r.id} onClick={() => openPreview(r)}>
              <SmallThumb>
                {r.thumbnail_url || r.url ? (
                  <SmallThumbImg src={(r.thumbnail_url ?? r.url)!} alt="" />
                ) : (
                  <KindIcon kind={r.kind} size={22} />
                )}
              </SmallThumb>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.original_filename}
                </div>
                <div style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>
                  {r.kind} · {formatBytes(r.bytes)}
                  {r.width && r.height ? ` · ${r.width}×${r.height}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                {r.visibility === "public" && <Badge tone="success">public</Badge>}
                {r.flags.length > 0 && <Badge tone="danger">flagged</Badge>}
              </div>
            </ListItem>
          ))}
        </ListWrap>
      )}

      <Fab
        type="button"
        aria-label="Upload media"
        onClick={() => setUploadOpen(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </Fab>

      {/* Upload sheet: Camera / Photo library / Files */}
      <Sheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload media"
        description="Uploads continue in the background if you navigate away."
      >
        <UploadActions>
          <UploadAction>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => pickFiles(e.target.files, "camera")}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h3l2-3h6l2 3h3v12H4V7z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>
              <span className="title">Take photo</span>
              <span className="sub">Opens the camera (mobile only).</span>
            </span>
          </UploadAction>
          <UploadAction>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => pickFiles(e.target.files, "library")}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M4 18l5-5 4 4 3-3 4 4"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            <span>
              <span className="title">Photo or video library</span>
              <span className="sub">Pick one or more images or videos.</span>
            </span>
          </UploadAction>
          <UploadAction>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              multiple
              onChange={(e) => pickFiles(e.target.files, "files")}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 3h7l5 5v13H7V3z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>
              <span className="title">Files</span>
              <span className="sub">Documents, PDFs, spreadsheets.</span>
            </span>
          </UploadAction>
        </UploadActions>
      </Sheet>

      {/* Preview modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.original_filename ?? ""}
        size="lg"
        footer={
          preview && (
            <PreviewActions>
              <Button
                variant="secondary"
                onClick={() => preview && toggleVisibility(preview)}
              >
                Make {preview.visibility === "public" ? "internal" : "public"}
              </Button>
              <Button variant="ghost" onClick={() => preview && flag(preview)}>
                Flag
              </Button>
              <Button variant="danger" onClick={() => preview && remove(preview)}>
                Delete
              </Button>
            </PreviewActions>
          )
        }
      >
        {preview && (
          <>
            <PreviewMedia>
              {preview.kind === "video" && preview.url ? (
                <video src={preview.url} controls />
              ) : previewUrl ? (
                <img src={previewUrl} alt={preview.alt_text ?? preview.original_filename} />
              ) : (
                <ThumbIcon style={{ position: "static" }}>
                  <KindIcon kind={preview.kind} size={56} />
                </ThumbIcon>
              )}
            </PreviewMedia>
            <DL>
              <dt>Status</dt>
              <dd>
                <Badge tone={statusTone(preview.status)}>{preview.status}</Badge>
              </dd>
              <dt>Visibility</dt>
              <dd>{preview.visibility}</dd>
              <dt>Type</dt>
              <dd>{preview.mime}</dd>
              <dt>Size</dt>
              <dd>{formatBytes(preview.bytes)}</dd>
              {preview.width && preview.height ? (
                <>
                  <dt>Dim.</dt>
                  <dd>
                    {preview.width}×{preview.height}
                  </dd>
                </>
              ) : null}
              {typeof preview.usage_count === "number" ? (
                <>
                  <dt>Used in</dt>
                  <dd>{preview.usage_count} items</dd>
                </>
              ) : null}
            </DL>
            <Field>
              <span>Alt text</span>
              <Textarea
                value={altDraft}
                onChange={(e) => setAltDraft(e.target.value)}
                placeholder="Describe this media for screen readers."
                maxLength={400}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => preview && updateAlt(preview.id, altDraft)}
                disabled={altDraft === (preview.alt_text ?? "")}
              >
                Save alt text
              </Button>
            </Field>
          </>
        )}
      </Modal>
    </Page>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

const LegacyHeader = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.5rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.5rem;
    margin: 0;
  }
`;

const LegacyFilters = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  select,
  input {
    padding: 0.4rem 0.6rem;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.sm};
  }
`;

const LegacyGrid = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
`;

const LegacyCard = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 0.9rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const LegacyUploads = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  margin-bottom: 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
`;

function LegacyMedia() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = new URLSearchParams();
      if (kind) q.set("kind", kind);
      if (status) q.set("status", status);
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/media?${q.toString()}`
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, [kind, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this asset?")) return;
    try {
      await api(`/media/${id}`, { method: "DELETE" });
      toast.push({ tone: "success", message: "Deleted." });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as Error).message });
    }
  }

  return (
    <section>
      <LegacyHeader>
        <h1>Media library</h1>
      </LegacyHeader>
      <LegacyUploads>
        <div>
          <h3>Photo</h3>
          <Uploader kind="photo" onUploaded={() => void load()} />
        </div>
        <div>
          <h3>Document</h3>
          <Uploader kind="document" onUploaded={() => void load()} />
        </div>
        <div>
          <h3>Video</h3>
          <Uploader kind="video" viaProvider onUploaded={() => void load()} />
        </div>
      </LegacyUploads>
      <LegacyFilters>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All kinds</option>
          <option value="photo">Photos</option>
          <option value="document">Documents</option>
          <option value="video">Videos</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="pending_scan">Pending scan</option>
          <option value="pending_processing">Pending processing</option>
          <option value="rejected">Rejected</option>
        </select>
      </LegacyFilters>
      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <LegacyEmpty title="No media yet" /> : null}
      {rows && rows.length > 0 ? (
        <LegacyGrid>
          {rows.map((r) => (
            <LegacyCard key={r.id}>
              <strong>{r.original_filename}</strong>
              <small>
                {r.kind} · {formatBytes(r.bytes)}
              </small>
              <LegacyButton variant="ghost" onClick={() => remove(r.id)}>
                Delete
              </LegacyButton>
            </LegacyCard>
          ))}
        </LegacyGrid>
      ) : null}
    </section>
  );
}
