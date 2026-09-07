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

export function ResultsTable({ candidates, filters }: { candidates: ResultCandidate[], filters: Partial<SearchFilters> }) {
  const [sortCol, setSortCol] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
                  {candidate.score}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm">Add to Pipeline</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
