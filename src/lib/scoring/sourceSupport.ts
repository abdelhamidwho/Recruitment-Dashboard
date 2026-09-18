import { getSource } from "@/lib/sources";
import type { UnsupportedField } from "@/lib/sources/types";

/**
 * Resolves which `Candidate` fields a source can never populate, so rules
 * can skip a dimension entirely rather than penalize a candidate for a gap
 * that has nothing to do with them — e.g. a GitHub candidate has no
 * `education` because GitHub genuinely has none for anyone, not because
 * this particular person left it blank.
 *
 * Returns an empty set (i.e. "assume full support") for:
 * - `undefined`/blank `sourceId` (caller didn't know/pass a source),
 * - `"apify"`, which is not in the source registry (it owns its own
 *   run/poll lifecycle — see `src/lib/sources/index.ts`) but can genuinely
 *   supply every field,
 * - any other id the registry doesn't recognise, so an unregistered or
 *   future source fails open (scored normally) rather than throwing.
 *
 * Never throws.
 */
export function unsupportedFieldsFor(sourceId?: string | null): Set<UnsupportedField> {
  if (!sourceId) return new Set();
  try {
    return new Set(getSource(sourceId).unsupportedFields);
  } catch {
    return new Set();
  }
}

/** True when every field in `fields` is one the source cannot supply at
 * all — used to gate an entire soft-scoring dimension off rather than
 * scoring it against data that will always be absent. */
export function allUnsupported(unsupported: Set<UnsupportedField>, fields: UnsupportedField[]): boolean {
  return fields.length > 0 && fields.every((f) => unsupported.has(f));
}
