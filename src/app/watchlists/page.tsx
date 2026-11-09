import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistsPage } from "@/components/WatchlistsPage";

export default async function Watchlists() {
  const user = await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="Watchlists" subtitle={"Create a list, add candidates, and share it with the team."} />
      <WatchlistsPage currentUserId={user.id} />
    </main>
  );
}
