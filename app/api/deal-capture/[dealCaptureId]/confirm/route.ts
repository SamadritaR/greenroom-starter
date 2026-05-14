import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dealCapture } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
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

  const now = new Date();
  await db
    .update(dealCapture)
    .set({
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(dealCapture.id, dealCaptureId));

  return NextResponse.json({ ok: true });
}
