import type { DealExtraction } from "@/lib/deal-capture/extractionSchema";

export type AgentContact = {
  name: string;
  email: string;
  agencyName: string;
};

export const PLACEHOLDER_AGENT: AgentContact = {
  name: "Booking agent",
  email: "agent@example.com",
  agencyName: "Agency TBD",
};

function firstName(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? "there";
}

export function buildClarificationSubject(artistName: string): string {
  return `Quick clarification on ${artistName} deal`;
}

export function buildClarificationBody(input: {
  artistName: string;
  agentContact: AgentContact;
  ambiguity: DealExtraction["ambiguities"][number];
}): string {
  const { artistName, agentContact, ambiguity } = input;
  const greet = firstName(agentContact.name);
  const quote =
    ambiguity.sourceQuotes.find((q) => q.text?.trim())?.text?.trim() ??
    "(the relevant line from your email)";

  return `Hi ${greet},

Hope you're doing well. I'm capturing the ${artistName} deal in Greenroom so our settlement stays aligned with what we both understood at booking.

In your note you mentioned: "${quote}"

Could you help me confirm: ${ambiguity.summary}

Just want to make sure we're reading it the same way before we get to show night — always easier on a Wednesday than at 2am on a Friday.

Thanks,
Mariana Reyes
The Crescent · Nashville
mariana@thecrescentnashville.com`;
}

export function buildMockAgentReply(input: {
  ambiguity: DealExtraction["ambiguities"][number];
}): string {
  return `Thanks Mariana — confirming for settlement: we'll read "${input.ambiguity.sourceQuotes[0]?.text?.slice(0, 80) ?? "that language"}" in line with your question on ${input.ambiguity.summary.toLowerCase().replace(/\?$/, "")}. Appreciate you flagging it early.`;
}
