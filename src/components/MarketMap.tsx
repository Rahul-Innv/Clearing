"use client";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRunStream } from "@/hooks/useRunStream";
import type { Phase } from "@/lib/contracts";
import { deriveNodes, metricsFor } from "./derive";
import { MarketGraph } from "./MarketGraph";
import { OfferDrawer } from "./OfferDrawer";
import { PhaseChip, SimulationBadge } from "./TopBar";

/** Phases before the market opens: there is nothing to map yet. */
const NOT_OPEN: Phase[] = ["draft", "confirming"];

/** 24px dot grid at 4% white: a quiet canvas behind the graph (Linear-style). */
const CANVAS: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

function BackLink() {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-[13px] text-muted transition-colors hover:text-text">
      <span aria-hidden>←</span> Back to plan
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line px-2 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="num font-medium text-text">{value ?? "—"}</dd>
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center" style={CANVAS}>
      {children}
    </div>
  );
}

export function MarketMap() {
  const { run, events, status, connection, runtime } = useRunStream();
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => (run ? deriveNodes(run, events) : []), [run, events]);
  const selectedNode = selected ? nodes.find((n) => n.merchantId === selected) ?? null : null;
  const open = run !== null && !NOT_OPEN.includes(run.phase);
  const m = run && open ? metricsFor(run) : null;
  const loading = !run && (connection === "connecting" || connection === "reconnecting");

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-text">
      <header className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-ink/95 px-4 py-2 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <BackLink />
          <span aria-hidden className="h-4 w-px bg-line" />
          <h1 className="truncate text-[14px] font-medium tracking-tight text-text">How the plan was found</h1>
        </div>
        <SimulationBadge reasoning={status?.reasoning.mode} runtime={runtime} />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {m ? (
            <dl aria-label="Run metrics" className="flex flex-wrap items-center gap-2">
              <Metric label="Candidates" value={m.candidatesChecked === null ? null : String(m.candidatesChecked)} />
              <Metric label="Feasible" value={m.feasibleCandidates === null ? null : String(m.feasibleCandidates)} />
              <Metric label="Solver" value={m.solverMs === null ? null : `${m.solverMs} ms`} />
            </dl>
          ) : null}
          {run ? <PhaseChip phase={run.phase} /> : null}
        </div>
      </header>

      {loading ? (
        <Quiet>
          <p className="text-sm text-muted">{connection === "reconnecting" ? "Reconnecting to the server…" : "Loading the current run…"}</p>
        </Quiet>
      ) : !run || !open ? (
        <Quiet>
          <p className="text-[15px] text-text">Open the market from the plan page first.</p>
          <BackLink />
        </Quiet>
      ) : (
        <main className="flex-1" style={CANVAS}>
          <div className="mx-auto w-full max-w-[1280px] px-0 py-4 sm:px-6 sm:py-8">
            <MarketGraph run={run} nodes={nodes} onOpenOffer={setSelected} />
          </div>
        </main>
      )}

      {run ? <OfferDrawer run={run} node={selectedNode} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
