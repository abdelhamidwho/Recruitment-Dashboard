import { prisma } from "@/lib/prisma";
import { STAGES, type Stage } from "@/lib/auth/constants";

/** Thrown by service functions for conditions the caller should turn into a 4xx response. */
export class CollaborationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "CollaborationError";
  }
}

export function isValidStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Jobs & pipelines
// ---------------------------------------------------------------------------

export async function createJob(
  actorId: string,
  data: { title: string; location?: string | null; description?: string | null },
) {
  const title = data.title?.trim();
  if (!title) throw new CollaborationError("title is required", 400);

  return prisma.job.create({
    data: {
      title,
      location: data.location ?? null,
      description: data.description ?? null,
      createdById: actorId,
    },
  });
}

export async function listJobs() {
  return prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  });
}

/**
 * Adds a person to a job's pipeline. Idempotent: adding the same person
 * twice returns the existing JobCandidate rather than erroring or
 * duplicating (the (jobId, personId) unique constraint backs this). A
 * StageEvent is recorded only on first creation, going from `null` (no
 * prior stage) to the default "Sourced".
 */
export async function addCandidateToJob(jobId: string, personId: string, actorId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new CollaborationError("Job not found", 404);

  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) throw new CollaborationError("Person not found", 404);

  const existing = await prisma.jobCandidate.findUnique({
    where: { jobId_personId: { jobId, personId } },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const created = await tx.jobCandidate.create({
      data: { jobId, personId, ownerId: actorId, updatedById: actorId },
    });
    await tx.stageEvent.create({
      data: {
        jobCandidateId: created.id,
        fromStage: null,
        toStage: created.stage,
        userId: actorId,
      },
    });
    return created;
  });
}

/** Changes a JobCandidate's stage, validating against STAGES and recording a StageEvent. */
export async function changeStage(
  jobId: string,
  personId: string,
  toStage: string,
  actorId: string,
) {
  if (!isValidStage(toStage)) {
    throw new CollaborationError(
      `Invalid stage "${toStage}". Must be one of: ${STAGES.join(", ")}`,
      400,
    );
  }

  const candidate = await prisma.jobCandidate.findUnique({
    where: { jobId_personId: { jobId, personId } },
  });
  if (!candidate) throw new CollaborationError("Candidate is not on this job's pipeline", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.jobCandidate.update({
      where: { id: candidate.id },
      data: { stage: toStage, updatedById: actorId },
    });
    await tx.stageEvent.create({
      data: {
        jobCandidateId: candidate.id,
        fromStage: candidate.stage,
        toStage,
        userId: actorId,
      },
    });
    return updated;
  });
}

/** A job's pipeline, grouped by stage, each candidate carrying its Person. */
export async function getPipeline(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new CollaborationError("Job not found", 404);

  const candidates = await prisma.jobCandidate.findMany({
    where: { jobId },
    include: { person: true },
    orderBy: { updatedAt: "desc" },
  });

  const byStage: Record<string, typeof candidates> = {};
  for (const stage of STAGES) byStage[stage] = [];
  for (const c of candidates) {
    (byStage[c.stage] ??= []).push(c);
  }

  return { job, byStage };
}

/** Full stage-change audit trail for one person on one job, oldest first. */
export async function getStageHistory(jobId: string, personId: string) {
  const candidate = await prisma.jobCandidate.findUnique({
    where: { jobId_personId: { jobId, personId } },
  });
  if (!candidate) throw new CollaborationError("Candidate is not on this job's pipeline", 404);

  return prisma.stageEvent.findMany({
    where: { jobCandidateId: candidate.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Profile views
// ---------------------------------------------------------------------------

/**
 * Records that `userId` viewed `personId`. First view creates the row;
 * every subsequent view increments viewCount and bumps lastViewedAt without
 * creating a second row (unique on personId+userId backs this).
 */
export async function recordView(personId: string, userId: string) {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) throw new CollaborationError("Person not found", 404);

  const existing = await prisma.profileView.findUnique({
    where: { personId_userId: { personId, userId } },
  });

  if (existing) {
    return prisma.profileView.update({
      where: { id: existing.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
  }

  return prisma.profileView.create({ data: { personId, userId } });
}

export async function getViewers(personId: string) {
  return prisma.profileView.findMany({
    where: { personId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { lastViewedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Watchlists
// ---------------------------------------------------------------------------

export async function createWatchlist(actorId: string, name: string, isShared = false) {
  const trimmed = name?.trim();
  if (!trimmed) throw new CollaborationError("name is required", 400);
  return prisma.watchlist.create({ data: { name: trimmed, ownerId: actorId, isShared } });
}

/** Watchlists visible to a user: their own (private or shared) plus other users' shared ones. */
export async function listWatchlistsFor(userId: string) {
  return prisma.watchlist.findMany({
    where: { OR: [{ ownerId: userId }, { isShared: true }] },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Loads a watchlist and enforces that userId may see it (owner, or shared). Throws 404 otherwise — never reveals existence of a private list belonging to someone else. */
async function loadVisibleWatchlist(watchlistId: string, userId: string) {
  const watchlist = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
  if (!watchlist || (watchlist.ownerId !== userId && !watchlist.isShared)) {
    throw new CollaborationError("Watchlist not found", 404);
  }
  return watchlist;
}

export async function getWatchlist(watchlistId: string, userId: string) {
  const watchlist = await loadVisibleWatchlist(watchlistId, userId);
  const items = await prisma.watchlistItem.findMany({
    where: { watchlistId },
    include: { person: true, addedBy: { select: { id: true, name: true } } },
    orderBy: { addedAt: "desc" },
  });
  return { watchlist, items };
}

/** Only the owner may mutate a watchlist's membership or sharing. */
async function requireOwnedWatchlist(watchlistId: string, userId: string) {
  const watchlist = await prisma.watchlist.findUnique({ where: { id: watchlistId } });
  if (!watchlist) throw new CollaborationError("Watchlist not found", 404);
  if (watchlist.ownerId !== userId) {
    throw new CollaborationError("Only the owner can modify this watchlist", 403);
  }
  return watchlist;
}

export async function addToWatchlist(watchlistId: string, personId: string, actorId: string) {
  await requireOwnedWatchlist(watchlistId, actorId);

  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) throw new CollaborationError("Person not found", 404);

  const existing = await prisma.watchlistItem.findUnique({
    where: { watchlistId_personId: { watchlistId, personId } },
  });
  if (existing) return existing;

  return prisma.watchlistItem.create({
    data: { watchlistId, personId, addedById: actorId },
  });
}

export async function removeFromWatchlist(watchlistId: string, personId: string, actorId: string) {
  await requireOwnedWatchlist(watchlistId, actorId);
  await prisma.watchlistItem.deleteMany({ where: { watchlistId, personId } });
  return { removed: true };
}

export async function setWatchlistSharing(watchlistId: string, actorId: string, isShared: boolean) {
  await requireOwnedWatchlist(watchlistId, actorId);
  return prisma.watchlist.update({ where: { id: watchlistId }, data: { isShared } });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/** Toggles a favourite for the acting user. Returns the new state. */
export async function toggleFavorite(userId: string, personId: string) {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) throw new CollaborationError("Person not found", 404);

  const existing = await prisma.favorite.findUnique({
    where: { userId_personId: { userId, personId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({ data: { userId, personId } });
  return { favorited: true };
}

export async function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Batch collaboration state (used by the results table — must not be N+1)
// ---------------------------------------------------------------------------

export interface CollaborationState {
  favorited: boolean;
  watchlists: { id: string; name: string; isShared: boolean; mine: boolean }[];
  viewedBy: { userId: string; name: string; viewCount: number; lastViewedAt: Date }[];
  jobs: { jobId: string; jobTitle: string; stage: string }[];
}

/**
 * Returns collaboration state for a batch of people in four fixed queries
 * total (favorites, watchlist items, profile views, job candidates), no
 * matter how many personIds are passed — the results table renders this for
 * 30 candidates at once and must not issue one query per candidate.
 */
export async function getCollaborationState(
  personIds: string[],
  userId: string,
): Promise<Record<string, CollaborationState>> {
  const state: Record<string, CollaborationState> = {};
  for (const id of personIds) {
    state[id] = { favorited: false, watchlists: [], viewedBy: [], jobs: [] };
  }
  if (personIds.length === 0) return state;

  const [favorites, watchlistItems, views, jobCandidates] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId, personId: { in: personIds } },
      select: { personId: true },
    }),
    prisma.watchlistItem.findMany({
      where: {
        personId: { in: personIds },
        watchlist: { OR: [{ ownerId: userId }, { isShared: true }] },
      },
      select: {
        personId: true,
        watchlist: { select: { id: true, name: true, isShared: true, ownerId: true } },
      },
    }),
    prisma.profileView.findMany({
      where: { personId: { in: personIds } },
      select: {
        personId: true,
        viewCount: true,
        lastViewedAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.jobCandidate.findMany({
      where: { personId: { in: personIds } },
      select: { personId: true, stage: true, job: { select: { id: true, title: true } } },
    }),
  ]);

  for (const f of favorites) state[f.personId].favorited = true;

  for (const item of watchlistItems) {
    state[item.personId].watchlists.push({
      id: item.watchlist.id,
      name: item.watchlist.name,
      isShared: item.watchlist.isShared,
      mine: item.watchlist.ownerId === userId,
    });
  }

  for (const v of views) {
    state[v.personId].viewedBy.push({
      userId: v.user.id,
      name: v.user.name,
      viewCount: v.viewCount,
      lastViewedAt: v.lastViewedAt,
    });
  }

  for (const jc of jobCandidates) {
    state[jc.personId].jobs.push({ jobId: jc.job.id, jobTitle: jc.job.title, stage: jc.stage });
  }

  return state;
}
