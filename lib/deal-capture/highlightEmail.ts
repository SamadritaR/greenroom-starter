import type { DealExtraction } from "@/lib/deal-capture/extractionSchema";

export type HighlightKind = "plain" | "term" | "ambiguity" | "resolved";

export type EmailSegment = { kind: HighlightKind; text: string };

export type BuildEmailSegmentsOptions = {
  /** Ambiguity indices that have been agent-confirmed (green highlights). */
  resolvedAmbiguityIndices?: ReadonlySet<number>;
};

/**
 * Split pasted email into runs for highlighting: resolved ambiguity quotes
 * (green), then unresolved ambiguity (amber), then term quotes (blue).
 */
export function buildEmailSegments(
  email: string,
  extraction: DealExtraction,
  options?: BuildEmailSegmentsOptions,
): EmailSegment[] {
  if (!email) return [];

  const resolved = options?.resolvedAmbiguityIndices ?? new Set<number>();
  const marks: Array<"term" | "ambiguity" | "resolved" | null> = Array(
    email.length,
  ).fill(null);

  function paint(needle: string, kind: "term" | "ambiguity" | "resolved") {
    const n = needle.trim();
    if (!n) return;
    let from = 0;
    while (from < email.length) {
      const i = email.indexOf(n, from);
      if (i === -1) break;
      for (let p = i; p < i + n.length; p++) {
        if (kind === "resolved") marks[p] = "resolved";
        else if (marks[p] === "resolved") {
          /* keep resolved */
        } else if (kind === "ambiguity") marks[p] = "ambiguity";
        else if (marks[p] == null) marks[p] = "term";
      }
      from = i + Math.max(1, n.length);
    }
  }

  for (const t of extraction.terms) {
    for (const sq of t.sourceQuotes) {
      paint(sq.text, "term");
    }
  }

  extraction.ambiguities.forEach((a, idx) => {
    if (resolved.has(idx)) return;
    for (const sq of a.sourceQuotes) {
      paint(sq.text, "ambiguity");
    }
  });

  extraction.ambiguities.forEach((a, idx) => {
    if (!resolved.has(idx)) return;
    for (const sq of a.sourceQuotes) {
      paint(sq.text, "resolved");
    }
  });

  const segments: EmailSegment[] = [];
  let i = 0;
  while (i < email.length) {
    const m = marks[i];
    const kind: HighlightKind = m ?? "plain";
    let j = i + 1;
    while (j < email.length && (marks[j] ?? "plain") === kind) j++;
    segments.push({ kind, text: email.slice(i, j) });
    i = j;
  }

  return segments;
}
