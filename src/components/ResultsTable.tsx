"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/lib/buildBooleanQuery";
import { summarizeViewers, summarizePipeline } from "@/lib/collaborationDisplay";
import type { CollaborationState } from "@/lib/collaboration";
import {
  toggleFavorite as apiToggleFavorite,
  addCandidateToJob,
  createJob as apiCreateJob,
  type JobSummary,
} from "@/lib/collaborationApi";
import { CandidateDetailDialog } from "./CandidateDetailDialog";

export interface ResultCandidate {
  id: string;
  externalId?: string | null;
  source?: string | null;
  fullName: string;
  headline?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  industry?: string | null;
  highestDegree?: string | null;
  fieldsOfStudy?: string | null;
  profileUrl: string;
  avatarUrl?: string | null;
  summary?: string | null;
  skills?: string | null;
  experience?: string | null;
  education?: string | null;
  languages?: string | null;
  certifications?: string | null;
  totalYearsExperience?: number | null;
  score: number;
  scoreBreakdown?: string | null;
  wasKnownBefore?: boolean;
  // Sorting below indexes into this object by an arbitrary column key.
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * One line of a candidate's score breakdown, as produced by
 * `scoreCandidate` (`src/lib/scoring/index.ts`) and stored verbatim in
 * `SearchRunPerson.scoreBreakdown`. Lines look like `+15: Has nice-to-have
 * skill "AWS" (in headline)`, `+0: Experience unknown (...)`, or, for a
 * gated candidate, `EXCLUDED: Missing must-have skill "Airflow"`. Parsed
 * only for display — the score itself is never re-derived here.
 */
function parseBreakdownLine(line: string): { tone: "positive" | "negative" | "neutral" | "excluded"; text: string } {
  const excludedMatch = line.match(/^EXCLUDED:\s*(.*)$/);
  if (excludedMatch) return { tone: "excluded", text: excludedMatch[1] };

  const pointsMatch = line.match(/^([+-]?[\d.]+):\s*(.*)$/);
  if (pointsMatch) {
    const points = Number(pointsMatch[1]);
    const tone = points > 0 ? "positive" : points < 0 ? "negative" : "neutral";
    return { tone, text: line };
  }
  return { tone: "neutral", text: line };
}

const TONE_CLASSES: Record<string, string> = {
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-destructive dark:text-red-400",
  excluded: "text-destructive dark:text-red-400",
  neutral: "text-muted-foreground",
};

/**
 * "Why this score?" detail — a plain-language readout of the evidence
 * behind one candidate's score, e.g. "has Python, has PostgreSQL, missing
 * Airflow, based in Cairo". Renders exactly what `scoreCandidate` computed
 * (via the stored `scoreBreakdown`); it does not re-derive or reinterpret
 * any of it, so the panel can never drift from the number shown in the
 * table.
 */
function ScoreExplanationDialog({ candidate, onOpenChange }: { candidate: ResultCandidate | null; onOpenChange: (open: boolean) => void }) {
  const lines: string[] = candidate?.scoreBreakdown ? JSON.parse(candidate.scoreBreakdown) : [];

  return (
    <Dialog open={candidate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why this score?</DialogTitle>
          <DialogDescription>
            {candidate?.fullName} — {candidate?.score ?? 0}/100
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5 text-sm max-h-[60vh] overflow-y-auto">
          {lines.length === 0 && <li className="text-muted-foreground">No scoring evidence recorded.</li>}
          {lines.map((line, i) => {
            const { tone, text } = parseBreakdownLine(line);
            return (
              <li key={i} className={TONE_CLASSES[tone]}>
                {text}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_COLLAB: CollaborationState = { favorited: false, watchlists: [], viewedBy: [], jobs: [] };

/**
 * Compact per-candidate quick actions for the "Actions" cell: favourite
 * star and an "Add to Pipeline" popover (existing job, or create one).
 * Deliberately small — the full set of controls (watchlists, stage change,
 * stage history) lives in the detail dialog, opened from the candidate's
 * name, so this row stays scannable.
 */
function RowActions({
  candidate,
  collab,
  jobs,
  onCollabChange,
  onJobCreated,
  onError,
}: {
  candidate: ResultCandidate;
  collab: CollaborationState;
  jobs: JobSummary[];
  onCollabChange: (personId: string, updater: (prev: CollaborationState) => CollaborationState) => void;
  onJobCreated: (job: JobSummary) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string>("");
  const [addJobId, setAddJobId] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [open, setOpen] = useState(false);

  const alreadyIn = new Set(collab.jobs.map((j) => j.jobId));
  const availableJobs = jobs.filter((j) => !alreadyIn.has(j.id));

  const handleFavorite = async () => {
    setBusy("favorite");
    const result = await apiToggleFavorite(candidate.id);
    setBusy("");
    if (!result.ok) {
      onError(`Couldn't update favourite for ${candidate.fullName}: ${result.error}`);
      return;
    }
    onCollabChange(candidate.id, (prev) => ({ ...prev, favorited: result.data!.favorited }));
  };

  const handleAdd = async () => {
    if (!addJobId) return;
    setBusy("add");
    const result = await addCandidateToJob(addJobId, candidate.id);
    setBusy("");
    if (!result.ok) {
      onError(`Couldn't add ${candidate.fullName} to pipeline: ${result.error}`);
      return;
    }
    const job = jobs.find((j) => j.id === addJobId);
    onCollabChange(candidate.id, (prev) => ({
      ...prev,
      jobs: [...prev.jobs, { jobId: addJobId, jobTitle: job?.title ?? "Job", stage: result.data!.candidate.stage }],
    }));
    setAddJobId("");
    setOpen(false);
  };

  const handleCreateAndAdd = async () => {
    const title = newJobTitle.trim();
    if (!title) return;
    setBusy("create");
    const created = await apiCreateJob(title);
    if (!created.ok) {
      setBusy("");
      onError(`Couldn't create job: ${created.error}`);
      return;
    }
    onJobCreated(created.data!.job);
    const added = await addCandidateToJob(created.data!.job.id, candidate.id);
    setBusy("");
    if (!added.ok) {
      onError(`Job created, but couldn't add ${candidate.fullName}: ${added.error}`);
      return;
    }
    onCollabChange(candidate.id, (prev) => ({
      ...prev,
      jobs: [...prev.jobs, { jobId: created.data!.job.id, jobTitle: title, stage: added.data!.candidate.stage }],
    }));
    setNewJobTitle("");
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={handleFavorite}
        disabled={busy === "favorite"}
        aria-pressed={collab.favorited}
        title={collab.favorited ? "Remove favourite" : "Favourite"}
        className="text-base leading-none disabled:opacity-50"
      >
        {collab.favorited ? "★" : "☆"}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>Add to Pipeline</PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-xs font-medium">Add {candidate.fullName} to a job</p>
          {availableJobs.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <select
                className="h-7 flex-1 rounded-md border border-input bg-transparent px-1.5 text-xs"
                value={addJobId}
                onChange={(e) => setAddJobId(e.target.value)}
              >
                <option value="">Choose job…</option>
                {availableJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={!addJobId || busy === "add"} onClick={handleAdd}>
                Add
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Already in every open job, or none exist yet.</p>
          )}
          <div className="flex items-center gap-1.5">
            <Input
              className="h-7 flex-1 text-xs"
              placeholder="New job title"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
            />
            <Button type="button" size="sm" variant="outline" disabled={!newJobTitle.trim() || busy === "create"} onClick={handleCreateAndAdd}>
              Create
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ResultsTable({
  candidates,
  filters,
  currentUserId = "",
  collabByPersonId = {},
  jobs = [],
  watchlists = [],
  onCollabChange = () => {},
  onJobCreated = () => {},
  onWatchlistCreated = () => {},
  onError = () => {},
}: {
  candidates: ResultCandidate[];
  filters: Partial<SearchFilters>;
  currentUserId?: string;
  collabByPersonId?: Record<string, CollaborationState>;
  jobs?: JobSummary[];
  watchlists?: import("@/lib/collaborationApi").WatchlistSummary[];
  onCollabChange?: (personId: string, updater: (prev: CollaborationState) => CollaborationState) => void;
  onJobCreated?: (job: JobSummary) => void;
  onWatchlistCreated?: (watchlist: import("@/lib/collaborationApi").WatchlistSummary) => void;
  onError?: (message: string) => void;
}) {
  const [sortCol, setSortCol] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [explaining, setExplaining] = useState<ResultCandidate | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<ResultCandidate | null>(null);

  const sortedCandidates = [...candidates].sort((a, b) => {
    let valA = a[sortCol] ?? "";
    let valB = b[sortCol] ?? "";
    if (sortCol === "score") {
      valA = a.score || 0;
      valB = b.score || 0;
    }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const mustHaves = filters.mustHave || [];

  return (
    <div className="rounded-md border mt-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Candidate</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Current Role</TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("location")}>Location {sortCol === "location" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("totalYearsExperience")}>YoE {sortCol === "totalYearsExperience" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>
            <TableHead>Skills Matched</TableHead>
            <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("score")}>Score {sortCol === "score" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCandidates.map((candidate) => {
            const skills = JSON.parse(candidate.skills || "[]");
            const collab = collabByPersonId[candidate.id] ?? EMPTY_COLLAB;
            const viewedLabel = summarizeViewers(collab.viewedBy, currentUserId);
            const pipelineLabel = summarizePipeline(collab.jobs);
            return (
              <TableRow key={candidate.id}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    onClick={() => setDetailCandidate(candidate)}
                    className="text-primary hover:underline text-left"
                  >
                    {candidate.fullName}
                  </button>
                  <div className="text-xs text-muted-foreground line-clamp-1">{candidate.headline}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {candidate.wasKnownBefore && (
                      <Badge variant="outline" className="text-[10px] px-1">Known before</Badge>
                    )}
                    {collab.favorited && (
                      <span title="You favourited this person" className="text-[var(--brand)] text-base">★</span>
                    )}
                    <Badge
                      variant={collab.viewedBy.length > 0 ? "secondary" : "outline"}
                      className="text-[10px] px-1"
                      title={viewedLabel}
                    >
                      {collab.viewedBy.length > 0 ? `👁 ${collab.viewedBy.length}` : "👁 –"}
                    </Badge>
                    {pipelineLabel && (
                      <Badge variant="secondary" className="text-[10px] px-1" title={pipelineLabel}>
                        {pipelineLabel}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {candidate.source ? (
                    <Badge variant="secondary" className="text-[10px] px-1">{candidate.source}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {candidate.currentTitle}
                  {candidate.currentCompany && <span className="text-muted-foreground"> @ {candidate.currentCompany}</span>}
                </TableCell>
                <TableCell>{candidate.location || "-"}</TableCell>
                <TableCell>{candidate.totalYearsExperience ? `${candidate.totalYearsExperience}y` : "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {skills.slice(0, 5).map((skill: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1">{skill}</Badge>
                    ))}
                    {skills.length > 5 && <Badge variant="outline" className="text-[10px] px-1">+{skills.length - 5}</Badge>}
                  </div>
                  {mustHaves.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mustHaves.map((mh, i) => {
                        const hasSkill = skills.some((s: string) => s.toLowerCase().includes(mh.toLowerCase()));
                        if (!hasSkill) {
                          return <Badge key={i} variant="destructive" className="text-[10px] px-1 line-through opacity-70">{mh}</Badge>;
                        }
                        return null;
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  <button
                    type="button"
                    onClick={() => setExplaining(candidate)}
                    className="underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    title="Why this score?"
                  >
                    {candidate.score}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    candidate={candidate}
                    collab={collab}
                    jobs={jobs}
                    onCollabChange={onCollabChange}
                    onJobCreated={onJobCreated}
                    onError={onError}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScoreExplanationDialog candidate={explaining} onOpenChange={(open) => !open && setExplaining(null)} />
      <CandidateDetailDialog
        candidate={detailCandidate}
        currentUserId={currentUserId}
        collab={detailCandidate ? collabByPersonId[detailCandidate.id] : undefined}
        jobs={jobs}
        watchlists={watchlists}
        onOpenChange={(open) => !open && setDetailCandidate(null)}
        onCollabChange={onCollabChange}
        onJobCreated={onJobCreated}
        onWatchlistCreated={onWatchlistCreated}
      />
    </div>
  );
}
