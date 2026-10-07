import type { DraftFields } from "./provider.js";
import type { AiValidationFinding, AiValidationResult } from "@/models/AiGeneration.js";

// =============================================================================
// §17.3 — fact-check validators. The rule is strict: anything factual in
// the AI output must appear in the input. Factual here means:
//
//   • numbers      (digits, written cardinals, percentages)
//   • dates        (ISO, long form, month names)
//   • currency     (digit amounts with/without a symbol)
//   • named people (capitalised multi-word spans not in a safelist)
//   • named places (same heuristic — only flagged if the input context
//                   contains place prompts; otherwise it's just a word)
//
// This is a defensive, deterministic layer — not a perfect NLP pipeline. A
// false positive asks the reviewer to look; a false negative is caught by
// the attestation (§17.2 step 6).
// =============================================================================

const COMMON_WORDS = new Set([
  "The", "A", "An", "This", "That", "These", "Those", "We", "Our", "Us",
  "I", "They", "Their", "Them", "You", "Your", "It", "Its", "He", "She",
  "His", "Her", "In", "On", "At", "To", "From", "For", "With", "By",
  "Of", "And", "Or", "But", "So", "If", "When", "While", "After", "Before",
  "During", "Children", "Child", "Family", "Families", "School", "Village",
  "Team", "Project", "Programme", "Program", "Report", "Update", "Monday",
  "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Draft", "Supplied", "Facts",
]);

const MONTHS = new Set([
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
]);

const WRITTEN_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1_000_000,
};

export function extractNumbers(s: string): string[] {
  const out = new Set<string>();
  // Numeric literals, with optional thousands separators and decimals.
  // Keep the normalised digits-only form as the key so "1,200" and "1200"
  // compare equal.
  for (const m of s.matchAll(/[-+]?\d[\d,]*(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, "");
    if (/^\d/.test(n) || /^[-+]\d/.test(n)) out.add(n);
  }
  // Written cardinals — we normalise to the digit form so "twenty" and "20"
  // match. Lowercase the token to catch sentence-initial capitalisation.
  for (const m of s.matchAll(/\b([A-Za-z]+)\b/g)) {
    const v = WRITTEN_NUMBERS[m[1]!.toLowerCase()];
    if (v !== undefined) out.add(String(v));
  }
  return [...out];
}

export function extractDates(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) out.add(m[0]);
  for (const m of s.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g)) out.add(m[0]);
  // Long form: "March 3", "3 March", "March 3, 2026"
  for (const m of s.matchAll(/\b([A-Z][a-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?/g)) {
    if (MONTHS.has(m[1]!)) out.add(`${m[1]} ${m[2]}${m[3] ? ` ${m[3]}` : ""}`);
  }
  for (const m of s.matchAll(/\b(\d{1,2})\s+([A-Z][a-z]+)(?:\s+(\d{4}))?/g)) {
    if (MONTHS.has(m[2]!)) out.add(`${m[1]} ${m[2]}${m[3] ? ` ${m[3]}` : ""}`);
  }
  return [...out];
}

export function extractCurrency(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(/(?:[$£€]|USD|UGX|EUR|GBP|KES)\s*\d[\d,]*(?:\.\d+)?/gi)) {
    out.add(m[0].replace(/\s+/g, " "));
  }
  return [...out];
}

export function extractProperNouns(s: string): string[] {
  const out = new Set<string>();
  // Capture one-or-more sequential capitalised tokens. Normalise whitespace.
  // Filter: single tokens must not be in COMMON_WORDS. Multi-token sequences
  // are always kept.
  for (const m of s.matchAll(/\b([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)*)\b/g)) {
    const span = m[0];
    const parts = span.split(/\s+/);
    if (parts.length === 1 && COMMON_WORDS.has(parts[0]!)) continue;
    if (parts.length === 1 && MONTHS.has(parts[0]!)) continue;
    out.add(span);
  }
  return [...out];
}

// Case-insensitive, whitespace-insensitive containment check — used so
// "Mary Namusoke" matches "mary  namusoke" in the input.
function haystackHas(hay: string, needle: string): boolean {
  const h = hay.toLowerCase().replace(/\s+/g, " ");
  const n = needle.toLowerCase().replace(/\s+/g, " ");
  return h.includes(n);
}

export type ValidateInput = {
  // Everything the model saw plus every pre-known fact (project name,
  // category, milestone, pre-entered numbers, dates). Facts outside this
  // string are "unknown" and will be flagged.
  input_text: string;
};

export function validateDraft(fields: DraftFields, input: ValidateInput): AiValidationResult {
  const findings: AiValidationFinding[] = [];
  const highlights: AiValidationResult["highlights"] = [];
  const hay = input.input_text;

  const checks: Array<{ field: keyof DraftFields; text: string }> = [
    { field: "title", text: fields.title },
    { field: "body", text: fields.body },
    { field: "why_it_matters", text: fields.why_it_matters },
    { field: "next_steps", text: fields.next_steps },
  ];

  for (const { field, text } of checks) {
    if (!text) continue;

    for (const n of extractNumbers(text)) {
      // The input is normalised the same way for comparison.
      const inputNums = new Set(extractNumbers(hay));
      if (!inputNums.has(n)) {
        findings.push({ kind: "unknown_number", span: n, field });
        highlights.push({ field, text: n, reason: "number not in field report" });
      }
    }

    for (const d of extractDates(text)) {
      const inputDates = new Set(extractDates(hay).map((x) => x.toLowerCase()));
      if (!inputDates.has(d.toLowerCase()) && !haystackHas(hay, d)) {
        findings.push({ kind: "unknown_date", span: d, field });
        highlights.push({ field, text: d, reason: "date not in field report" });
      }
    }

    for (const c of extractCurrency(text)) {
      if (!haystackHas(hay, c)) {
        findings.push({ kind: "unknown_number", span: c, field });
        highlights.push({ field, text: c, reason: "amount not in field report" });
      }
    }

    for (const name of extractProperNouns(text)) {
      // Lone names already in the input (as proper nouns) are fine. Novel
      // multi-word names in the OUTPUT that aren't in the input are flagged.
      if (!haystackHas(hay, name)) {
        findings.push({ kind: "unknown_name", span: name, field });
        highlights.push({ field, text: name, reason: "name not in field report" });
      }
    }

    // Length guards. Title and summary blow-ups usually mean the model
    // started hallucinating a story.
    if (field === "title" && text.length > 200) {
      findings.push({ kind: "length", span: "title_too_long", field });
    }
    if (field === "body" && text.length > 10_000) {
      findings.push({ kind: "length", span: "body_too_long", field });
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    highlights,
  };
}

// -------- Name masking (§17.2 step 1) ----------------------------------------
// Replace capitalised multi-word names in a field report with placeholders
// before the text is sent to the provider. The lookup table is returned so
// the reviewer sees the original on screen but the provider never does.

export type NameMask = {
  masked: string;
  // placeholder → original (so the UI can expand them back for display)
  swaps: Record<string, string>;
};

export function maskNames(text: string): NameMask {
  const swaps: Record<string, string> = {};
  let i = 0;
  const masked = text.replace(
    /\b([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)+)\b/g,
    (span) => {
      // Keep known safe spans (month-prefixed dates) intact.
      const first = span.split(/\s+/)[0]!;
      if (MONTHS.has(first)) return span;
      const key = `[PERSON_${++i}]`;
      swaps[key] = span;
      return key;
    }
  );
  return { masked, swaps };
}
