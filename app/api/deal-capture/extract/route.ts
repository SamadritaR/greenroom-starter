import { NextResponse } from "next/server";
import { dealExtractionSchema } from "@/lib/deal-capture/extractionSchema";
import { generateStructuredJson } from "@/lib/llm/groq";
import {
  EXTRACT_DEAL_SYSTEM_INSTRUCTION,
  buildExtractDealUserMessage,
} from "@/lib/prompts/extract-deal";

export const runtime = "nodejs";

const MAX_EMAIL_CHARS = 80_000;

type ExtractBody = {
  email?: unknown;
  pastedEmail?: unknown;
};

function readEmail(body: ExtractBody): string | null {
  const raw =
    typeof body.email === "string"
      ? body.email
      : typeof body.pastedEmail === "string"
        ? body.pastedEmail
        : null;
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: ExtractBody;
  try {
    body = (await req.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = readEmail(body);
  if (email === null) {
    return NextResponse.json(
      { error: "Provide non-empty `email` or `pastedEmail` (string)." },
      { status: 400 },
    );
  }

  if (email.length > MAX_EMAIL_CHARS) {
    return NextResponse.json(
      { error: `Email body exceeds ${MAX_EMAIL_CHARS} characters` },
      { status: 400 },
    );
  }

  let rawJson: string;
  try {
    rawJson = await generateStructuredJson({
      systemInstruction: EXTRACT_DEAL_SYSTEM_INSTRUCTION,
      userPrompt: buildExtractDealUserMessage(email),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[deal-capture/extract]", e);
    return NextResponse.json(
      { error: "Groq request failed", message },
      { status: 502 },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Model returned non-JSON text", raw: rawJson },
      { status: 502 },
    );
  }

  const parsed = dealExtractionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Model output failed Zod validation",
        issues: parsed.error.issues,
        raw: parsedJson,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ extraction: parsed.data });
}
