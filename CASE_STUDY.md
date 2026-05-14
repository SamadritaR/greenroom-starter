# Case Study Submission — Deal Capture

**Candidate:** Samadrita Roy
**Branch:** `samadrita-deal-capture`
**Slice:** Deal Capture — turning the moment a deal is recorded from a one-sided form fill into a two-sided, AI-assisted, mutually confirmed agreement.

For the full reasoning, defended cuts, validation plan, and what would ship next, see the accompanying memo.

---

## What this branch adds

A new flow at `/shows/[id]/capture-deal` that lets Mariana paste the agent's deal email, watch an LLM extract structured terms (with source quotes), see ambiguities flagged with their dollar consequence, and resolve each ambiguity either by asking the agent to clarify (pre-drafted email) or by resolving it herself inline. Both paths end in a confirmed `deal_capture` record with a timestamp and an attributable signer.

New tables: `deal_capture`, `clarification`. Three migrations included.

---

## Run it

### 1. Switch to the branch

```bash
git checkout samadrita-deal-capture
```

### 2. Add a Groq API key

Create a `.env.local` file at the repo root:

```
GROQ_API_KEY=your_groq_api_key_here
```

A free key works at [console.groq.com](https://console.groq.com). The extraction uses Llama 3.3 70B via Groq.

### 3. Install and run

```bash
npm install
npm run dev
```

The database (`data/greenroom.db`) is committed with seed data and the new migrations already applied, so nothing else to set up.

---

## See the demo

Open: `http://localhost:3000/shows/show_coastal_spell_dispute/capture-deal`

This is the March 14, 2025 dispute referenced in the case brief — the one where a $900 marketing recoup ambiguity caused a $720 settlement disagreement.

Click **Capture deal**, then paste this email (the actual deal note from the dispute thread):

```
$5,000 vs 80% of net after expenses, expenses capped at $2,500. $900 marketing recoup for the Spotify campaign we ran last week. Hospitality per rider.
```

Click **Extract terms**. You should see:

- Original email on the left with phrases highlighted (blue = clean extractions, amber = ambiguities)
- Structured terms on the right
- One amber ambiguity card: *is the $900 marketing recoup inside or outside the $2,500 expense cap?*
- Click **See dollar impact** — the system surfaces the actual dispute amount

From here you can take either path:

- **Ask agent to clarify** → opens a pre-drafted email pulled from the show's agent contact (Sarah Kim, WME). Send mocks the agent reply after 5 seconds.
- **I know the answer** → inline form, Mariana resolves it herself.

Both end with the deal in a green **Confirmed · ready to settle** state.

---

## Try harder cases

Click **Paste different email** at the top right and try these:

**Real venue shorthand (the kind Mariana actually writes):**
```
4,612 g'tee vs 85/15 net, walkout above breakeven. Expense cap 2300, hosp $600.
```
Expected: the system extracts the abbreviated terms and flags both "85/15" (whose 85?) and "walkout above breakeven" (over what number?) as ambiguities.

**Clean flat deal (no ambiguities):**
```
Confirmed for Tuesday: flat $1,200, all-in, no percentage. Soundcheck at 5pm.
```
Expected: one term, zero ambiguities, status goes straight to clean draft.

**Vs deal with walkout pot:**
```
$3,000 vs 75% of net, expenses capped at $2,000. Walkout pot of 100% over $4,500 gross. Hospitality $500.
```
Expected: multiple terms, ambiguity flagged on how the walkout stacks.

---

## Where to look in the code

- `lib/prompts/extract-deal.ts` — the system prompt that drives the extraction. The five-section structure (role framing, deal type taxonomy, ambiguity definition, grounded examples, edge-case handling) is the part that determines extraction quality.
- `lib/llm/groq.ts` — Groq client wrapper.
- `lib/deal-capture/extractionSchema.ts` — the structured output schema the model fills.
- `lib/deal-capture/clarificationDraft.ts` — generates the clarifying email body from the source quote and the question.
- `lib/deal-capture/highlightEmail.ts` — maps source-quote spans back onto the original email for the highlighted view.
- `app/shows/[id]/capture-deal/` — the route and client component.
- `app/api/deal-capture/` — extraction, confirmation, clarification, and resolution endpoints.
- `db/migrations/0001_deal_capture_clarification.sql` and `0002`, `0003` — schema changes for the new tables.
- `db/schema.ts` — Drizzle schema for `deal_capture` and `clarification`.

---

## What's mocked

The clarification email and the agent reply are mocked. A real implementation would route through the venue's outbound provider and parse the reply, or send a one-click magic-link confirmation. For a prototype the mock is sufficient because the product idea does not depend on the channel.

---

## A note on the data

While exploring the database I found that 16 out of 16 settlements marked `'disputed'` have artist signoff text that reads as positive resolution ("Looks good," "ok wire monday," "sign off," "OK," "👍"). The status field has fully decoupled from the underlying reality.

This finding shaped the design. The `deal_capture` record holds the agent's actual confirmation timestamped inside it — there is no separate status field that can drift. The class of bug that produced sixteen false disputes does not have a place to live in this system.

The Coastal Spell show itself is an example: its `status` is `'settled'`, but the dispute thread clearly shows it was contested. Same drift, different direction.

This is covered in more detail in the memo.