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
import { SearchFilters } from "@/lib/buildBooleanQuery";

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
  negative: "text-red-600 dark:text-red-400",
  excluded: "text-red-600 dark:text-red-400",
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

export function ResultsTable({ candidates, filters }: { candidates: ResultCandidate[], filters: Partial<SearchFilters> }) {
  const [sortCol, setSortCol] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [explaining, setExplaining] = useState<ResultCandidate | null>(null);

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
            return (
              <TableRow key={candidate.id}>
                <TableCell className="font-medium">
                  <a href={candidate.profileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {candidate.fullName}
                  </a>
                  <div className="text-xs text-muted-foreground line-clamp-1">{candidate.headline}</div>
                  {candidate.wasKnownBefore && (
                    <Badge variant="outline" className="text-[10px] px-1 mt-1">Known before</Badge>
                  )}
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
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm">Add to Pipeline</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScoreExplanationDialog candidate={explaining} onOpenChange={(open) => !open && setExplaining(null)} />
    </div>
  );
}
