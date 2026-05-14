/**
 * Structured deal extraction contract. Zod validates model output server-side.
 */

import { z } from "zod";

const confidenceEnum = z.enum(["high", "medium", "low"]);

export const sourceQuoteSchema = z.object({
  /** Verbatim substring from the email (short phrase or sentence). */
  text: z.string(),
  /** Optional short note on where this appears (e.g. "second paragraph"). */
  context: z.string().nullish(),
});

export const extractedTermSchema = z.object({
  /** Stable machine key, e.g. guarantee, versus_split, expense_cap. */
  key: z.string(),
  /** Human-readable label for UI. */
  label: z.string(),
  /** Normalized interpretation (amounts in USD when numeric). */
  value: z.string(),
  confidence: confidenceEnum.nullish(),
  /** One or more verbatim quotes supporting this term. */
  sourceQuotes: z.array(sourceQuoteSchema),
});

export const ambiguitySchema = z.object({
  /** Short title for the ambiguity. */
  summary: z.string(),
  /** Why two readings are plausible. */
  whyAmbiguous: z.string(),
  /**
   * Rough order-of-magnitude dollar swing between reasonable readings
   * (venue vs artist perspective). Omit if unknown.
   */
  estimatedDollarImpactUsd: z.number().nullish(),
  /** Quotes that carry the conflicting language. */
  sourceQuotes: z.array(sourceQuoteSchema),
});

export const dealExtractionSchema = z.object({
  terms: z.array(extractedTermSchema),
  ambiguities: z.array(ambiguitySchema),
  overallConfidence: confidenceEnum.nullish(),
});

export type DealExtraction = z.infer<typeof dealExtractionSchema>;
export type ExtractedTerm = z.infer<typeof extractedTermSchema>;
export type Ambiguity = z.infer<typeof ambiguitySchema>;
export type SourceQuote = z.infer<typeof sourceQuoteSchema>;
