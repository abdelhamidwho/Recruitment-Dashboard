"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { bookmarkletHref, bookmarkletSource } from "@/lib/linkedinBookmarklet";

type ImportResult = { searchRunId: string; imported: number; newPeople: number; errors: string[] };

export function LinkedInImport() {
  const linkRef = React.useRef<HTMLAnchorElement>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);

  // React refuses `javascript:` hrefs in JSX, so set the attribute directly.
  React.useEffect(() => {
    linkRef.current?.setAttribute("href", bookmarkletHref());
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  async function submit() {
    setError("");
    setResult(null);
    let profiles: unknown;
    try {
      // Accept one JSON value, or several pasted back-to-back (one per bookmarklet click).
      const trimmed = text.trim();
      try {
        profiles = JSON.parse(trimmed);
      } catch {
        profiles = JSON.parse("[" + trimmed.replace(/}\s*{/g, "},{") + "]");
      }
    } catch {
      setError("That isn't valid JSON. Paste exactly what the bookmarklet or script produced.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/import/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError([data.error, ...(data.errors ?? [])].filter(Boolean).join(" "));
      } else {
        setResult(data);
        setText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
      <section className="space-y-2">
        <h2 className="font-semibold">1. Find profiles (script)</h2>
        <p className="text-sm text-muted-foreground">
          Runs a public web search for LinkedIn profile URLs matching a role and location. It never logs in to
          LinkedIn. It returns names and headlines only, so treat the results as leads.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`python scripts/linkedin_xray.py --title "Data Engineer" --location "Cairo" --skills Python SQL --limit 30 --out leads.json`}
        </pre>
        <p className="text-xs text-muted-foreground">Then upload leads.json below.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. Capture full profiles (bookmarklet)</h2>
        <p className="text-sm text-muted-foreground">
          Drag this to your bookmarks bar. On a LinkedIn profile you have open, click it: the profile is copied
          to your clipboard. Paste it below. One click per profile; nothing is sent anywhere automatically.
        </p>
        <div className="flex items-center gap-3">
          <a
            ref={linkRef}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-block rounded border bg-background px-3 py-1.5 text-sm font-medium"
          >
            Capture LinkedIn profile
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard?.writeText("javascript:(" + bookmarkletSource + ")()")}
          >
            Copy code instead
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">3. Import</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste profile JSON here (one or many)"
          className="w-full rounded border bg-background p-2 font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <input type="file" accept=".json,application/json" onChange={onFile} className="text-sm" />
          <Button onClick={submit} disabled={busy || !text.trim()}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <p className="text-sm">
            Imported {result.imported} ({result.newPeople} new).{" "}
            <a className="underline" href={`/?run=${result.searchRunId}`}>
              View results
            </a>
            {result.errors.length > 0 && <span className="text-muted-foreground"> Skipped: {result.errors.join(" ")}</span>}
          </p>
        )}
      </section>
    </div>
  );
}
