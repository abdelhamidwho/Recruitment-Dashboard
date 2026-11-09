import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { WatchlistDetail } from "@/components/WatchlistDetail";

export default async function WatchlistDetailPage({ params }: { params: Promise<{ watchlistId: string }> }) {
  const user = await requireUser();
  const { watchlistId } = await params;
  return (
    <main className="min-h-screen bg-background">
      <>
        <PageHeader />
        <Link href="/watchlists" className="lux-nav-link mx-6 mt-4 inline-block"><ArrowLeft aria-hidden />All watchlists</Link>
      </>
      <WatchlistDetail watchlistId={watchlistId} currentUserId={user.id} />
    </main>
  );
}
