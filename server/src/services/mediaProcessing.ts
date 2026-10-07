// =============================================================================
// Media processing primitives — type sniffing, EXIF/metadata stripping,
// malware scan. Implemented without native binaries so the worker is a
// single Node process; derivative generation (resize) is intentionally
// left as a shell-out point because ImageMagick/libvips doesn't fit in
// pure JS and the production worker image carries those binaries.
// =============================================================================

import { env } from "@/config/env.js";
import { log } from "@/util/log.js";

// ---- MIME sniffing ---------------------------------------------------------
// We never trust client-supplied content-type for anything that gates
// behavior; this inspects magic bytes and returns a canonical type.

export type SniffedKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "pdf" | "mp4" | "webm" | "mov" | "docx" | "doc" | "unknown";

export function sniffBuffer(buf: Buffer): { kind: SniffedKind; mime: string } {
  if (buf.length < 12) return { kind: "unknown", mime: "application/octet-stream" };
  const b = (i: number): number => buf[i] ?? -1;

  // JPEG: FF D8 FF
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { kind: "jpeg", mime: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "png", mime: "image/png" };
  // GIF
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a")
    return { kind: "gif", mime: "image/gif" };
  // WEBP: RIFF....WEBP
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { kind: "webp", mime: "image/webp" };
  // PDF: %PDF-
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { kind: "pdf", mime: "application/pdf" };
  // ISOBMFF container (MP4, MOV, HEIC, M4V). Look at the `ftyp` box.
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (/heic|heix|mif1|msf1|heis|hevc|hevx/i.test(brand))
      return { kind: "heic", mime: "image/heic" };
    if (brand === "qt  " || brand.startsWith("qt"))
      return { kind: "mov", mime: "video/quicktime" };
    return { kind: "mp4", mime: "video/mp4" };
  }
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3)
    return { kind: "webm", mime: "video/webm" };
  if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])))
    return { kind: "doc", mime: "application/msword" };
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04)
    return {
      kind: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

  return { kind: "unknown", mime: "application/octet-stream" };
}

export function allowedMimeForKind(kind: "photo" | "video" | "document", mime: string): boolean {
  const m = mime.toLowerCase();
  if (kind === "photo") return ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(m);
  if (kind === "video")
    return ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"].includes(m);
  if (kind === "document")
    return [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(m);
  return false;
}

// ---- JPEG EXIF stripper ----------------------------------------------------
// Removes every APPn marker (EXIF/XMP lives in APP1), COM, and the thumbnail.
// Keeps SOFn/DHT/DQT/SOS/image data untouched so decoding is unaffected.

export function stripJpegMetadata(input: Buffer): Buffer {
  const at = (i: number): number => (i >= 0 && i < input.length ? input[i]! : -1);
  if (input.length < 4 || at(0) !== 0xff || at(1) !== 0xd8) return input;
  const out: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  while (i < input.length) {
    if (at(i) !== 0xff) break;
    let marker = at(i + 1);
    while (marker === 0xff && i + 2 < input.length) {
      i++;
      marker = at(i + 1);
    }
    i += 2;
    if (marker === 0xd9) {
      out.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (i + 2 > input.length) break;
    const segLen = input.readUInt16BE(i);
    const segEnd = i + segLen;
    if (segEnd > input.length) break;
    const isAppOrCom = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isAppOrCom) {
      out.push(Buffer.from([0xff, marker]));
      out.push(input.subarray(i, segEnd));
    }
    i = segEnd;
    if (marker === 0xda) {
      let j = i;
      while (j + 1 < input.length) {
        const next = at(j + 1);
        if (at(j) === 0xff && next !== 0x00 && !(next >= 0xd0 && next <= 0xd7)) {
          out.push(input.subarray(i, j));
          out.push(Buffer.from([0xff, next]));
          i = j + 2;
          if (next === 0xd9) {
            return Buffer.concat(out);
          }
        }
        j++;
      }
      out.push(input.subarray(i));
      break;
    }
  }
  return Buffer.concat(out);
}

// PNG metadata stripper — drops tEXt/zTXt/iTXt/tIME/eXIf chunks, keeps
// everything required to decode (IHDR, PLTE, IDAT, IEND, cHRM/gAMA/sRGB
// for color fidelity).
export function stripPngMetadata(input: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (input.length < 8 || !input.subarray(0, 8).equals(sig)) return input;
  const out: Buffer[] = [sig];
  let i = 8;
  const drop = new Set(["tEXt", "zTXt", "iTXt", "tIME", "eXIf"]);
  while (i + 8 <= input.length) {
    const len = input.readUInt32BE(i);
    const type = input.subarray(i + 4, i + 8).toString("ascii");
    const chunkEnd = i + 8 + len + 4;
    if (chunkEnd > input.length) break;
    if (!drop.has(type)) out.push(input.subarray(i, chunkEnd));
    i = chunkEnd;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

export function stripMetadata(buf: Buffer, detectedMime: string): { buf: Buffer; stripped: boolean } {
  if (detectedMime === "image/jpeg") return { buf: stripJpegMetadata(buf), stripped: true };
  if (detectedMime === "image/png") return { buf: stripPngMetadata(buf), stripped: true };
  // WebP/HEIC/video stripping is handled by the re-encoder in the production
  // worker image; return the buffer unchanged and let the derivative stage
  // produce the public artifact.
  return { buf, stripped: false };
}

// ---- Malware scanner -------------------------------------------------------

export type ScanResult = { ok: boolean; signature: string | null };

export async function scanBuffer(buf: Buffer): Promise<ScanResult> {
  if (!env.MALWARE_SCANNER_URL) {
    // Dev / test fallback. Flag EICAR so our fixtures work.
    const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    if (buf.includes(Buffer.from(EICAR))) return { ok: false, signature: "EICAR-Test-Signature" };
    return { ok: true, signature: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), env.MALWARE_SCANNER_TIMEOUT_MS);
  try {
    const res = await fetch(env.MALWARE_SCANNER_URL, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: buf,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "scan.endpoint_error");
      return { ok: false, signature: `scanner_error_${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { infected?: boolean; signature?: string };
    if (json.infected) return { ok: false, signature: json.signature ?? "unknown" };
    return { ok: true, signature: null };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : "unknown" }, "scan.failed");
    return { ok: false, signature: "scanner_unreachable" };
  } finally {
    clearTimeout(t);
  }
}

// ---- Image dimensions (header-only; no decoder) ----------------------------

export function readImageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // PNG — IHDR at bytes 16..24
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  const at = (i: number): number => buf[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (at(i) !== 0xff) return null;
      const m = at(i + 1);
      if (m === 0xd8 || m === 0xd9) return null;
      if (m >= 0xd0 && m <= 0xd7) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const sof = (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf);
      if (sof) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
      i += 2 + len;
    }
  }
  return null;
}
