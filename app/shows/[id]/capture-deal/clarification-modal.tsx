"use client";

import { X } from "lucide-react";
import type { AgentContact } from "@/lib/deal-capture/clarificationDraft";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  agentContact: AgentContact;
  artistName: string;
  subject: string;
  body: string;
  editMode: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onEditFirst: () => void;
  onSend: () => void;
};

export function ClarificationEmailModal({
  open,
  onClose,
  agentContact,
  artistName,
  subject,
  body,
  editMode,
  onSubjectChange,
  onBodyChange,
  onEditFirst,
  onSend,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clarify-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle
              id="clarify-modal-title"
              className="font-display text-[18px] font-medium text-ink-900"
            >
              Clarification email
            </CardTitle>
            <p className="text-[12px] text-ink-500 mt-1">
              Pre-drafted for {artistName}. Review before sending.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <div className="eyebrow text-[10px] text-ink-500 mb-1">To</div>
            <div className="text-[13px] text-ink-900">
              {agentContact.name}{" "}
              <span className="text-ink-400">&lt;{agentContact.email}&gt;</span>
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">{agentContact.agencyName}</div>
          </div>

          <div>
            <label className="eyebrow text-[10px] text-ink-500 mb-1 block" htmlFor="clarify-subject">
              Subject
            </label>
            <input
              id="clarify-subject"
              readOnly={!editMode}
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-ink-200/90 px-3 py-2 text-[13px]",
                editMode
                  ? "bg-white text-ink-900 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                  : "bg-ink-50/80 text-ink-700",
              )}
            />
          </div>

          <div>
            <label className="eyebrow text-[10px] text-ink-500 mb-1 block" htmlFor="clarify-body">
              Body
            </label>
            <textarea
              id="clarify-body"
              readOnly={!editMode}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={14}
              className={cn(
                "w-full rounded-lg border border-ink-200/90 px-3 py-2.5 text-[13px] leading-relaxed resize-y min-h-[220px]",
                editMode
                  ? "bg-white text-ink-900 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                  : "bg-ink-50/80 text-ink-700",
              )}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="brand" onClick={onSend}>
              Send
            </Button>
            <Button variant="secondary" onClick={onEditFirst}>
              Edit first
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
