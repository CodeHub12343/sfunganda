"use client";

import { useCallback, useState } from "react";
import styled from "styled-components";
import { api } from "@/lib/api";

type Kind = "photo" | "document" | "video";

type Ticket = {
  asset_id: string;
  kind: Kind;
  upload_url?: string;
  multipart?: {
    upload_id: string;
    part_size: number;
    part_urls: string[];
  };
  provider_upload_url?: string;
  provider_asset_id?: string;
  bucket: string;
  key: string;
  expires_at: string;
};

export type UploaderProps = {
  kind: Kind;
  visibility?: "internal" | "public";
  viaProvider?: boolean; // request Cloudflare Stream for videos
  link?: { target: string; id: string; role?: string };
  altText?: string;
  compress?: boolean; // client-side JPEG compression for photos
  onUploaded?: (assetId: string) => void;
  accept?: string;
};

const Drop = styled.label`
  display: block;
  border: 2px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.bgSoft};
  &:hover {
    background: #fff;
  }
  input {
    display: none;
  }
`;

const Progress = styled.div<{ $pct: number }>`
  margin-top: 1rem;
  height: 8px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  overflow: hidden;
  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${({ $pct }) => $pct}%;
    background: ${({ theme }) => theme.colors.sunriseOrange};
    transition: width 0.2s linear;
  }
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Err = styled.p`
  color: ${({ theme }) => theme.colors.danger};
  font-size: 0.9rem;
  margin-top: 0.6rem;
`;

type ResumeState = {
  asset_id: string;
  key: string;
  upload_id: string | null;
  part_urls: string[];
  completed_parts: Array<{ part_number: number; etag: string }>;
  bytes_total: number;
};

function storageKey(file: File): string {
  return `sfu.upload.${file.name}.${file.size}.${file.lastModified}`;
}

function loadResume(file: File): ResumeState | null {
  try {
    const raw = localStorage.getItem(storageKey(file));
    return raw ? (JSON.parse(raw) as ResumeState) : null;
  } catch {
    return null;
  }
}
function saveResume(file: File, state: ResumeState): void {
  try {
    localStorage.setItem(storageKey(file), JSON.stringify(state));
  } catch {
    // storage quota — ignore; worst case we re-upload parts on reload.
  }
}
function clearResume(file: File): void {
  try {
    localStorage.removeItem(storageKey(file));
  } catch {
    // ignore
  }
}

async function maybeCompress(file: File, compress: boolean, kind: Kind): Promise<File> {
  if (!compress || kind !== "photo") return file;
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
    return new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function putWithProgress(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
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
        reject(new Error(`upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(body);
  });
}

export function Uploader(props: UploaderProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "preparing" | "uploading" | "finalizing" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [eta, setEta] = useState<string>("");

  const start = useCallback(
    async (fileIn: File) => {
      setError(null);
      setStatus("preparing");
      setProgress(0);
      const file = await maybeCompress(fileIn, props.compress ?? true, props.kind);

      let sha: string | undefined;
      try {
        if (file.size <= 32 * 1024 * 1024) sha = await sha256Hex(await file.arrayBuffer());
      } catch {
        sha = undefined;
      }

      let ticket: Ticket;
      try {
        ticket = await api<Ticket>("/media/tickets", {
          json: {
            kind: props.kind,
            mime: file.type || "application/octet-stream",
            bytes: file.size,
            filename: file.name,
            visibility: props.visibility ?? "internal",
            sha256: sha,
            alt_text: props.altText,
            via_provider: props.viaProvider ?? false,
            link: props.link,
          },
        });
      } catch (e) {
        setStatus("error");
        setError((e as Error).message);
        return;
      }

      setStatus("uploading");
      const start = Date.now();
      let totalUploaded = 0;

      try {
        if (ticket.provider_upload_url) {
          await putWithProgress(ticket.provider_upload_url, file, (loaded) => {
            totalUploaded = loaded;
            setProgress(Math.min(100, (loaded / file.size) * 100));
            setEta(formatEta(start, loaded, file.size));
          });
        } else if (ticket.upload_url) {
          await putWithProgress(ticket.upload_url, file, (loaded) => {
            totalUploaded = loaded;
            setProgress(Math.min(100, (loaded / file.size) * 100));
            setEta(formatEta(start, loaded, file.size));
          }, file.type);
        } else if (ticket.multipart) {
          const partSize = ticket.multipart.part_size;
          const resume = loadResume(file);
          const completed = resume?.asset_id === ticket.asset_id ? resume.completed_parts : [];
          const completedSet = new Set(completed.map((p) => p.part_number));

          for (let i = 0; i < ticket.multipart.part_urls.length; i++) {
            const partNumber = i + 1;
            if (completedSet.has(partNumber)) {
              totalUploaded += partSize;
              setProgress(Math.min(100, (totalUploaded / file.size) * 100));
              continue;
            }
            const slice = file.slice(i * partSize, Math.min(file.size, (i + 1) * partSize));
            const etag = await putWithProgress(ticket.multipart.part_urls[i], slice, (loaded) => {
              const partUploaded = loaded;
              const pct = ((totalUploaded + partUploaded) / file.size) * 100;
              setProgress(Math.min(100, pct));
              setEta(formatEta(start, totalUploaded + partUploaded, file.size));
            });
            completed.push({ part_number: partNumber, etag });
            totalUploaded += slice.size;
            saveResume(file, {
              asset_id: ticket.asset_id,
              key: ticket.key,
              upload_id: ticket.multipart.upload_id,
              part_urls: ticket.multipart.part_urls,
              completed_parts: completed,
              bytes_total: file.size,
            });
          }

          setStatus("finalizing");
          await api<{ asset_id: string; status: string }>("/media/complete", {
            json: {
              asset_id: ticket.asset_id,
              upload_id: ticket.multipart.upload_id,
              parts: completed,
            },
          });
          clearResume(file);
        }

        if (!ticket.multipart) {
          setStatus("finalizing");
          await api<{ asset_id: string; status: string }>("/media/complete", {
            json: { asset_id: ticket.asset_id },
          });
        }

        setStatus("done");
        setProgress(100);
        props.onUploaded?.(ticket.asset_id);
      } catch (e) {
        setStatus("error");
        setError((e as Error).message);
      }
    },
    [props]
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    void start(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void start(f);
  }

  return (
    <div>
      <Drop
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={
            props.accept ??
            (props.kind === "photo"
              ? "image/*"
              : props.kind === "video"
                ? "video/*"
                : ".pdf,.doc,.docx")
          }
          onChange={onPick}
          disabled={status === "uploading" || status === "preparing" || status === "finalizing"}
        />
        <strong>
          {status === "idle" && "Click to choose or drop a file"}
          {status === "preparing" && "Preparing…"}
          {status === "uploading" && "Uploading…"}
          {status === "finalizing" && "Finalizing…"}
          {status === "done" && "Uploaded"}
          {status === "error" && "Failed"}
        </strong>
        {status === "uploading" || status === "finalizing" ? (
          <>
            <Progress $pct={progress} aria-label={`upload progress ${Math.floor(progress)}%`} />
            <Row>
              <span>{Math.floor(progress)}%</span>
              <span>{eta}</span>
            </Row>
          </>
        ) : null}
      </Drop>
      {error ? <Err role="alert">{error}</Err> : null}
    </div>
  );
}

function formatEta(startMs: number, loaded: number, total: number): string {
  const elapsed = (Date.now() - startMs) / 1000;
  if (elapsed < 1 || loaded === 0) return "";
  const rate = loaded / elapsed;
  const remaining = (total - loaded) / rate;
  if (!Number.isFinite(remaining) || remaining < 1) return "";
  if (remaining < 60) return `${Math.ceil(remaining)}s left`;
  return `${Math.ceil(remaining / 60)}m left`;
}
