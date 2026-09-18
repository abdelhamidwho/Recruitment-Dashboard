import Link from "next/link";
import { SearchBuilder } from "@/components/SearchBuilder";
import { requireUser } from "@/lib/auth/requireUser";
import skills from "@/data/skills.json";

// Guards the page itself, not just the API routes it calls. Without this the
// proxy's cookie-presence check is the only gate, so someone who still owes a
// password change reaches the dashboard and every search fails with a bare
// "Password change required" instead of being sent to /account/password.
export default async function Home() {
  const user = await requireUser();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">HR Sourcing Dashboard</h1>
            <p className="text-muted-foreground text-sm">Build searches, find candidates, and manage shortlists.</p>
          </div>
          <nav className="flex items-center gap-4 text-sm pt-1">
            <Link href="/jobs" className="underline">Jobs</Link>
            <Link href="/watchlists" className="underline">Watchlists</Link>
            <Link href="/favorites" className="underline">Favourites</Link>
          </nav>
        </div>
      </header>
      <SearchBuilder skillsTaxonomy={skills} currentUserId={user.id} />
    </main>
  );
}
