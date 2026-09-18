import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { WatchlistsPage } from "@/components/WatchlistsPage";

export default async function Watchlists() {
  const user = await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Watchlists</h1>
            <p className="text-muted-foreground text-sm">
              Create a list, add candidates, and share it with the team — like a YouTube watch list.
            </p>
          </div>
          <Link href="/" className="text-sm underline">Back to search</Link>
        </div>
      </header>
      <WatchlistsPage currentUserId={user.id} />
    </main>
  );
}
