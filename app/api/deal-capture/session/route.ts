import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dealCapture, shows } from "@/db/schema";
import { dealExtractionSchema } from "@/lib/deal-capture/extractionSchema";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  showId: z.string().min(1),
  pastedEmail: z.string(),
  extraction: dealExtractionSchema,
});

export async function POST(req: Request) {
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

  const { showId, pastedEmail, extraction } = parsed.data;

  const [row] = await db
    .select({ id: shows.id })
    .from(shows)
    .where(eq(shows.id, showId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(dealCapture).values({
    id,
    showId,
    status: "extracted",
    pastedEmail,
    extractionJson: JSON.stringify(extraction),
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ dealCaptureId: id });
}
