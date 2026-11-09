import { SearchBuilder } from "@/components/SearchBuilder";
import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import skills from "@/data/skills.json";
import { APIFY_AVAILABLE } from "@/lib/apify";

// Guards the page itself, not just the API routes it calls. Without this the
// proxy's cookie-presence check is the only gate, so someone who still owes a
// password change reaches the dashboard and every search fails with a bare
// "Password change required" instead of being sent to /account/password.
export default async function Home() {
  const user = await requireUser();

  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="Find candidates" subtitle="Type a job title, choose where to look, and press Find candidates." />
      <SearchBuilder skillsTaxonomy={skills} currentUserId={user.id} apifyAvailable={APIFY_AVAILABLE} />
    </main>
  );
}
