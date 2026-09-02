-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Shortlist";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ShortlistItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RECRUITER',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileUrl" TEXT NOT NULL,
    "externalId" TEXT,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "avatarUrl" TEXT,
    "summary" TEXT,
    "locationRaw" TEXT,
    "city" TEXT,
    "country" TEXT,
    "region" TEXT,
    "industry" TEXT,
    "highestDegree" TEXT,
    "fieldsOfStudy" TEXT NOT NULL DEFAULT '[]',
    "totalYearsExperience" REAL,
    "workAuthorization" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "experience" TEXT NOT NULL DEFAULT '[]',
    "education" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "certifications" TEXT NOT NULL DEFAULT '[]',
    "raw" TEXT NOT NULL DEFAULT '{}',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SearchRunPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchRunId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "score" INTEGER,
    "scoreBreakdown" TEXT,
    "wasKnownBefore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchRunPerson_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SearchRunPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Sourced',
    "ownerId" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobCandidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobCandidate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobCandidate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobCandidate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobCandidateId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageEvent_jobCandidateId_fkey" FOREIGN KEY ("jobCandidateId") REFERENCES "JobCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileView_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Watchlist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchlistId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistItem_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("content", "createdAt", "id", "updatedAt") SELECT "content", "createdAt", "id", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_personId_idx" ON "Note"("personId");
CREATE TABLE "new_SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "ownerId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedSearch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SavedSearch" ("createdAt", "filters", "id", "name", "updatedAt") SELECT "createdAt", "filters", "id", "name", "updatedAt" FROM "SavedSearch";
DROP TABLE "SavedSearch";
ALTER TABLE "new_SavedSearch" RENAME TO "SavedSearch";
CREATE INDEX "SavedSearch_ownerId_idx" ON "SavedSearch"("ownerId");
CREATE TABLE "new_SearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "runId" TEXT,
    "datasetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "failureReason" TEXT,
    "filters" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SearchRun" ("createdAt", "datasetId", "filters", "id", "itemCount", "runId", "status", "updatedAt") SELECT "createdAt", "datasetId", "filters", "id", "itemCount", "runId", "status", "updatedAt" FROM "SearchRun";
DROP TABLE "SearchRun";
ALTER TABLE "new_SearchRun" RENAME TO "SearchRun";
CREATE INDEX "SearchRun_ownerId_createdAt_idx" ON "SearchRun"("ownerId", "createdAt");
CREATE INDEX "SearchRun_createdAt_idx" ON "SearchRun"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Person_profileUrl_key" ON "Person"("profileUrl");

-- CreateIndex
CREATE INDEX "Person_country_idx" ON "Person"("country");

-- CreateIndex
CREATE INDEX "Person_region_idx" ON "Person"("region");

-- CreateIndex
CREATE INDEX "Person_industry_idx" ON "Person"("industry");

-- CreateIndex
CREATE INDEX "Person_highestDegree_idx" ON "Person"("highestDegree");

-- CreateIndex
CREATE INDEX "SearchRunPerson_personId_idx" ON "SearchRunPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchRunPerson_searchRunId_personId_key" ON "SearchRunPerson"("searchRunId", "personId");

-- CreateIndex
CREATE INDEX "Job_createdById_idx" ON "Job"("createdById");

-- CreateIndex
CREATE INDEX "JobCandidate_personId_idx" ON "JobCandidate"("personId");

-- CreateIndex
CREATE INDEX "JobCandidate_jobId_stage_idx" ON "JobCandidate"("jobId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "JobCandidate_jobId_personId_key" ON "JobCandidate"("jobId", "personId");

-- CreateIndex
CREATE INDEX "StageEvent_jobCandidateId_idx" ON "StageEvent"("jobCandidateId");

-- CreateIndex
CREATE INDEX "ProfileView_userId_idx" ON "ProfileView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileView_personId_userId_key" ON "ProfileView"("personId", "userId");

-- CreateIndex
CREATE INDEX "Watchlist_ownerId_idx" ON "Watchlist"("ownerId");

-- CreateIndex
CREATE INDEX "WatchlistItem_personId_idx" ON "WatchlistItem"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_personId_key" ON "WatchlistItem"("watchlistId", "personId");

-- CreateIndex
CREATE INDEX "Favorite_personId_idx" ON "Favorite"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_personId_key" ON "Favorite"("userId", "personId");

-- Carry every distinct profile into Person, keeping the most recently updated row per profileUrl.
INSERT INTO "Person" (
  "id", "profileUrl", "externalId", "fullName", "headline", "currentTitle", "currentCompany",
  "avatarUrl", "summary", "locationRaw", "skills", "experience", "education", "languages",
  "certifications", "raw", "totalYearsExperience", "fieldsOfStudy", "firstSeenAt", "lastRefreshedAt"
)
SELECT
  c."id", c."profileUrl", c."externalId", c."fullName", c."headline", c."currentTitle",
  c."currentCompany", c."avatarUrl", c."summary", c."location",
  COALESCE(c."skills", '[]'), COALESCE(c."experience", '[]'), COALESCE(c."education", '[]'),
  COALESCE(c."languages", '[]'), COALESCE(c."certifications", '[]'), COALESCE(c."raw", '{}'),
  c."totalYearsExperience", '[]', c."createdAt", c."updatedAt"
FROM "Candidate" c
WHERE c."id" = (
  SELECT c2."id" FROM "Candidate" c2
  WHERE c2."profileUrl" = c."profileUrl"
  ORDER BY c2."updatedAt" DESC, c2."id" DESC
  LIMIT 1
);

-- One appearance row per (run, person). GROUP BY collapses rows duplicated inside a single run.
INSERT INTO "SearchRunPerson" (
  "id", "searchRunId", "personId", "score", "scoreBreakdown", "wasKnownBefore", "createdAt"
)
SELECT
  MIN(c."id"), c."searchRunId", p."id", MAX(c."score"), MIN(c."scoreBreakdown"), 0, MIN(c."createdAt")
FROM "Candidate" c
JOIN "Person" p ON p."profileUrl" = c."profileUrl"
GROUP BY c."searchRunId", p."id";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Candidate";
PRAGMA foreign_keys=on;
