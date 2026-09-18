import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { JobsPage } from "@/components/JobsPage";

export default async function Jobs() {
  await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
            <p className="text-muted-foreground text-sm">Create a job, add candidates, and move them through stages.</p>
          </div>
          <Link href="/" className="text-sm underline">Back to search</Link>
        </div>
      </header>
      <JobsPage />
    </main>
  );
}
