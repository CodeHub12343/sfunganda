import { describe, it, expect } from "vitest";
import {
  extractNumbers,
  extractDates,
  extractProperNouns,
  maskNames,
  validateDraft,
} from "../src/services/ai/validators.js";

// Phase 10 — §17.5 evaluation fixtures. The rule: a draft that introduces a
// number, date, name or place not present in the input must be flagged.

describe("ai validators — numeric extraction", () => {
  it("normalises thousands separators", () => {
    expect(extractNumbers("We served 1,200 meals")).toContain("1200");
    expect(extractNumbers("1200 meals")).toContain("1200");
  });
  it("picks up written cardinals", () => {
    expect(extractNumbers("twenty children")).toContain("20");
    expect(extractNumbers("twelve wells")).toContain("12");
  });
  it("handles decimals", () => {
    expect(extractNumbers("3.5 tonnes")).toContain("3.5");
  });
});

describe("ai validators — date extraction", () => {
  it("matches ISO and long-form dates", () => {
    expect(extractDates("on 2026-02-01")).toContain("2026-02-01");
    expect(extractDates("on March 3")).toContain("March 3");
    expect(extractDates("March 3, 2026")).toContain("March 3 2026");
  });
});

describe("ai validators — proper nouns", () => {
  it("captures multi-word names and skips common words", () => {
    expect(extractProperNouns("Mary Namusoke met with the Project Manager")).toContain("Mary Namusoke");
    expect(extractProperNouns("We opened the school")).toEqual([]);
  });
});

describe("ai validators — maskNames", () => {
  it("replaces person names with placeholders and leaves months intact", () => {
    const r = maskNames("Mary Namusoke and John Okello visited on March 3");
    expect(r.masked).not.toContain("Mary Namusoke");
    expect(r.masked).toContain("[PERSON_1]");
    expect(r.masked).toContain("[PERSON_2]");
    expect(r.masked).toContain("March 3");
    expect(r.swaps["[PERSON_1]"]).toBe("Mary Namusoke");
  });
});

describe("ai validators — validateDraft (defining the done criterion)", () => {
  const input = {
    input_text: [
      "Project: Clean Water",
      "Date: 2026-02-01",
      "Field report:",
      "We finished the first well in North Parish. Twelve families now have clean water.",
    ].join("\n"),
  };

  it("passes a draft that uses only supplied facts", () => {
    const r = validateDraft(
      {
        title: "First well in North Parish",
        body: "The team finished a well on 2026-02-01. 12 families now have clean water.",
        why_it_matters: "Clean water reduces disease.",
        next_steps: "",
        facts_used: ["12 families", "North Parish"],
      },
      input
    );
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("flags an injected number not present in the input (DoD §17 — injected false number)", () => {
    const r = validateDraft(
      {
        title: "First well",
        body: "The team finished the well on 2026-02-01. 350 families now have clean water.",
        why_it_matters: "",
        next_steps: "",
        facts_used: [],
      },
      input
    );
    expect(r.ok).toBe(false);
    expect(r.findings.map((f) => f.span)).toContain("350");
    expect(r.highlights.some((h) => h.text === "350")).toBe(true);
  });

  it("flags an injected name not present in the input", () => {
    const r = validateDraft(
      {
        title: "First well",
        body: "The team led by John Okello finished the well.",
        why_it_matters: "",
        next_steps: "",
        facts_used: [],
      },
      input
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.kind === "unknown_name")).toBe(true);
  });

  it("flags an injected date not present in the input", () => {
    const r = validateDraft(
      {
        title: "First well",
        body: "The team finished on 2027-05-10.",
        why_it_matters: "",
        next_steps: "",
        facts_used: [],
      },
      input
    );
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.kind === "unknown_date" || f.kind === "unknown_number")).toBe(true);
  });
});
