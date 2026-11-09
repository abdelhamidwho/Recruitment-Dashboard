"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A folded filter-rail group: a header button that toggles visibility of
 * its children. Starts open or closed per `defaultOpen` — the redesign's
 * rail keeps only the essential groups (role/skills, location) open by
 * default so ten-plus filter dimensions don't produce a wall of controls.
 */
export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-3 text-left text-base font-semibold hover:text-foreground/80"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <ChevronDown className={cn("h-6 w-6 shrink-0 text-[var(--brand)] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-4 space-y-4">{children}</div>}
    </div>
  );
}
