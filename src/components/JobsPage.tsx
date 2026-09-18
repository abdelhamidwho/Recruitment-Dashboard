"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchJobs, createJob, type JobSummary } from "@/lib/collaborationApi";

/** Job list + creation. Each job links to its pipeline board (src/app/jobs/[jobId]). */
export function JobsPage() {
  const [jobs, setJobs] = React.useState<JobSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [error, setError] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Fetch inline (not via a separately-defined, effect-called function) so
  // every setState call here happens after an await the linter can see is
  // asynchronous.
  React.useEffect(() => {
    (async () => {
      const result = await fetchJobs();
      setLoading(false);
      if (result.ok) setJobs(result.data!.jobs);
      else setError(`Couldn't load jobs: ${result.error}`);
    })();
  }, []);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    setError("");
    const result = await createJob(trimmed, location.trim() || undefined);
    setCreating(false);
    if (!result.ok) {
      setError(`Couldn't create job: ${result.error}`);
      return;
    }
    setJobs((prev) => [result.data!.job, ...prev]);
    setTitle("");
    setLocation("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border p-4 space-y-2">
        <p className="text-sm font-medium">New job</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" />
          <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className="max-w-xs" />
          <Button type="button" disabled={!title.trim() || creating} onClick={handleCreate}>
            Create job
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs yet. Create one above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {jobs.map((job) => (
            <li key={job.id} className="p-3 flex items-center justify-between gap-2">
              <div>
                <Link href={`/jobs/${job.id}`} className="font-medium text-blue-600 hover:underline">
                  {job.title}
                </Link>
                {job.location && <span className="text-sm text-muted-foreground"> — {job.location}</span>}
              </div>
              <Badge variant="secondary">{job._count?.candidates ?? 0} candidate{(job._count?.candidates ?? 0) === 1 ? "" : "s"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
