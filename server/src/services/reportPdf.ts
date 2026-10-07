import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import PDFDocument from "pdfkit";
import type { ImpactReportDoc } from "@/models/ImpactReport.js";

// =============================================================================
// Report PDF renderer (Phase 9). PDF/UA basics via pdfkit's tagged-document
// support: a document title, a lang, structure tags (Document → H1 / H2 /
// P / L / LI / Figure) so screen readers can navigate the file.
//
// Fonts are the built-in Helvetica family. These are PDF-standard-14 fonts
// — a widely-supported choice that NEVER depends on a font being installed
// on a reader's device. Branded typefaces are a Phase 10 extension.
//
// This function is DETERMINISTIC given the input: the same (report,
// snapshot) always produces the same bytes (modulo pdfkit's own internal
// stream metadata). The caller stamps the snapshot_content_hash into the
// export row so a reviewer can confirm the PDF matches the approved
// numbers.
// =============================================================================

export type RenderOptions = {
  title_prefix?: string; // "Impact report" by default
};

export type RenderResult = {
  buffer: Buffer;
  pages: number;
  sha256: string;
  tagged: boolean;
};

// Keep the brand palette out of the service — PDFs stay neutral until we
// install a real typeface.
const COLORS = {
  trustBlue: "#103D7A",
  foundationGreen: "#1E5D35",
  ink: "#1A1A1A",
  muted: "#555555",
  rule: "#B0B6BE",
};

function money(cents: number, ccy: string): string {
  const v = cents / 100;
  try {
    return v.toLocaleString("en-US", { style: "currency", currency: ccy });
  } catch {
    return `${ccy} ${v.toFixed(2)}`;
  }
}

export async function renderReportPdf(report: ImpactReportDoc, opts: RenderOptions = {}): Promise<RenderResult> {
  if (!report.snapshot) throw new Error("report has no snapshot");

  const snap = report.snapshot;
  const titlePrefix = opts.title_prefix ?? "Impact report";

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    pdfVersion: "1.7",
    tagged: true,
    lang: "en-US",
    displayTitle: true,
    info: {
      Title: `${titlePrefix} · ${snap.period_code} · ${report.title}`,
      Author: "Sarah's Foundation",
      Subject: `Public impact report for ${snap.period_code}`,
      Creator: "Sarah's Foundation — report compiler " + snap.compiler_version,
      Producer: "pdfkit",
      Keywords: `impact,report,${snap.period_code}`,
      CreationDate: new Date(snap.compiled_at),
    },
  });

  // Collect bytes.
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });

  // Pdfkit's structure API: mark content inside a struct tree so screen
  // readers follow it in reading order. We register a Document root and
  // tag each heading / paragraph / list.
  const struct = doc.struct;

  const DocRoot = struct("Document");
  doc.addStructure(DocRoot);

  function H1(text: string): void {
    doc.font("Helvetica-Bold").fillColor(COLORS.trustBlue).fontSize(22);
    const el = struct("H1", () => doc.text(text, { paragraphGap: 8 }));
    DocRoot.add(el);
  }
  function H2(text: string): void {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fillColor(COLORS.foundationGreen).fontSize(14);
    const el = struct("H2", () => doc.text(text, { paragraphGap: 4 }));
    DocRoot.add(el);
  }
  function P(text: string): void {
    doc.font("Helvetica").fillColor(COLORS.ink).fontSize(10.5);
    const el = struct("P", () => doc.text(text, { paragraphGap: 6, lineGap: 2 }));
    DocRoot.add(el);
  }
  function Muted(text: string): void {
    doc.font("Helvetica-Oblique").fillColor(COLORS.muted).fontSize(9);
    const el = struct("Caption", () => doc.text(text, { paragraphGap: 4 }));
    DocRoot.add(el);
  }
  function HR(): void {
    const y = doc.y + 4;
    doc.strokeColor(COLORS.rule).lineWidth(0.5).moveTo(54, y).lineTo(doc.page.width - 54, y).stroke();
    doc.y = y + 10;
  }
  function KeyValue(rows: Array<[string, string]>): void {
    const list = struct("L");
    for (const [k, v] of rows) {
      list.add(
        struct("LI", () => {
          doc.font("Helvetica").fillColor(COLORS.muted).fontSize(9);
          doc.text(k, { continued: true });
          doc.font("Helvetica-Bold").fillColor(COLORS.ink).fontSize(10);
          doc.text("  " + v, { paragraphGap: 2 });
        })
      );
    }
    DocRoot.add(list);
  }

  // ---- Content ----
  H1(`${titlePrefix} · ${snap.period_code}`);
  P(report.title);
  Muted(
    `Period ${snap.period_start.slice(0, 10)} to ${snap.period_end.slice(0, 10)} · ` +
      `Compiled ${snap.compiled_at.slice(0, 10)} with ${snap.compiler_version} · ` +
      `Content hash ${snap.content_hash.slice(0, 16)}…`
  );
  HR();

  if (report.summary.trim()) {
    H2("Summary");
    P(report.summary);
  }

  if (report.body_markdown.trim()) {
    H2("Story");
    // Minimal markdown — only paragraph breaks and simple **bold**. Real
    // formatting is left to future revisions.
    const paragraphs = report.body_markdown.split(/\n\n+/);
    for (const para of paragraphs) {
      P(para.replace(/\*\*(.+?)\*\*/g, "$1"));
    }
  }

  H2("Totals");
  KeyValue([
    ["Projects", String(snap.totals.projects)],
    ["Communities", String(snap.totals.communities)],
    ["Published accomplishments in period", String(snap.totals.accomplishments)],
    ["Public businesses", String(snap.totals.businesses)],
  ]);

  H2("Finance");
  KeyValue([
    ["Donations received", money(snap.finance.donations_received_base_cents, snap.finance.base_currency)],
    ["Operating expenses", money(snap.finance.operating_expenses_base_cents, snap.finance.base_currency)],
    ["Programme expenses", money(snap.finance.programme_expenses_base_cents, snap.finance.base_currency)],
    ["Business revenue", money(snap.finance.business_revenue_base_cents, snap.finance.base_currency)],
    ["Sustainability ratio", `${(snap.finance.sustainability_ratio * 100).toFixed(0)}%`],
  ]);

  if (snap.finance.fund_balances.length > 0) {
    H2("Fund balances");
    KeyValue(
      snap.finance.fund_balances.map((f) => [
        `${f.name} (${f.code})`,
        money(f.balance_cents, snap.finance.base_currency),
      ])
    );
  }

  if (snap.accomplishments.length > 0) {
    H2("Published accomplishments");
    const list = struct("L");
    for (const a of snap.accomplishments.slice(0, 50)) {
      list.add(
        struct("LI", () => {
          doc.font("Helvetica-Bold").fillColor(COLORS.ink).fontSize(10);
          doc.text(`${a.public_id} · ${a.title}`, { continued: false });
          doc.font("Helvetica-Oblique").fillColor(COLORS.muted).fontSize(9);
          doc.text(`${a.project_slug} · ${a.community_slug} · ${a.occurred_on.slice(0, 10)}`, {
            paragraphGap: 3,
          });
        })
      );
    }
    DocRoot.add(list);
  }

  // Approval footprint
  H2("Approval");
  const approvalRows: Array<[string, string]> = [
    ["Compiled by", snap.compiled_by],
    ["Compiler", snap.compiler_version],
    ["Content hash", snap.content_hash],
  ];
  if (report.finance_signed_by) {
    approvalRows.push(["Finance signed", `${report.finance_signed_by.toString()} on ${report.finance_signed_at?.toISOString() ?? ""}`]);
  }
  if (report.approved_by) {
    approvalRows.push(["Approved", `${report.approved_by.toString()} on ${report.approved_at?.toISOString() ?? ""}`]);
  }
  if (report.published_by) {
    approvalRows.push(["Published", `${report.published_by.toString()} on ${report.published_at?.toISOString() ?? ""}`]);
  }
  KeyValue(approvalRows);

  // Footer on each page.
  const pageCountStart = doc.bufferedPageRange().start;
  const pageCountEnd = pageCountStart + doc.bufferedPageRange().count - 1;
  for (let i = pageCountStart; i <= pageCountEnd; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fillColor(COLORS.muted).fontSize(8);
    doc.text(
      `Sarah's Foundation — ${snap.period_code} · page ${i - pageCountStart + 1} of ${pageCountEnd - pageCountStart + 1}`,
      54,
      doc.page.height - 36,
      { align: "left", lineBreak: false }
    );
  }

  DocRoot.end();
  doc.end();
  await done;

  const buffer = Buffer.concat(chunks);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const pages = pageCountEnd - pageCountStart + 1;
  return { buffer, pages, sha256, tagged: true };
}
