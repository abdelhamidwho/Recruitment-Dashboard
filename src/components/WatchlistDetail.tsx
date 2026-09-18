"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchWatchlist,
  setWatchlistSharing,
  deleteWatchlist,
  removeFromWatchlist,
  type WatchlistSummary,
  type WatchlistItemRow,
} from "@/lib/collaborationApi";

/**
 * One watchlist: who's in it, who added them, and — owner only — the
 * share/unshare/delete controls. Any team member may remove a person from a
 * *shared* list (see the owner's decision on watchlist authorisation); a
 * private list's membership stays owner-only, which the API already
 * enforces, so a failed remove here surfaces the API's error rather than
 * hiding the control.
 */
export function WatchlistDetail({ watchlistId, currentUserId }: { watchlistId: string; currentUserId: string }) {
  const [watchlist, setWatchlist] = React.useState<WatchlistSummary | null>(null);
  const [items, setItems] = React.useState<WatchlistItemRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [deleted, setDeleted] = React.useState(false);

  // Fetch inline (not via a separately-defined, effect-called function) so
  // every setState call here happens after an await the linter can see is
  // asynchronous.
  React.useEffect(() => {
    (async () => {
      const result = await fetchWatchlist(watchlistId);
      setLoading(false);
      if (!result.ok) {
        setError(`Couldn't load this watchlist: ${result.error}`);
        return;
      }
      setWatchlist(result.data!.watchlist);
      setItems(result.data!.items);
    })();
  }, [watchlistId]);

  const isOwner = watchlist?.ownerId === currentUserId;

  const handleToggleShare = async () => {
    if (!watchlist) return;
    setBusy("share");
    const result = await setWatchlistSharing(watchlistId, !watchlist.isShared);
    setBusy("");
    if (!result.ok) {
      setError(`Couldn't update sharing: ${result.error}`);
      return;
    }
    setWatchlist(result.data!.watchlist);
  };

  const handleDelete = async () => {
    setBusy("delete");
    const result = await deleteWatchlist(watchlistId);
    setBusy("");
    if (!result.ok) {
      setError(`Couldn't delete this watchlist: ${result.error}`);
      return;
    }
    setDeleted(true);
  };

  const handleRemove = async (personId: string) => {
    setBusy(`remove-${personId}`);
    const result = await removeFromWatchlist(watchlistId, personId);
    setBusy("");
    if (!result.ok) {
      setError(`Couldn't remove candidate: ${result.error}`);
      return;
    }
    setItems((prev) => prev.filter((i) => i.personId !== personId));
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  if (deleted) return <p className="p-6 text-sm text-muted-foreground">Watchlist deleted.</p>;
  if (!watchlist) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error || "Watchlist not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{watchlist.name}</h1>
          <Badge variant={watchlist.isShared ? "secondary" : "outline"}>{watchlist.isShared ? "shared" : "private"}</Badge>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy === "share"} onClick={handleToggleShare}>
              {watchlist.isShared ? "Unshare" : "Share with team"}
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={busy === "delete"} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Owned by {isOwner ? "you" : watchlist.owner.name}. {watchlist.isShared ? "Any team member can add or remove people here." : "Only you can add or remove people here."}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No candidates in this list yet — add them from a candidate&apos;s detail view.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => {
            const person = item.person as { fullName?: string; currentTitle?: string; currentCompany?: string };
            return (
              <li key={item.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{person.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.currentTitle}
                    {person.currentCompany ? ` @ ${person.currentCompany}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Added by {item.addedBy.name}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy === `remove-${item.personId}`}
                  onClick={() => handleRemove(item.personId)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
