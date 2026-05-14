import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clarification } from "@/db/schema";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  mockInboundReply: z.string().min(1),
  resolutionNote: z.string().min(1),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ clarificationId: string }> },
) {
  const { clarificationId } = await ctx.params;

  const [row] = await db
    .select({ id: clarification.id })
    .from(clarification)
    .where(eq(clarification.id, clarificationId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Clarification not found" }, { status: 404 });
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

  const now = new Date();
  await db
    .update(clarification)
    .set({
      mockInboundReply: parsed.data.mockInboundReply,
      resolutionNote: parsed.data.resolutionNote,
      resolvedAt: now,
      resolutionSource: "agent",
    })
    .where(eq(clarification.id, clarificationId));

  return NextResponse.json({ ok: true });
}
