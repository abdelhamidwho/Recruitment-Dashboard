"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchWatchlists, createWatchlist, type WatchlistSummary } from "@/lib/collaborationApi";

/** Watchlist list + creation. Private vs shared is shown at a glance via the badge; each list links to its detail page. */
export function WatchlistsPage({ currentUserId }: { currentUserId: string }) {
  const [watchlists, setWatchlists] = React.useState<WatchlistSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  // Fetch inline (not via a separately-defined, effect-called function) so
  // every setState call here happens after an await the linter can see is
  // asynchronous.
  React.useEffect(() => {
    (async () => {
      const result = await fetchWatchlists();
      setLoading(false);
      if (result.ok) setWatchlists(result.data!.watchlists);
      else setError(`Couldn't load watchlists: ${result.error}`);
    })();
  }, []);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError("");
    const result = await createWatchlist(trimmed, shared);
    setCreating(false);
    if (!result.ok) {
      setError(`Couldn't create watchlist: ${result.error}`);
      return;
    }
    setWatchlists((prev) => [result.data!.watchlist, ...prev]);
    setName("");
    setShared(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border p-4 space-y-2">
        <p className="text-sm font-medium">New watchlist</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Shared with the team
          </label>
          <Button type="button" disabled={!name.trim() || creating} onClick={handleCreate}>
            Create watchlist
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : watchlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No watchlists yet. Create one above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {watchlists.map((w) => (
            <li key={w.id} className="p-3 flex items-center justify-between gap-2">
              <div>
                <Link href={`/watchlists/${w.id}`} className="font-medium text-primary hover:underline">
                  {w.name}
                </Link>
                <span className="text-xs text-muted-foreground ml-2">
                  {w.ownerId === currentUserId ? "owned by you" : `owned by ${w.owner.name}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.isShared ? "secondary" : "outline"}>{w.isShared ? "shared" : "private"}</Badge>
                <Badge variant="secondary">{w._count?.items ?? 0}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
