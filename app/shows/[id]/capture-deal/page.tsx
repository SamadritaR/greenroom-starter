import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { formatShowDateFull } from "@/lib/format";
import { PLACEHOLDER_AGENT } from "@/lib/deal-capture/clarificationDraft";
import { CaptureDealClient } from "./capture-deal-client";

export const metadata: Metadata = {
  title: "Capture deal",
};

export default async function CaptureDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, agent, agency } = data;

  return (
    <div className="max-w-7xl relative z-10">
      <div className="bg-gradient-to-b from-brand-50/30 to-canvas px-12 pt-10 pb-10">
        <Link
          href={`/shows/${show.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to show
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400 mb-2">
          Deal capture
        </p>
        <h1
          className="font-display text-[40px] font-medium text-ink-900 leading-[1.05]"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          {artist?.name ?? "—"}
        </h1>
        <p className="text-[14px] text-ink-500 mt-2">
          {formatShowDateFull(show.date)}
        </p>
      </div>

      <div className="px-12 pb-14">
        <CaptureDealClient
          showId={show.id}
          artistName={artist?.name ?? "Artist"}
          agentContact={
            agent && agency
              ? {
                  name: agent.name,
                  email: agent.email,
                  agencyName: agency.name,
                }
              : PLACEHOLDER_AGENT
          }
        />
      </div>
    </div>
  );
}
