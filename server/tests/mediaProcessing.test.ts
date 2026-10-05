import { describe, expect, it } from "vitest";
import "./setup.js";
import {
  allowedMimeForKind,
  readImageDimensions,
  scanBuffer,
  sniffBuffer,
  stripJpegMetadata,
  stripMetadata,
  stripPngMetadata,
} from "@/services/mediaProcessing.js";

// Minimal, deterministic 1x1 JPEG with an APP1 (EXIF) segment carrying a
// forged GPS tag "lat=51.5074, lon=-0.1278" (London) in a tiny TIFF layout.
// We don't verify the EXIF parsed to GPS — just that the serialized bytes
// show up in the input and are absent from the output.
function buildGeotaggedJpeg(): Buffer {
  // SOI
  const soi = Buffer.from([0xff, 0xd8]);
  // APP1 (EXIF)
  const exifBody = Buffer.concat([
    Buffer.from("Exif\x00\x00", "binary"),
    Buffer.from("MM\x00*\x00\x00\x00\x08", "binary"),
    Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    Buffer.from("GPSLatitude=51.5074;GPSLongitude=-0.1278", "ascii"),
  ]);
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    be16(exifBody.length + 2),
    exifBody,
  ]);
  // Minimal SOF0 (we don't care about validity; we only test byte-strip
  // behavior preserves non-APP markers).
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0]),
    be16(17),
    Buffer.from([
      0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]),
  ]);
  // SOS + minimal entropy data + EOI
  const sos = Buffer.concat([
    Buffer.from([0xff, 0xda]),
    be16(12),
    Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]),
    // one byte of entropy-coded data
    Buffer.from([0x00]),
  ]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app1, sof0, sos, eoi]);
}

function be16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n, 0);
  return b;
}

function buildPngWithText(): Buffer {
  // Minimal PNG: signature + IHDR + tEXt + IDAT + IEND. The chunks need
  // valid CRCs; we compute them so the strip walks correctly.
  const crc = (buf: Buffer): Buffer => {
    let c = ~0 >>> 0;
    const table = pngCrcTable();
    for (const by of buf) c = ((table[(c ^ by) & 0xff] ?? 0) ^ (c >>> 8)) >>> 0;
    const out = Buffer.alloc(4);
    out.writeUInt32BE((~c) >>> 0, 0);
    return out;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    return Buffer.concat([len, typeBuf, data, crc(Buffer.concat([typeBuf, data]))]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk(
    "IHDR",
    Buffer.concat([be32(1), be32(1), Buffer.from([8, 2, 0, 0, 0])])
  );
  const text = chunk("tEXt", Buffer.from("Comment\x00hello world", "ascii"));
  const idat = chunk("IDAT", Buffer.from([0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x00, 0x01]));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, text, idat, iend]);
}

function be32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function pngCrcTable(): number[] {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
    t[n] = c >>> 0;
  }
  return t;
}

describe("mime sniffing (C6 — type confusion fixtures)", () => {
  it("recognizes a JPEG by its magic bytes", () => {
    const buf = buildGeotaggedJpeg();
    const s = sniffBuffer(buf);
    expect(s.kind).toBe("jpeg");
    expect(s.mime).toBe("image/jpeg");
  });

  it("recognizes a PNG by signature", () => {
    const buf = buildPngWithText();
    expect(sniffBuffer(buf).mime).toBe("image/png");
  });

  it("rejects a PDF-declared file that is actually a JPEG", () => {
    const buf = buildGeotaggedJpeg();
    const detected = sniffBuffer(buf).mime;
    expect(allowedMimeForKind("document", detected)).toBe(false);
    expect(allowedMimeForKind("photo", detected)).toBe(true);
  });

  it("rejects a photo-declared file that is actually a ZIP container", () => {
    const zipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const detected = sniffBuffer(zipBuf).mime;
    expect(allowedMimeForKind("photo", detected)).toBe(false);
  });

  it("detects an MP4/ISOBMFF container by ftyp box", () => {
    const buf = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from("ftyp", "ascii"),
      Buffer.from("isom", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(sniffBuffer(buf).kind).toBe("mp4");
  });
});

describe("EXIF stripping (C7 — geotagged fixture)", () => {
  it("removes APP1/EXIF segments from a JPEG while preserving decode markers", () => {
    const input = buildGeotaggedJpeg();
    expect(input.indexOf(Buffer.from("GPSLatitude"))).toBeGreaterThanOrEqual(0);
    const out = stripJpegMetadata(input);
    expect(out.indexOf(Buffer.from("GPSLatitude"))).toBe(-1);
    expect(out.indexOf(Buffer.from("Exif\x00\x00"))).toBe(-1);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    // SOF0 marker must still be present after stripping.
    let hasSof = false;
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i] === 0xff && out[i + 1] === 0xc0) {
        hasSof = true;
        break;
      }
    }
    expect(hasSof).toBe(true);
  });

  it("removes tEXt chunks from a PNG", () => {
    const png = buildPngWithText();
    expect(png.indexOf(Buffer.from("hello world"))).toBeGreaterThanOrEqual(0);
    const out = stripPngMetadata(png);
    expect(out.indexOf(Buffer.from("hello world"))).toBe(-1);
    expect(out.subarray(0, 8).equals(png.subarray(0, 8))).toBe(true);
  });

  it("stripMetadata reports stripped=true for JPEG/PNG and false for unknown", () => {
    const j = stripMetadata(buildGeotaggedJpeg(), "image/jpeg");
    expect(j.stripped).toBe(true);
    const u = stripMetadata(Buffer.from([0x00, 0x01, 0x02]), "application/octet-stream");
    expect(u.stripped).toBe(false);
  });
});

describe("readImageDimensions", () => {
  it("reads PNG dimensions from IHDR", () => {
    const png = buildPngWithText();
    expect(readImageDimensions(png)).toEqual({ width: 1, height: 1 });
  });

  it("reads JPEG dimensions from SOF0", () => {
    const jpeg = buildGeotaggedJpeg();
    const dim = readImageDimensions(jpeg);
    expect(dim).not.toBeNull();
    expect(dim?.width).toBe(1);
    expect(dim?.height).toBe(1);
  });
});

describe("scanBuffer (dev fallback)", () => {
  it("flags EICAR as infected", async () => {
    const EICAR = Buffer.from(
      "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
      "ascii"
    );
    const r = await scanBuffer(EICAR);
    expect(r.ok).toBe(false);
    expect(r.signature).toContain("EICAR");
  });

  it("passes an innocuous buffer", async () => {
    const r = await scanBuffer(Buffer.from("hello"));
    expect(r.ok).toBe(true);
  });
});
