"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import { api } from "@/lib/api";

export type UploadKind = "photo" | "document" | "video";

export type UploadStatus =
  | "preparing"
  | "uploading"
  | "finalizing"
  | "done"
  | "error"
  | "cancelled";

export type UploadRecord = {
  id: string;
  filename: string;
  bytes: number;
  kind: UploadKind;
  status: UploadStatus;
  progress: number;
  error: string | null;
  startedAt: number;
  assetId: string | null;
};

type StartOpts = {
  file: File;
  kind: UploadKind;
  visibility?: "internal" | "public";
  viaProvider?: boolean;
  altText?: string;
  link?: { target: string; id: string; role?: string };
};

type UploadsContextValue = {
  uploads: UploadRecord[];
  start: (opts: StartOpts) => Promise<string>;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
  clearFinished: () => void;
  onUploadComplete: (listener: (assetId: string) => void) => () => void;
};

const UploadsContext = createContext<UploadsContextValue | null>(null);

type Ticket = {
  asset_id: string;
  kind: UploadKind;
  upload_url?: string;
  multipart?: {
    upload_id: string;
    part_size: number;
    part_urls: string[];
  };
  provider_upload_url?: string;
  bucket: string;
  key: string;
  expires_at: string;
};

function putWithProgress(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
  contentType?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("etag") ?? "");
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function maybeCompress(file: File, kind: UploadKind): Promise<File> {
  if (kind !== "photo") return file;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.84));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function UploadsProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const listeners = useRef(new Set<(assetId: string) => void>());

  const patch = useCallback((id: string, next: Partial<UploadRecord>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...next } : u)));
  }, []);

  const onUploadComplete = useCallback(
    (listener: (assetId: string) => void) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    []
  );

  const start = useCallback<UploadsContextValue["start"]>(
    async (opts) => {
      const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const controller = new AbortController();
      controllers.current.set(id, controller);

      const compressed = await maybeCompress(opts.file, opts.kind);

      const record: UploadRecord = {
        id,
        filename: compressed.name,
        bytes: compressed.size,
        kind: opts.kind,
        status: "preparing",
        progress: 0,
        error: null,
        startedAt: Date.now(),
        assetId: null,
      };
      setUploads((prev) => [...prev, record]);

      try {
        const ticket = await api<Ticket>("/media/tickets", {
          json: {
            kind: opts.kind,
            mime: compressed.type || "application/octet-stream",
            bytes: compressed.size,
            filename: compressed.name,
            visibility: opts.visibility ?? "internal",
            alt_text: opts.altText,
            via_provider: opts.viaProvider ?? false,
            link: opts.link,
          },
        });

        patch(id, { status: "uploading", assetId: ticket.asset_id });

        let totalUploaded = 0;
        const signal = controller.signal;

        if (ticket.provider_upload_url) {
          await putWithProgress(
            ticket.provider_upload_url,
            compressed,
            (loaded) => {
              patch(id, { progress: Math.min(100, (loaded / compressed.size) * 100) });
            },
            signal
          );
        } else if (ticket.upload_url) {
          await putWithProgress(
            ticket.upload_url,
            compressed,
            (loaded) => {
              patch(id, { progress: Math.min(100, (loaded / compressed.size) * 100) });
            },
            signal,
            compressed.type
          );
        } else if (ticket.multipart) {
          const partSize = ticket.multipart.part_size;
          const completed: { part_number: number; etag: string }[] = [];
          for (let i = 0; i < ticket.multipart.part_urls.length; i++) {
            if (signal.aborted) throw new DOMException("aborted", "AbortError");
            const slice = compressed.slice(
              i * partSize,
              Math.min(compressed.size, (i + 1) * partSize)
            );
            const etag = await putWithProgress(
              ticket.multipart.part_urls[i],
              slice,
              (loaded) => {
                const pct = ((totalUploaded + loaded) / compressed.size) * 100;
                patch(id, { progress: Math.min(100, pct) });
              },
              signal
            );
            completed.push({ part_number: i + 1, etag });
            totalUploaded += slice.size;
          }
          patch(id, { status: "finalizing" });
          await api("/media/complete", {
            json: {
              asset_id: ticket.asset_id,
              upload_id: ticket.multipart.upload_id,
              parts: completed,
            },
          });
        }

        if (!ticket.multipart) {
          patch(id, { status: "finalizing" });
          await api("/media/complete", { json: { asset_id: ticket.asset_id } });
        }

        patch(id, { status: "done", progress: 100 });
        controllers.current.delete(id);
        listeners.current.forEach((fn) => fn(ticket.asset_id));

        // Auto-dismiss successful uploads after 4s.
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 4000);

        return ticket.asset_id;
      } catch (e) {
        controllers.current.delete(id);
        if ((e as Error).name === "AbortError") {
          patch(id, { status: "cancelled", error: "Cancelled" });
        } else {
          patch(id, { status: "error", error: (e as Error).message });
        }
        throw e;
      }
    },
    [patch]
  );

  const cancel = useCallback((id: string) => {
    const c = controllers.current.get(id);
    if (c) c.abort();
  }, []);

  const dismiss = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setUploads((prev) =>
      prev.filter((u) => u.status !== "done" && u.status !== "cancelled")
    );
  }, []);

  // Warn before unloading page while uploads are in flight.
  useEffect(() => {
    const inflight = uploads.some(
      (u) =>
        u.status === "preparing" || u.status === "uploading" || u.status === "finalizing"
    );
    if (!inflight) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploads]);

  const value = useMemo(
    () => ({ uploads, start, cancel, dismiss, clearFinished, onUploadComplete }),
    [uploads, start, cancel, dismiss, clearFinished, onUploadComplete]
  );

  return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function useUploads(): UploadsContextValue {
  const ctx = useContext(UploadsContext);
  if (!ctx) {
    // Safe no-op fallback when a page renders without the shell.
    const noop = () => {};
    return {
      uploads: [],
      start: async () => {
        throw new Error("UploadsProvider is not mounted.");
      },
      cancel: noop,
      dismiss: noop,
      clearFinished: noop,
      onUploadComplete: () => noop,
    };
  }
  return ctx;
}

/* --------------------------- Banner --------------------------- */

const BannerWrap = styled.aside`
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(80px + env(safe-area-inset-bottom));
  z-index: 950;
  padding: 0 12px;
  pointer-events: none;

  @media (min-width: 1024px) {
    bottom: 24px;
    left: auto;
    right: 24px;
    width: 360px;
    padding: 0;
  }
`;

const BannerCard = styled.div`
  pointer-events: auto;
  background: var(--am-surface-raised);
  color: var(--am-ink);
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-lg);
  box-shadow: var(--am-shadow-3);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const BannerHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
`;

const ClearBtn = styled.button`
  background: transparent;
  border: 0;
  color: var(--am-ink-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--am-radius-sm);
  &:hover {
    background: var(--am-bg-soft);
    color: var(--am-ink);
  }
`;

const Item = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  align-items: center;
  font-size: 12px;
`;

const Name = styled.div`
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
`;

const Meta = styled.div<{ $tone?: "error" | "ok" | "muted" }>`
  grid-column: 1 / span 2;
  font-size: 11px;
  color: ${({ $tone }) =>
    $tone === "error"
      ? "var(--am-danger-600)"
      : $tone === "ok"
        ? "var(--am-success-600)"
        : "var(--am-ink-muted)"};
`;

const Bar = styled.div<{ $pct: number; $tone: "progress" | "error" | "ok" }>`
  grid-column: 1 / span 2;
  height: 4px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-pill);
  overflow: hidden;
  position: relative;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: ${({ $pct }) => Math.max(0, Math.min(100, $pct))}%;
    background: ${({ $tone }) =>
      $tone === "error"
        ? "var(--am-danger-600)"
        : $tone === "ok"
          ? "var(--am-success-600)"
          : "var(--am-brand-600)"};
    border-radius: inherit;
    transition: width var(--am-dur-base) var(--am-ease-standard);
  }
`;

const Cancel = styled.button`
  background: transparent;
  border: 0;
  color: var(--am-ink-muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--am-radius-sm);
  font-size: 12px;
  &:hover {
    background: var(--am-bg-soft);
    color: var(--am-danger-600);
  }
`;

export function UploadsBanner() {
  const { uploads, cancel, dismiss, clearFinished } = useUploads();
  if (uploads.length === 0) return null;

  const inflight = uploads.filter(
    (u) => u.status === "preparing" || u.status === "uploading" || u.status === "finalizing"
  );

  return (
    <BannerWrap aria-live="polite">
      <BannerCard>
        <BannerHead>
          <span>
            {inflight.length > 0
              ? `Uploading ${inflight.length} file${inflight.length === 1 ? "" : "s"}…`
              : "Uploads"}
          </span>
          <ClearBtn type="button" onClick={clearFinished}>
            Clear
          </ClearBtn>
        </BannerHead>
        {uploads.slice(-3).map((u) => {
          const tone: "progress" | "error" | "ok" =
            u.status === "error" || u.status === "cancelled"
              ? "error"
              : u.status === "done"
                ? "ok"
                : "progress";
          return (
            <Item key={u.id}>
              <Name title={u.filename}>{u.filename}</Name>
              {u.status === "uploading" || u.status === "preparing" ? (
                <Cancel type="button" onClick={() => cancel(u.id)}>
                  Cancel
                </Cancel>
              ) : (
                <Cancel type="button" onClick={() => dismiss(u.id)}>
                  Dismiss
                </Cancel>
              )}
              <Bar $pct={u.progress} $tone={tone} />
              <Meta
                $tone={
                  tone === "error" ? "error" : tone === "ok" ? "ok" : "muted"
                }
              >
                {u.status === "done"
                  ? "Uploaded"
                  : u.status === "error"
                    ? u.error ?? "Failed"
                    : u.status === "cancelled"
                      ? "Cancelled"
                      : u.status === "finalizing"
                        ? "Finalising…"
                        : u.status === "preparing"
                          ? "Preparing…"
                          : `${Math.floor(u.progress)}%`}
              </Meta>
            </Item>
          );
        })}
      </BannerCard>
    </BannerWrap>
  );
}
