import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { FavoritesPage } from "@/components/FavoritesPage";

export default async function Favorites() {
  await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="Favourites" subtitle={"Private to you — one click to star, one place to see them all."} />
      <FavoritesPage />
    </main>
  );
}
