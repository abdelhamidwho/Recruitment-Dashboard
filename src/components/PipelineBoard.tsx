"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { STAGES } from "@/lib/auth/constants";
import {
  fetchPipeline,
  changeStage,
  fetchStageHistory,
  type StageEventRow,
} from "@/lib/collaborationApi";

interface PersonLite {
  id: string;
  fullName: string;
  currentTitle?: string | null;
  currentCompany?: string | null;
  locationRaw?: string | null;
}

interface CandidateRow {
  id: string;
  personId: string;
  stage: string;
  person: PersonLite;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * A job's pipeline as a board of columns, one per STAGES entry. Moving
 * someone is a single action — the stage select on their card fires the
 * change immediately, no separate "confirm" step.
 */
export function PipelineBoard({ jobId }: { jobId: string }) {
  const [jobTitle, setJobTitle] = React.useState("");
  const [byStage, setByStage] = React.useState<Record<string, CandidateRow[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busyPersonId, setBusyPersonId] = React.useState("");
  const [historyFor, setHistoryFor] = React.useState<string>("");
  const [history, setHistory] = React.useState<StageEventRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  // Fetch inline (not via a separately-defined, effect-called function) so
  // every setState call here happens after an await the linter can see is
  // asynchronous.
  React.useEffect(() => {
    (async () => {
      const result = await fetchPipeline(jobId);
      setLoading(false);
      if (!result.ok) {
        setError(`Couldn't load pipeline: ${result.error}`);
        return;
      }
      setJobTitle(result.data!.job.title as string);
      setByStage(result.data!.byStage as unknown as Record<string, CandidateRow[]>);
    })();
  }, [jobId]);

  const handleMove = async (personId: string, toStage: string) => {
    setBusyPersonId(personId);
    setError("");
    const result = await changeStage(jobId, personId, toStage);
    setBusyPersonId("");
    if (!result.ok) {
      setError(`Couldn't move candidate: ${result.error}`);
      return;
    }
    // Move the row between stage columns locally — the API call already
    // confirmed the change, so there's no need to refetch the whole board.
    setByStage((prev) => {
      const next: Record<string, CandidateRow[]> = {};
      for (const stage of Object.keys(prev)) {
        next[stage] = prev[stage].filter((row) => row.personId !== personId);
      }
      const moved = Object.values(prev).flat().find((row) => row.personId === personId);
      if (moved) {
        next[toStage] = [{ ...moved, stage: toStage }, ...(next[toStage] ?? [])];
      }
      return next;
    });
    if (historyFor === personId) await refreshHistory(personId);
  };

  const refreshHistory = async (personId: string) => {
    setHistoryLoading(true);
    const result = await fetchStageHistory(jobId, personId);
    setHistoryLoading(false);
    if (result.ok) setHistory(result.data!.events);
    else setError(`Couldn't load history: ${result.error}`);
  };

  const openHistory = async (personId: string) => {
    if (historyFor === personId) {
      setHistoryFor("");
      return;
    }
    setHistoryFor(personId);
    setHistoryLoading(true);
    const result = await fetchStageHistory(jobId, personId);
    setHistoryLoading(false);
    if (result.ok) setHistory(result.data!.events);
    else setError(`Couldn't load history: ${result.error}`);
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{jobTitle || "Pipeline"}</h1>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const rows = byStage[stage] ?? [];
          return (
            <div key={stage} className="w-64 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">{stage}</h2>
                <Badge variant="secondary">{rows.length}</Badge>
              </div>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-md border p-2 bg-background">
                    <p className="text-sm font-medium">{row.person.fullName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {row.person.currentTitle}
                      {row.person.currentCompany ? ` @ ${row.person.currentCompany}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <select
                        className="h-7 flex-1 rounded-md border border-input bg-transparent px-1 text-xs"
                        value={row.stage}
                        disabled={busyPersonId === row.personId}
                        onChange={(e) => handleMove(row.personId, e.target.value)}
                        aria-label={`Move ${row.person.fullName}`}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="text-xs underline text-muted-foreground shrink-0"
                        onClick={() => openHistory(row.personId)}
                      >
                        History
                      </button>
                    </div>
                    {historyFor === row.personId && (
                      <ul className="mt-2 space-y-1 border-t pt-2">
                        {historyLoading && <li className="text-xs text-muted-foreground">Loading...</li>}
                        {!historyLoading && history.length === 0 && (
                          <li className="text-xs text-muted-foreground">No history.</li>
                        )}
                        {!historyLoading &&
                          history.map((ev) => (
                            <li key={ev.id} className="text-xs flex justify-between gap-2">
                              <span>{ev.fromStage ? `${ev.fromStage} → ${ev.toStage}` : `Added at ${ev.toStage}`} by {ev.user.name}</span>
                              <span className="text-muted-foreground shrink-0">{timeAgo(ev.createdAt)}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                ))}
                {rows.length === 0 && <li className="text-xs text-muted-foreground italic px-1">Empty</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
