import { SearchBuilder } from "@/components/SearchBuilder";
import { requireUser } from "@/lib/auth/requireUser";
import skills from "@/data/skills.json";

// Guards the page itself, not just the API routes it calls. Without this the
// proxy's cookie-presence check is the only gate, so someone who still owes a
// password change reaches the dashboard and every search fails with a bare
// "Password change required" instead of being sent to /account/password.
export default async function Home() {
  await requireUser();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">HR Sourcing Dashboard</h1>
        <p className="text-muted-foreground text-sm">Build searches, find candidates, and manage shortlists.</p>
      </header>
      <SearchBuilder skillsTaxonomy={skills} />
    </main>
  );
}
