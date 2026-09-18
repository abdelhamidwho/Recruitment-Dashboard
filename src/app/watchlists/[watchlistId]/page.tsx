import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { WatchlistDetail } from "@/components/WatchlistDetail";

export default async function WatchlistDetailPage({ params }: { params: Promise<{ watchlistId: string }> }) {
  const user = await requireUser();
  const { watchlistId } = await params;
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link href="/watchlists" className="text-sm underline">← All watchlists</Link>
      </header>
      <WatchlistDetail watchlistId={watchlistId} currentUserId={user.id} />
    </main>
  );
}
