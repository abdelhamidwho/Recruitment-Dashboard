"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGES } from "@/lib/auth/constants";
import { ResultCandidate } from "./ResultsTable";
import {
  recordProfileView,
  fetchViewers,
  toggleFavorite as apiToggleFavorite,
  addCandidateToJob,
  changeStage as apiChangeStage,
  fetchStageHistory,
  addToWatchlist as apiAddToWatchlist,
  removeFromWatchlist as apiRemoveFromWatchlist,
  createWatchlist as apiCreateWatchlist,
  createJob as apiCreateJob,
  type JobSummary,
  type WatchlistSummary,
  type ViewerRow,
  type StageEventRow,
} from "@/lib/collaborationApi";
import type { CollaborationState } from "@/lib/collaboration";

function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

interface DetailBodyProps {
  candidate: ResultCandidate;
  currentUserId: string;
  collab: CollaborationState | undefined;
  jobs: JobSummary[];
  watchlists: WatchlistSummary[];
  onCollabChange: (personId: string, updater: (prev: CollaborationState) => CollaborationState) => void;
  onJobCreated: (job: JobSummary) => void;
  onWatchlistCreated: (watchlist: WatchlistSummary) => void;
}

/**
 * The dialog's actual content, mounted fresh (via a `key={candidate.id}` on
 * the caller) every time a different candidate is opened. That remount —
 * rather than an effect that manually resets local state on `candidate`
 * change — is what gives each candidate a clean slate: no leftover viewer
 * list, history, or in-progress form field from whoever was open before.
 */
function CandidateDetailBody({
  candidate,
  currentUserId,
  collab,
  jobs,
  watchlists,
  onCollabChange,
  onJobCreated,
  onWatchlistCreated,
}: DetailBodyProps) {
  const [viewers, setViewers] = React.useState<ViewerRow[]>([]);
  // Starts true — this component only ever exists for the duration of one
  // candidate's view (see the remount-via-key note above) — so the fetch
  // effect below never needs to set it synchronously itself.
  const [loadingViewers, setLoadingViewers] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [expandedHistoryJobId, setExpandedHistoryJobId] = React.useState<string>("");
  const [history, setHistory] = React.useState<Record<string, StageEventRow[]>>({});
  const [addJobId, setAddJobId] = React.useState<string>("");
  const [newJobTitle, setNewJobTitle] = React.useState<string>("");
  const [newWatchlistName, setNewWatchlistName] = React.useState<string>("");
  const [newWatchlistShared, setNewWatchlistShared] = React.useState(false);
  const [busy, setBusy] = React.useState<string>(""); // key of the in-flight action, for disabling its control only

  const personId = candidate.id;

  React.useEffect(() => {
    (async () => {
      const viewResult = await recordProfileView(personId);
      if (!viewResult.ok) {
        setError(`Couldn't record your view: ${viewResult.error}`);
      }
      const viewersResult = await fetchViewers(personId);
      if (viewersResult.ok) {
        setViewers(viewersResult.data!.viewers);
        // Reflect the just-recorded view (and any others) into the row-level cache.
        onCollabChange(personId, (prev) => ({
          ...prev,
          viewedBy: viewersResult.data!.viewers.map((v) => ({
            userId: v.userId,
            name: v.user.name,
            viewCount: v.viewCount,
            lastViewedAt: new Date(v.lastViewedAt),
          })),
        }));
      } else {
        setError((prev) => prev || `Couldn't load viewers: ${viewersResult.error}`);
      }
      setLoadingViewers(false);
    })();
  }, [personId, onCollabChange]);

  const skills: string[] = candidate.skills ? JSON.parse(candidate.skills) : [];
  const experience: { title?: string; company?: string; description?: string }[] = candidate.experience
    ? JSON.parse(candidate.experience)
    : [];
  const education: { school?: string; degree?: string; field?: string }[] = candidate.education
    ? JSON.parse(candidate.education)
    : [];

  const favorited = collab?.favorited ?? false;
  const pipelineJobs = collab?.jobs ?? [];
  const memberWatchlistIds = new Set((collab?.watchlists ?? []).map((w) => w.id));

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } finally {
      setBusy("");
    }
  };

  const handleToggleFavorite = () =>
    runAction("favorite", async () => {
      const result = await apiToggleFavorite(personId);
      if (!result.ok) {
        setError(`Couldn't update favourite: ${result.error}`);
        return;
      }
      onCollabChange(personId, (prev) => ({ ...prev, favorited: result.data!.favorited }));
    });

  const handleAddToJob = () =>
    runAction("addJob", async () => {
      if (!addJobId) return;
      const result = await addCandidateToJob(addJobId, personId);
      if (!result.ok) {
        setError(`Couldn't add to pipeline: ${result.error}`);
        return;
      }
      const job = jobs.find((j) => j.id === addJobId);
      onCollabChange(personId, (prev) => ({
        ...prev,
        jobs: [
          ...prev.jobs.filter((j) => j.jobId !== addJobId),
          { jobId: addJobId, jobTitle: job?.title ?? "Job", stage: result.data!.candidate.stage },
        ],
      }));
      setAddJobId("");
    });

  const handleCreateJobAndAdd = () =>
    runAction("createJob", async () => {
      const title = newJobTitle.trim();
      if (!title) return;
      const created = await apiCreateJob(title);
      if (!created.ok) {
        setError(`Couldn't create job: ${created.error}`);
        return;
      }
      onJobCreated(created.data!.job);
      const added = await addCandidateToJob(created.data!.job.id, personId);
      if (!added.ok) {
        setError(`Job created, but couldn't add candidate: ${added.error}`);
        return;
      }
      onCollabChange(personId, (prev) => ({
        ...prev,
        jobs: [
          ...prev.jobs,
          { jobId: created.data!.job.id, jobTitle: title, stage: added.data!.candidate.stage },
        ],
      }));
      setNewJobTitle("");
    });

  const handleChangeStage = (jobId: string, stage: string) =>
    runAction(`stage-${jobId}`, async () => {
      const result = await apiChangeStage(jobId, personId, stage);
      if (!result.ok) {
        setError(`Couldn't change stage: ${result.error}`);
        return;
      }
      onCollabChange(personId, (prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => (j.jobId === jobId ? { ...j, stage } : j)),
      }));
      if (expandedHistoryJobId === jobId) {
        const hist = await fetchStageHistory(jobId, personId);
        if (hist.ok) setHistory((prev) => ({ ...prev, [jobId]: hist.data!.events }));
      }
    });

  const toggleHistory = async (jobId: string) => {
    if (expandedHistoryJobId === jobId) {
      setExpandedHistoryJobId("");
      return;
    }
    setExpandedHistoryJobId(jobId);
    if (!history[jobId]) {
      const hist = await fetchStageHistory(jobId, personId);
      if (hist.ok) {
        setHistory((prev) => ({ ...prev, [jobId]: hist.data!.events }));
      } else {
        setError(`Couldn't load stage history: ${hist.error}`);
      }
    }
  };

  const handleToggleWatchlist = (watchlistId: string, currentlyIn: boolean) =>
    runAction(`watchlist-${watchlistId}`, async () => {
      const result = currentlyIn
        ? await apiRemoveFromWatchlist(watchlistId, personId)
        : await apiAddToWatchlist(watchlistId, personId);
      if (!result.ok) {
        setError(`Couldn't update watchlist: ${result.error}`);
        return;
      }
      const wl = watchlists.find((w) => w.id === watchlistId);
      onCollabChange(personId, (prev) => ({
        ...prev,
        watchlists: currentlyIn
          ? prev.watchlists.filter((w) => w.id !== watchlistId)
          : [
              ...prev.watchlists,
              {
                id: watchlistId,
                name: wl?.name ?? "Watchlist",
                isShared: wl?.isShared ?? false,
                mine: wl?.ownerId === currentUserId,
              },
            ],
      }));
    });

  const handleCreateWatchlist = () =>
    runAction("createWatchlist", async () => {
      const name = newWatchlistName.trim();
      if (!name) return;
      const created = await apiCreateWatchlist(name, newWatchlistShared);
      if (!created.ok) {
        setError(`Couldn't create watchlist: ${created.error}`);
        return;
      }
      onWatchlistCreated(created.data!.watchlist);
      const added = await apiAddToWatchlist(created.data!.watchlist.id, personId);
      if (!added.ok) {
        setError(`Watchlist created, but couldn't add candidate: ${added.error}`);
        return;
      }
      onCollabChange(personId, (prev) => ({
        ...prev,
        watchlists: [
          ...prev.watchlists,
          { id: created.data!.watchlist.id, name, isShared: newWatchlistShared, mine: true },
        ],
      }));
      setNewWatchlistName("");
      setNewWatchlistShared(false);
    });

  const availableJobsToAdd = jobs.filter((j) => !pipelineJobs.some((pj) => pj.jobId === j.id));

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-lg">{candidate.fullName}</DialogTitle>
            <DialogDescription>
              {candidate.currentTitle}
              {candidate.currentCompany ? ` @ ${candidate.currentCompany}` : ""}
              {candidate.location ? ` — ${candidate.location}` : ""}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant={favorited ? "default" : "outline"}
            size="sm"
            disabled={busy === "favorite"}
            onClick={handleToggleFavorite}
            aria-pressed={favorited}
          >
            {favorited ? "★ Favourited" : "☆ Favourite"}
          </Button>
        </div>
      </DialogHeader>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Profile */}
      <section className="space-y-2">
        {candidate.summary && <p className="text-sm text-muted-foreground">{candidate.summary}</p>}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1">{s}</Badge>
            ))}
          </div>
        )}
        {experience.length > 0 && (
          <div className="text-sm">
            <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">Experience</p>
            <ul className="space-y-1">
              {experience.slice(0, 4).map((e, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium">{e.title}</span>
                  {e.company ? ` @ ${e.company}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {education.length > 0 && (
          <div className="text-sm">
            <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">Education</p>
            <ul className="space-y-1">
              {education.slice(0, 3).map((e, i) => (
                <li key={i} className="text-xs">
                  {e.degree ? `${e.degree}, ` : ""}
                  {e.field ? `${e.field}, ` : ""}
                  {e.school}
                </li>
              ))}
            </ul>
          </div>
        )}
        <a href={candidate.profileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
          View original profile
        </a>
      </section>

      {/* Viewers */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-1">Who&apos;s viewed this person</p>
        {loadingViewers ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : viewers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not viewed yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {viewers.map((v) => (
              <li key={v.id} className="text-xs flex justify-between gap-2">
                <span>
                  {v.user.name}
                  {v.userId === currentUserId ? " (you)" : ""}
                  {v.viewCount > 1 ? ` · ${v.viewCount} views` : ""}
                </span>
                <span className="text-muted-foreground">{timeAgo(v.lastViewedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pipeline / stage */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-1">Pipeline &amp; stage</p>
        {pipelineJobs.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-2">Not on any job&apos;s pipeline yet.</p>
        ) : (
          <ul className="space-y-2 mb-2">
            {pipelineJobs.map((pj) => (
              <li key={pj.jobId} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{pj.jobTitle}</span>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
                      value={pj.stage}
                      disabled={busy === `stage-${pj.jobId}`}
                      onChange={(e) => handleChangeStage(pj.jobId, e.target.value)}
                      aria-label={`Change stage for ${pj.jobTitle}`}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-xs underline text-muted-foreground"
                      onClick={() => toggleHistory(pj.jobId)}
                    >
                      {expandedHistoryJobId === pj.jobId ? "Hide history" : "History"}
                    </button>
                  </div>
                </div>
                {expandedHistoryJobId === pj.jobId && (
                  <ul className="mt-2 space-y-1 border-t pt-2">
                    {(history[pj.jobId] ?? []).length === 0 && (
                      <li className="text-xs text-muted-foreground">No history yet.</li>
                    )}
                    {(history[pj.jobId] ?? []).map((ev) => (
                      <li key={ev.id} className="text-xs flex justify-between gap-2">
                        <span>
                          {ev.fromStage ? `${ev.fromStage} → ${ev.toStage}` : `Added at ${ev.toStage}`}
                          {" by "}
                          {ev.user.name}
                        </span>
                        <span className="text-muted-foreground">{timeAgo(ev.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
            value={addJobId}
            onChange={(e) => setAddJobId(e.target.value)}
            aria-label="Add to job"
          >
            <option value="">Add to job…</option>
            {availableJobsToAdd.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={!addJobId || busy === "addJob"} onClick={handleAddToJob}>
            Add
          </Button>
          <span className="text-xs text-muted-foreground">or</span>
          <Input
            className="h-7 w-40 text-xs"
            placeholder="New job title"
            value={newJobTitle}
            onChange={(e) => setNewJobTitle(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" disabled={!newJobTitle.trim() || busy === "createJob"} onClick={handleCreateJobAndAdd}>
            Create &amp; add
          </Button>
        </div>
      </section>

      {/* Watchlists */}
      <section>
        <p className="text-xs font-medium text-muted-foreground mb-1">Watchlists</p>
        {watchlists.length === 0 ? (
          <p className="text-xs text-muted-foreground mb-2">No watchlists yet.</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {watchlists.map((w) => {
              const inList = memberWatchlistIds.has(w.id);
              return (
                <li key={w.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {w.name}{" "}
                    <Badge variant={w.isShared ? "secondary" : "outline"} className="text-[10px] px-1 align-middle">
                      {w.isShared ? "shared" : "private"}
                    </Badge>
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant={inList ? "secondary" : "outline"}
                    disabled={busy === `watchlist-${w.id}`}
                    onClick={() => handleToggleWatchlist(w.id, inList)}
                  >
                    {inList ? "Remove" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-7 w-40 text-xs"
            placeholder="New watchlist name"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={newWatchlistShared}
              onChange={(e) => setNewWatchlistShared(e.target.checked)}
            />
            Shared
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!newWatchlistName.trim() || busy === "createWatchlist"}
            onClick={handleCreateWatchlist}
          >
            Create &amp; add
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * Full candidate detail: profile, who's viewed them and when, per-job stage
 * (with history), and the controls to act — favourite, add to a watchlist,
 * add to a job's pipeline, change stage. Opening it records the view
 * automatically (no "mark as seen" button — see the owner's brief), which is
 * what makes "already seen by Sara" trustworthy.
 */
export function CandidateDetailDialog({
  candidate,
  currentUserId,
  collab,
  jobs,
  watchlists,
  onOpenChange,
  onCollabChange,
  onJobCreated,
  onWatchlistCreated,
}: {
  candidate: ResultCandidate | null;
  currentUserId: string;
  collab: CollaborationState | undefined;
  jobs: JobSummary[];
  watchlists: WatchlistSummary[];
  onOpenChange: (open: boolean) => void;
  onCollabChange: (personId: string, updater: (prev: CollaborationState) => CollaborationState) => void;
  onJobCreated: (job: JobSummary) => void;
  onWatchlistCreated: (watchlist: WatchlistSummary) => void;
}) {
  return (
    <Dialog open={candidate !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {candidate && (
          <CandidateDetailBody
            key={candidate.id}
            candidate={candidate}
            currentUserId={currentUserId}
            collab={collab}
            jobs={jobs}
            watchlists={watchlists}
            onCollabChange={onCollabChange}
            onJobCreated={onJobCreated}
            onWatchlistCreated={onWatchlistCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
