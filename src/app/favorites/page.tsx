import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { FavoritesPage } from "@/components/FavoritesPage";

export default async function Favorites() {
  await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Favourites</h1>
            <p className="text-muted-foreground text-sm">Private to you — one click to star, one place to see them all.</p>
          </div>
          <Link href="/" className="text-sm underline">Back to search</Link>
        </div>
      </header>
      <FavoritesPage />
    </main>
  );
}
