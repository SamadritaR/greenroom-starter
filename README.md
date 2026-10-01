# Deal Capture

**Catching settlement disputes on Wednesday, when the deal is booked, instead of Friday at 2 a.m. when the show settles.**

A working prototype by Samadrita Roy, built on Greenroom, a codebase for independent music venues. Paste an agent's deal email and an LLM extracts the terms, quotes the source line behind each one, and flags every ambiguity with the dollars it puts at risk. The booker resolves each flag before show day, and the confirmed deal becomes the record everyone settles from.

| | |
|---|---|
| Full write up | [CASE_STUDY.md](CASE_STUDY.md) |
| Product memo | [Samadrita_Roy_Greenroom_Memo.pdf](Samadrita_Roy_Greenroom_Memo.pdf) |
| Deck | [Samadrita_Greenroom_Deck.pptx](Samadrita_Greenroom_Deck.pptx) (downloads as PowerPoint) |
| Try it | [Run the demo](#run-the-demo) |

---

## The finding that shaped the build

All 16 settlements marked "disputed" in the database had artist sign off that read as approval: "Looks good," "ok wire monday," "OK," a thumbs up. By the artist's own words, none of them were disputed. The status field had drifted away from what actually happened, and every report downstream was reading it as fact.

The drift runs the other way too. Coastal Spell, the March 2025 show at the center of a real marketing recoup fight, is marked `settled`.

That set the design rule. The agent's confirmation lives inside the deal record itself, timestamped and attributed to a signer. There is no separate status field left to fall out of sync, so the bug behind those 16 false disputes has nowhere to live.

## Why deal capture

Settlement looks like six problems: the math, audit trails, live prediction, the 2 a.m. walkthrough, agent follow up, and disputes. Five of them trace back to one root cause. The deal was never captured in a form both sides agreed on, so by show night nobody is working from the same facts.

The data said so before I wrote any code:

- 62% of deals at The Crescent fall outside what the app's settle tool can handle.
- 82% of Greenroom customers, including most of the larger venues, settle in spreadsheets instead.
- The booker writes deals as prose in `notes_freetext` because the structured fields can't hold what she negotiated.

Four interviews, four different jobs, one answer. The booker said most friction comes from things that were "knowable on Wednesday." The GM wanted to see before a show whether the deal would settle clean. The tour manager said ambiguous terms should be resolved when the deal is negotiated, never at the table. The WME agent asked for one agreed version of the deal in one place.

## What it does

| Step | What happens |
|---|---|
| Paste | The booker pastes the agent's deal email on the show page. |
| Extract | Llama 3.3 70B (via Groq) returns structured terms, each tied to the exact quote it came from. |
| Flag | Ambiguities that change money get an amber card with their dollar consequence. Clean terms highlight in blue on the original email. |
| Resolve | Each flag closes one of two ways: a drafted clarifying email to the agent, or the booker answers it herself. |
| Confirm | Both paths write to a `clarification` table with a `resolution_source` field, so you always know whether the agent or the venue settled the question. The deal turns green and becomes the source of truth. |

### The Coastal Spell case

The real dispute in the data: "$5,000 vs 80% of net after expenses, expenses capped at $2,500. $900 marketing recoup." Is the $900 inside the cap or outside it? Nobody asked on Wednesday, and it became a $720 fight after the show. Deal Capture flags that exact question at the moment the email is pasted.

## What I left out on purpose

**No settlement calculator.** Math on ambiguous inputs is the situation the venue already lives in. Once inputs are confirmed, the math becomes the easy part.

**No write back to the legacy deals table.** `deal_capture` is the new source of truth. Treating the old fields as reliable would bring back the confusion this build exists to remove.

**No agent app.** Agents live in email. An account, onboarding, and agency permissions would take weeks and change nothing about the idea.

**No 2 a.m. walkthrough or dispute UI.** Both sit downstream of capture. With a confirmed deal, the walkthrough becomes reading a trusted document.

## How I'd know it works

**Backtest first.** Run the extraction across 24 months of `notes_freetext` at The Crescent and match flags against the dispute history. The bar: 70% or more of past disputes trace to an ambiguity the system would have caught. Under 50% means the design needs rework.

**Then one live quarter.** Track time to first clarification sent (does the booker actually use the agent loop) and the post show dispute rate against the prior four quarters. A drop of a third or more earns a multi venue rollout.

The bigger risk is adoption, not accuracy. The booker already abandoned one tool that couldn't handle her deals. This one sits inside a step she already does, pasting the deal, instead of adding a new one.

## Run the demo

You'll need Node.js 20+ and a free [Groq API key](https://console.groq.com).

```bash
git checkout samadrita-deal-capture
echo "GROQ_API_KEY=your_key_here" > .env.local
npm install
npm run dev
```

The database ships with seed data and the new migrations already applied.

Open `http://localhost:3000/shows/show_coastal_spell_dispute/capture-deal`, click **Capture deal**, and paste:

```
$5,000 vs 80% of net after expenses, expenses capped at $2,500. $900 marketing recoup for the Spotify campaign we ran last week. Hospitality per rider.
```

Click **Extract terms**, then **See dollar impact** on the amber card. Harder cases (venue shorthand, walkout pots, a clean flat deal) are in [CASE_STUDY.md](CASE_STUDY.md#try-harder-cases).

## Where to look in the code

| File | Why it matters |
|---|---|
| [`lib/prompts/extract-deal.ts`](lib/prompts/extract-deal.ts) | The system prompt. Five sections: role framing, deal type taxonomy, what counts as a money changing ambiguity, grounded examples, and honest edge case handling. This is what decides extraction quality. |
| [`lib/deal-capture/extractionSchema.ts`](lib/deal-capture/extractionSchema.ts) | The structured output the model fills. |
| [`lib/deal-capture/highlightEmail.ts`](lib/deal-capture/highlightEmail.ts) | Maps each source quote back onto the original email. |
| [`lib/deal-capture/clarificationDraft.ts`](lib/deal-capture/clarificationDraft.ts) | Builds the clarifying email from the quote and the open question. |
| [`app/shows/[id]/capture-deal/`](app/shows/%5Bid%5D/capture-deal) | The route and client component. |
| [`app/api/deal-capture/`](app/api/deal-capture) | Extraction, confirmation, clarification, and resolution endpoints. |
| [`db/schema.ts`](db/schema.ts) | `deal_capture` and `clarification` tables, plus three migrations in `db/migrations/`. |

The clarification email and agent reply are mocked. A real version would send through the venue's outbound email and parse the reply, or use a one click confirm link.

## What I'd ship next

1. A settlement engine that reads the confirmed deal and traces every payout line back to a clause and a receipt.
2. Real outbound email plus reply parsing.
3. A magic link confirmation page so the agent confirms without writing a reply.
4. A dashboard showing ambiguities flagged at capture against disputes that actually happened, across every venue.

---

Built on the [Greenroom starter](https://github.com/samay-cbh/greenroom-starter). Original setup and troubleshooting notes live there.
