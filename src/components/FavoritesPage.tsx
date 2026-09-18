"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { fetchFavorites, toggleFavorite } from "@/lib/collaborationApi";

interface FavoriteRow {
  personId: string;
  person: { fullName?: string; currentTitle?: string; currentCompany?: string; profileUrl?: string };
}

/** Everything the current user has starred — private, per the owner's decision (favourites are never shared). */
export function FavoritesPage() {
  const [favorites, setFavorites] = React.useState<FavoriteRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const result = await fetchFavorites();
      setLoading(false);
      if (result.ok) setFavorites(result.data!.favorites as unknown as FavoriteRow[]);
      else setError(`Couldn't load favourites: ${result.error}`);
    })();
  }, []);

  const handleRemove = async (personId: string) => {
    setBusy(personId);
    const result = await toggleFavorite(personId);
    setBusy("");
    if (!result.ok) {
      setError(`Couldn't remove favourite: ${result.error}`);
      return;
    }
    if (!result.data!.favorited) {
      setFavorites((prev) => prev.filter((f) => f.personId !== personId));
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : favorites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No favourites yet — star a candidate from the results table or their detail view.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {favorites.map((f) => (
            <li key={f.personId} className="p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{f.person.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {f.person.currentTitle}
                  {f.person.currentCompany ? ` @ ${f.person.currentCompany}` : ""}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={busy === f.personId} onClick={() => handleRemove(f.personId)}>
                ★ Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
