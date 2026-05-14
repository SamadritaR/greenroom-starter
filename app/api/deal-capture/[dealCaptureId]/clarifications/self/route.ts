import { NextResponse } from "next/server";
import { format } from "date-fns";
import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import { clarification, dealCapture } from "@/db/schema";
import { VENUE_BOOKER } from "@/lib/deal-capture/venueBooker";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  ambiguityIndex: z.number().int().min(0),
  ambiguitySummary: z.string().min(1),
  resolutionText: z.string().min(1),
  contextNote: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealCaptureId: string }> },
) {
  const { dealCaptureId } = await ctx.params;

  const [cap] = await db
    .select({ id: dealCapture.id })
    .from(dealCapture)
    .where(eq(dealCapture.id, dealCaptureId))
    .limit(1);
  if (!cap) {
    return NextResponse.json({ error: "Deal capture not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { ambiguityIndex, ambiguitySummary, resolutionText, contextNote } =
    parsed.data;

  const [agg] = await db
    .select({ seq: max(clarification.sequence) })
    .from(clarification)
    .where(eq(clarification.dealCaptureId, dealCaptureId));

  const nextSeq = (agg?.seq ?? 0) + 1;
  const clarificationId = crypto.randomUUID();
  const now = new Date();

  let resolutionNote = `Self-resolved: ${resolutionText.trim()}`;
  if (contextNote?.trim()) {
    resolutionNote += ` | Context: ${contextNote.trim()}`;
  }

  const headline = `Resolved by ${VENUE_BOOKER.fullName} (${VENUE_BOOKER.roleLabel}), ${format(now, "MMM d, yyyy 'at' h:mm a")}`;

  await db.insert(clarification).values({
    id: clarificationId,
    dealCaptureId,
    sequence: nextSeq,
    ambiguityIndex,
    ambiguitySummary,
    outboundBody:
      "No outbound email — self-resolved by venue booker in Greenroom (audited capture).",
    mockInboundReply: contextNote?.trim()
      ? `Venue note: ${contextNote.trim()}`
      : null,
    resolutionNote,
    resolvedAt: now,
    resolutionSource: "self",
    createdAt: now,
  });

  return NextResponse.json({
    clarificationId,
    resolutionNote,
    headline,
    resolvedAt: now.toISOString(),
  });
}
