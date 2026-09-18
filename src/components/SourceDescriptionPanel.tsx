"use client";

import * as React from "react";
import { SourceDescription } from "@/lib/sources/types";
import { UnavailableSource } from "@/lib/sources/staticSourceInfo";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Explains, for a non-technical HR user, what the currently-selected
 * candidate source actually searches before they run it — the gap called
 * out directly by the dashboard's owner ("if I will use a scraper from
 * GitHub, I want to know what is this scraper search for?"). The essentials
 * (what it searches, whether it's ready, whether it costs money) are always
 * visible; the rest (exact fields returned/missing, setup, caveats) sits
 * behind a "Details" popover so this doesn't compete for space with the
 * unsupported-filter and rank-only notes that already live in this panel.
 */
export function SourceDescriptionPanel({
  sourceLabel,
  description,
}: {
  sourceLabel: string;
  description: SourceDescription;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
      <p className="text-xs text-foreground">{description.searches}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={description.readyNow ? "secondary" : "outline"}>
          {description.readyNow ? "Ready to use" : "Not set up yet"}
        </Badge>
        <span className="text-xs text-muted-foreground">{description.cost}</span>
        <Popover>
          <PopoverTrigger className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            What exactly does {sourceLabel} return?
          </PopoverTrigger>
          <PopoverContent className="w-80 text-xs space-y-2.5">
            <PopoverHeader>
              <PopoverTitle>{sourceLabel} — what to expect</PopoverTitle>
            </PopoverHeader>
            <div>
              <p className="font-medium text-foreground">Reliably returns</p>
              <p className="text-muted-foreground">{description.reliablyReturns.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Cannot provide</p>
              <p className="text-muted-foreground">{description.cannotProvide.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Setup &amp; limits</p>
              <p className="text-muted-foreground">{description.setupAndLimits}</p>
            </div>
            {description.notes && description.notes.length > 0 && (
              <div>
                <p className="font-medium text-foreground">Also worth knowing</p>
                <p className="text-muted-foreground">{description.notes.join(" ")}</p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/**
 * Small, visually distinct list of sources the user can't select — Indeed
 * and Glassdoor — each with a one-line reason. Rendered as plain text, not
 * buttons, so nobody mistakes them for a disabled/clickable option.
 */
export function UnavailableSourcesNote({ sources }: { sources: UnavailableSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="space-y-1 rounded-md border border-dashed px-2.5 py-2">
      {sources.map((s) => (
        <p key={s.id} className="text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground/80">{s.label}</span>
          {" — not available. "}
          {s.reason}
        </p>
      ))}
    </div>
  );
}
