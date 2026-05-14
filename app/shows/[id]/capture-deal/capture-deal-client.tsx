"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardPaste,
  Loader2,
} from "lucide-react";
import type { DealExtraction } from "@/lib/deal-capture/extractionSchema";
import {
  buildClarificationBody,
  buildClarificationSubject,
  buildMockAgentReply,
  type AgentContact,
} from "@/lib/deal-capture/clarificationDraft";
import { buildEmailSegments } from "@/lib/deal-capture/highlightEmail";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClarificationEmailModal } from "./clarification-modal";

type Phase = "paste" | "results";

type AmbiguityUiState =
  | { status: "pending" }
  | { status: "awaiting"; clarificationId: string }
  | {
      status: "resolved";
      clarificationId: string;
      resolutionSource: "agent" | "self";
      headline: string;
      resolutionNote: string;
      resolvedAt: string;
    };

type ModalState = {
  ambiguityIndex: number;
  editMode: boolean;
  subject: string;
  body: string;
} | null;

export function CaptureDealClient({
  showId,
  artistName,
  agentContact,
}: {
  showId: string;
  artistName: string;
  agentContact: AgentContact;
}) {
  const [pasted, setPasted] = useState("");
  const [phase, setPhase] = useState<Phase>("paste");
  const [emailSnapshot, setEmailSnapshot] = useState("");
  const [extraction, setExtraction] = useState<DealExtraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealCaptureId, setDealCaptureId] = useState<string | null>(null);
  const [life, setLife] = useState<Record<number, AmbiguityUiState>>({});
  const [modal, setModal] = useState<ModalState>(null);

  const timerRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const confirmSentRef = useRef(false);

  const resolvedAmbiguityIndices = useMemo(() => {
    const s = new Set<number>();
    if (!extraction) return s;
    extraction.ambiguities.forEach((_, i) => {
      if (life[i]?.status === "resolved") s.add(i);
    });
    return s;
  }, [extraction, life]);

  const segments = useMemo(
    () =>
      extraction && emailSnapshot
        ? buildEmailSegments(emailSnapshot, extraction, {
            resolvedAmbiguityIndices,
          })
        : [],
    [emailSnapshot, extraction, resolvedAmbiguityIndices],
  );

  const ambCount = extraction?.ambiguities.length ?? 0;
  const termCount = extraction?.terms.length ?? 0;

  const fullySettled = Boolean(
    extraction &&
      (ambCount === 0 ||
        extraction.ambiguities.every((_, i) => life[i]?.status === "resolved")),
  );

  useEffect(() => {
    if (!extraction) return;
    const next: Record<number, AmbiguityUiState> = {};
    extraction.ambiguities.forEach((_, i) => {
      next[i] = { status: "pending" };
    });
    setLife(next);
  }, [extraction]);

  useEffect(() => {
    return () => {
      for (const t of timerRef.current.values()) clearTimeout(t);
      timerRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!dealCaptureId || !extraction || ambCount === 0) return;
    if (
      !extraction.ambiguities.every((_, i) => life[i]?.status === "resolved")
    ) {
      confirmSentRef.current = false;
      return;
    }
    if (confirmSentRef.current) return;
    confirmSentRef.current = true;
    void fetch(`/api/deal-capture/${dealCaptureId}/confirm`, { method: "POST" });
  }, [dealCaptureId, extraction, life, ambCount]);

  const clearTimers = useCallback(() => {
    for (const t of timerRef.current.values()) clearTimeout(t);
    timerRef.current.clear();
  }, []);

  async function handleExtract() {
    setError(null);
    setLoading(true);
    setDealCaptureId(null);
    confirmSentRef.current = false;
    clearTimers();
    try {
      const res = await fetch("/api/deal-capture/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastedEmail: pasted }),
      });
      const data = (await res.json()) as {
        extraction?: DealExtraction;
        error?: string;
        message?: string;
        issues?: unknown;
      };

      if (!res.ok) {
        const base = data.error ?? data.message ?? "Extraction failed";
        const extra =
          res.status === 422 && data.issues
            ? ` (${JSON.stringify(data.issues).slice(0, 280)}…)`
            : "";
        throw new Error(base + extra);
      }

      if (!data.extraction) {
        throw new Error("No extraction in response");
      }

      const sessionRes = await fetch("/api/deal-capture/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          pastedEmail: pasted,
          extraction: data.extraction,
        }),
      });
      const sessionJson = (await sessionRes.json()) as {
        dealCaptureId?: string;
        error?: string;
      };
      if (!sessionRes.ok || !sessionJson.dealCaptureId) {
        throw new Error(sessionJson.error ?? "Could not start capture session");
      }
      setDealCaptureId(sessionJson.dealCaptureId);

      if (data.extraction.ambiguities.length === 0) {
        const c = await fetch(
          `/api/deal-capture/${sessionJson.dealCaptureId}/confirm`,
          { method: "POST" },
        );
        if (!c.ok) {
          const j = (await c.json()) as { error?: string };
          throw new Error(j.error ?? "Could not confirm capture");
        }
        confirmSentRef.current = true;
      }

      setEmailSnapshot(pasted);
      setExtraction(data.extraction);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    clearTimers();
    setPhase("paste");
    setExtraction(null);
    setEmailSnapshot("");
    setError(null);
    setDealCaptureId(null);
    setLife({});
    setModal(null);
    confirmSentRef.current = false;
  }

  function openClarifyModal(idx: number) {
    if (!extraction) return;
    const amb = extraction.ambiguities[idx];
    setModal({
      ambiguityIndex: idx,
      editMode: false,
      subject: buildClarificationSubject(artistName),
      body: buildClarificationBody({
        artistName,
        agentContact,
        ambiguity: amb,
      }),
    });
  }

  async function handleSendFromModal() {
    if (!modal || !extraction || !dealCaptureId) return;
    const amb = extraction.ambiguities[modal.ambiguityIndex];
    const outbound = [
      `To: ${agentContact.name} <${agentContact.email}>`,
      `Subject: ${modal.subject}`,
      "",
      modal.body,
    ].join("\n");

    const res = await fetch(
      `/api/deal-capture/${dealCaptureId}/clarifications`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambiguityIndex: modal.ambiguityIndex,
          ambiguitySummary: amb.summary,
          outboundBody: outbound,
        }),
      },
    );
    const j = (await res.json()) as {
      clarificationId?: string;
      error?: string;
    };
    if (!res.ok || !j.clarificationId) {
      setError(j.error ?? "Could not record clarification");
      return;
    }

    setError(null);
    const clarificationId = j.clarificationId;
    const idx = modal.ambiguityIndex;
    setModal(null);

    setLife((prev) => ({
      ...prev,
      [idx]: { status: "awaiting", clarificationId },
    }));

    const existing = timerRef.current.get(idx);
    if (existing) clearTimeout(existing);

    const t = setTimeout(async () => {
      const resolvedAt = new Date();
      const resolvedAtIso = resolvedAt.toISOString();
      const resolutionNote = `Confirmed by ${agentContact.name}, ${agentContact.agencyName}, ${format(resolvedAt, "MMM d, yyyy 'at' h:mm a")}`;
      const headline = resolutionNote;
      const mockInboundReply = buildMockAgentReply({ ambiguity: amb });

      const r = await fetch(
        `/api/deal-capture/clarifications/${clarificationId}/resolve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mockInboundReply, resolutionNote }),
        },
      );
      if (!r.ok) {
        console.error("[capture-deal] resolve failed", await r.text());
        return;
      }

      setLife((prev) => ({
        ...prev,
        [idx]: {
          status: "resolved",
          clarificationId,
          resolutionSource: "agent",
          headline,
          resolutionNote,
          resolvedAt: resolvedAtIso,
        },
      }));
      timerRef.current.delete(idx);
    }, 5000);

    timerRef.current.set(idx, t);
  }

  async function handleSelfResolve(
    idx: number,
    resolutionText: string,
    contextNote: string,
  ): Promise<void> {
    if (!dealCaptureId || !extraction) return;
    const amb = extraction.ambiguities[idx];
    const res = await fetch(
      `/api/deal-capture/${dealCaptureId}/clarifications/self`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambiguityIndex: idx,
          ambiguitySummary: amb.summary,
          resolutionText,
          ...(contextNote.trim() ? { contextNote: contextNote.trim() } : {}),
        }),
      },
    );
    const j = (await res.json()) as {
      clarificationId?: string;
      headline?: string;
      resolutionNote?: string;
      resolvedAt?: string;
      error?: string;
    };
    if (!res.ok || !j.clarificationId || !j.headline || !j.resolutionNote || !j.resolvedAt) {
      setError(j.error ?? "Could not save self-resolution");
      return;
    }
    setError(null);
    setLife((prev) => ({
      ...prev,
      [idx]: {
        status: "resolved",
        clarificationId: j.clarificationId!,
        resolutionSource: "self",
        headline: j.headline!,
        resolutionNote: j.resolutionNote!,
        resolvedAt: j.resolvedAt!,
      },
    }));
  }

  if (phase === "paste") {
    return (
      <div className="max-w-2xl mx-auto mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-brand-50 ring-1 ring-brand-200/60 p-2.5 shrink-0">
                <ClipboardPaste className="h-4 w-4 text-brand-800" />
              </div>
              <div>
                <CardTitle className="font-display text-[17px] font-medium tracking-tight">
                  Paste the agent&apos;s deal email
                </CardTitle>
                <CardDescription className="text-[13px] mt-1">
                  We&apos;ll extract structured terms, attach source quotes, and
                  flag anything that could cause a settlement dispute later.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="deal-email"
                className="eyebrow text-[10px] text-ink-500 mb-2 block"
              >
                Deal email
              </label>
              <textarea
                id="deal-email"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={14}
                placeholder="Paste the full thread or the latest offer email here…"
                className={cn(
                  "w-full rounded-lg border border-ink-200/90 bg-white px-3.5 py-3",
                  "text-[13px] text-ink-900 leading-relaxed placeholder:text-ink-300",
                  "shadow-sm shadow-ink-900/[0.02] focus:outline-none focus:ring-2 focus:ring-brand-600/25 focus:border-brand-500/40",
                  "resize-y min-h-[200px]",
                )}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50/80 ring-1 ring-rose-200/70 px-4 py-3 flex gap-2.5 text-[13px] text-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="brand"
                size="lg"
                disabled={loading || !pasted.trim()}
                onClick={() => void handleExtract()}
                className="min-w-[160px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting…
                  </>
                ) : (
                  "Extract terms"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-8">
      <ClarificationEmailModal
        open={modal !== null}
        onClose={() => setModal(null)}
        agentContact={agentContact}
        artistName={artistName}
        subject={modal?.subject ?? ""}
        body={modal?.body ?? ""}
        editMode={modal?.editMode ?? false}
        onSubjectChange={(v) =>
          setModal((m) => (m ? { ...m, subject: v } : m))
        }
        onBodyChange={(v) => setModal((m) => (m ? { ...m, body: v } : m))}
        onEditFirst={() =>
          setModal((m) => (m ? { ...m, editMode: true } : m))
        }
        onSend={() => void handleSendFromModal()}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-500">
          Review extraction against the original email. Highlights match
          source quotes (blue = term, amber = open question, green = confirmed).
        </p>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Paste different email
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50/80 ring-1 ring-rose-200/70 px-4 py-3 flex gap-2.5 text-[13px] text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-2 gap-8 items-start rounded-xl transition-colors duration-300",
          fullySettled &&
            "bg-brand-50/35 ring-1 ring-brand-200/50 p-6 lg:p-8 -mx-2 lg:-mx-0",
        )}
      >
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              Original email
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className={cn(
                "rounded-md bg-ink-50/80 ring-1 ring-ink-100 px-4 py-3.5 max-h-[min(70vh,640px)] overflow-y-auto",
                "text-[13px] leading-[1.65] text-ink-800 whitespace-pre-wrap font-sans",
                fullySettled && "bg-white/80 ring-brand-100",
              )}
            >
              {segments.map((seg, idx) => {
                if (seg.kind === "plain") {
                  return <span key={idx}>{seg.text}</span>;
                }
                if (seg.kind === "term") {
                  return (
                    <mark
                      key={idx}
                      className="bg-sky-100/90 text-sky-900 rounded px-0.5 py-px font-medium"
                    >
                      {seg.text}
                    </mark>
                  );
                }
                if (seg.kind === "resolved") {
                  return (
                    <mark
                      key={idx}
                      className="bg-brand-100/95 text-brand-900 rounded px-0.5 py-px font-medium"
                    >
                      {seg.text}
                    </mark>
                  );
                }
                return (
                  <mark
                    key={idx}
                    className="bg-amber-100/95 text-amber-900 rounded px-0.5 py-px font-medium"
                  >
                    {seg.text}
                  </mark>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {fullySettled ? (
              <PlainBadge variant="brand">
                Confirmed · ready to settle
              </PlainBadge>
            ) : ambCount > 0 ? (
              <PlainBadge variant="amber">Draft · needs clarification</PlainBadge>
            ) : (
              <PlainBadge variant="brand">Draft · no open questions</PlainBadge>
            )}
          </div>

          <p className="text-[14px] text-ink-700 font-medium leading-snug">
            {termCount} term{termCount === 1 ? "" : "s"} extracted
            {ambCount > 0
              ? `, ${ambCount} need${ambCount === 1 ? "s" : ""} clarification`
              : ", no ambiguities flagged"}
          </p>

          {extraction && ambCount > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-[18px] font-medium text-ink-900">
                Needs clarification
              </h2>
              {extraction.ambiguities.map((amb, i) => (
                <AmbiguityCard
                  key={i}
                  ambiguity={amb}
                  index={i}
                  state={life[i] ?? { status: "pending" }}
                  agentName={agentContact.name}
                  dealCaptureId={dealCaptureId}
                  onAskClarify={() => openClarifyModal(i)}
                  onSelfResolve={(resolutionText, contextNote) =>
                    handleSelfResolve(i, resolutionText, contextNote)
                  }
                />
              ))}
            </div>
          )}

          {extraction && termCount > 0 && (
            <div className="space-y-3 pt-2">
              {fullySettled && ambCount > 0 && (
                <div className="rounded-lg bg-white/90 ring-1 ring-brand-200/60 p-4 space-y-2 mb-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                    Confirmations
                  </div>
                  {extraction.ambiguities.map((_, i) => {
                    const st = life[i];
                    if (st?.status !== "resolved") return null;
                    return (
                      <div
                        key={i}
                        className="text-[13px] text-brand-900 flex gap-2 leading-snug"
                      >
                        <Check
                          className="h-4 w-4 shrink-0 mt-0.5 text-brand-700"
                          strokeWidth={2.5}
                        />
                        <div>
                          <p>{st.headline}</p>
                          {st.resolutionSource === "self" ? (
                            <p className="text-[12px] text-brand-900/85 mt-1.5 leading-relaxed">
                              {st.resolutionNote}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <h2 className="font-display text-[18px] font-medium text-ink-900">
                Extracted terms
              </h2>
              <div className="space-y-2.5">
                {extraction.terms.map((term, i) => (
                  <CleanTermCard key={i} term={term} settled={fullySettled} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AmbiguityCard({
  ambiguity,
  index,
  state,
  agentName,
  dealCaptureId,
  onAskClarify,
  onSelfResolve,
}: {
  ambiguity: DealExtraction["ambiguities"][number];
  index: number;
  state: AmbiguityUiState;
  agentName: string;
  dealCaptureId: string | null;
  onAskClarify: () => void;
  onSelfResolve: (resolutionText: string, contextNote: string) => Promise<void>;
}) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [savingSelf, setSavingSelf] = useState(false);

  const hasImpact =
    ambiguity.estimatedDollarImpactUsd != null &&
    !Number.isNaN(ambiguity.estimatedDollarImpactUsd);

  if (state.status === "resolved") {
    return (
      <Card className="border-brand-200/80 bg-brand-50/40 shadow-none">
        <CardContent className="py-4 space-y-2">
          <div className="flex gap-2 items-start">
            <Check
              className="h-4 w-4 shrink-0 mt-0.5 text-brand-700"
              strokeWidth={2.5}
            />
            <div>
              <p className="text-[13px] font-semibold text-ink-900 leading-snug">
                {ambiguity.summary}
              </p>
              <p className="text-[13px] font-semibold text-brand-900 mt-1.5 leading-snug">
                {state.headline}
              </p>
              {state.resolutionSource === "self" && (
                <p className="text-[12px] text-brand-900/90 mt-1.5 leading-relaxed">
                  {state.resolutionNote}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "awaiting") {
    return (
      <Card className="border-amber-100 bg-amber-50/25 shadow-none">
        <CardContent className="py-4 flex items-start gap-3">
          <Loader2 className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 animate-spin" />
          <div>
            <p className="text-[13px] font-medium text-amber-900 leading-snug">
              Awaiting confirmation from {agentName}
            </p>
            <p className="text-[12px] text-amber-800/85 mt-1">
              {ambiguity.summary}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function cancelSelfForm() {
    setSelfOpen(false);
    setResolutionText("");
    setContextNote("");
  }

  async function saveSelf() {
    if (!resolutionText.trim() || !dealCaptureId) return;
    setSavingSelf(true);
    try {
      await onSelfResolve(resolutionText.trim(), contextNote);
      cancelSelfForm();
    } finally {
      setSavingSelf(false);
    }
  }

  return (
    <Card accent="amber">
      <CardContent className="py-4 space-y-3">
        <p className="text-[13.5px] font-semibold text-ink-900 leading-snug">
          {ambiguity.summary}
        </p>
        <p className="text-[13px] text-ink-600 leading-relaxed">
          {ambiguity.whyAmbiguous}
        </p>

        <details className="group rounded-lg bg-amber-50/50 ring-1 ring-amber-200/50 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-amber-900 select-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
            See dollar impact
          </summary>
          <p className="mt-2 text-[13px] text-ink-800 tabular pl-5">
            {hasImpact ? (
              <>
                Estimated swing between readings:{" "}
                <span className="font-semibold text-ink-900">
                  {formatMoney(ambiguity.estimatedDollarImpactUsd)}
                </span>
              </>
            ) : (
              <span className="text-ink-500">
                Not enough information in the email to estimate a dollar impact.
              </span>
            )}
          </p>
        </details>

        {selfOpen ? (
          <div className="rounded-lg border border-ink-200/90 bg-ink-50/50 p-4 space-y-3 mt-1">
            <p className="text-[13px] font-semibold text-ink-900 leading-snug">
              {ambiguity.summary}
            </p>
            <div>
              <label
                htmlFor={`self-res-${index}`}
                className="eyebrow text-[10px] text-ink-500 mb-1.5 block"
              >
                Your resolution
              </label>
              <textarea
                id={`self-res-${index}`}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                rows={3}
                placeholder="e.g., recoup is inside the $2,500 expense cap"
                disabled={savingSelf}
                className={cn(
                  "w-full rounded-lg border border-ink-200/90 bg-white px-3 py-2 text-[13px]",
                  "text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-600/25",
                )}
              />
            </div>
            <div>
              <label
                htmlFor={`self-note-${index}`}
                className="eyebrow text-[10px] text-ink-500 mb-1.5 block"
              >
                Note <span className="text-ink-400 font-normal">(optional)</span>
              </label>
              <textarea
                id={`self-note-${index}`}
                value={contextNote}
                onChange={(e) => setContextNote(e.target.value)}
                rows={2}
                placeholder="e.g., Andrea confirmed on a call last month"
                disabled={savingSelf}
                className={cn(
                  "w-full rounded-lg border border-ink-200/90 bg-white px-3 py-2 text-[13px]",
                  "text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-600/25",
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                variant="brand"
                size="sm"
                disabled={
                  savingSelf || !resolutionText.trim() || !dealCaptureId
                }
                onClick={() => void saveSelf()}
              >
                {savingSelf ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save resolution"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={savingSelf}
                onClick={cancelSelfForm}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onAskClarify}>
              Ask agent to clarify
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setSelfOpen(true)}
            >
              I know the answer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CleanTermCard({
  term,
  settled,
}: {
  term: DealExtraction["terms"][number];
  settled: boolean;
}) {
  const quotes = term.sourceQuotes
    .map((q) => q.text)
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className={cn(
        "shadow-none",
        settled
          ? "border-brand-100 bg-white/95 ring-1 ring-brand-100/80"
          : "border-ink-100 bg-white/90",
      )}
    >
      <CardContent className="py-3.5 flex gap-3">
        <div
          className={cn(
            "mt-0.5 shrink-0 rounded-full p-1 ring-1",
            settled
              ? "bg-brand-50 ring-brand-200/70"
              : "bg-brand-50 ring-brand-200/60",
          )}
        >
          <Check className="h-3.5 w-3.5 text-brand-800 stroke-[2.5]" />
        </div>
        <div className="min-w-0 space-y-1.5 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
            {term.label}
          </div>
          <div className="text-[14px] font-semibold text-ink-900 tabular">
            {term.value}
          </div>
          {quotes && (
            <blockquote className="text-[12px] text-ink-500 leading-relaxed border-l-2 border-ink-200 pl-3 mt-2">
              {quotes}
            </blockquote>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
