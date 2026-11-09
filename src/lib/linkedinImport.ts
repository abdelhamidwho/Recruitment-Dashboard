import type { Candidate } from "@/lib/apify";

/**
 * Turns profiles captured outside the app (the browser bookmarklet, or the
 * `scripts/linkedin_xray.py` search script) into `Candidate`s for the same
 * normalise -> score -> store pipeline every other source uses. Nothing here
 * talks to LinkedIn: the data arrives already captured by the user.
 */

export const LINKEDIN_SOURCE_ID = "linkedin";
const MAX_PROFILES_PER_IMPORT = 200;

/** Canonical https://www.linkedin.com/in/<slug> or null if not a profile URL. */
export function canonicalLinkedInUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep the raw slug */
  }
  return `https://www.linkedin.com/in/${slug.toLowerCase()}`;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : [];

function objList<T>(v: unknown, map: (o: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map(map)
    .filter((x): x is T => x !== null);
}

/** Splits "Title at Company" / "Title @ Company" headlines. */
export function splitHeadline(headline?: string): { title?: string; company?: string } {
  if (!headline) return {};
  const m = headline.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (m) return { title: m[1].trim(), company: m[2].split(/\s+[|·]\s+/)[0].trim() };
  // The X-ray script joins title and company with " - " ("Data Engineer - Acme").
  const dash = headline.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dash) return { title: dash[1].trim(), company: dash[2].split(/\s+[|·]\s+/)[0].trim() };
  return { title: headline.split(/\s+[|·]\s+/)[0].trim() };
}

export function toCandidate(input: unknown): Candidate | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const profileUrl = canonicalLinkedInUrl(o.profileUrl ?? o.url ?? o.linkedinUrl);
  const fullName = str(o.fullName ?? o.name);
  if (!profileUrl || !fullName) return null;

  const headline = str(o.headline);
  const fromHeadline = splitHeadline(headline);
  const experience = objList(o.experience, (e) => {
    const title = str(e.title);
    const company = str(e.company);
    if (!title && !company) return null;
    return {
      title: title ?? "",
      company: company ?? "",
      from: str(e.from),
      to: str(e.to),
      durationMonths: typeof e.durationMonths === "number" ? e.durationMonths : undefined,
    };
  });
  const education = objList(o.education, (e) => {
    const school = str(e.school);
    if (!school) return null;
    return { school, degree: str(e.degree), field: str(e.field), year: str(e.year) };
  });

  return {
    externalId: profileUrl.split("/in/")[1],
    fullName,
    headline,
    currentTitle: str(o.currentTitle) ?? experience[0]?.title ?? fromHeadline.title,
    // Search-result headlines are truncated and list skills after "|", so a company guessed from them is noise.
    currentCompany:
      str(o.currentCompany) ??
      experience[0]?.company ??
      (o.capturedBy === "xray-search" ? undefined : fromHeadline.company),
    location: str(o.location),
    profileUrl,
    avatarUrl: str(o.avatarUrl),
    summary: str(o.summary ?? o.about),
    industry: str(o.industry),
    skills: strList(o.skills),
    experience,
    education,
    languages: strList(o.languages),
    certifications: strList(o.certifications),
    raw: { importedFrom: str(o.capturedBy) ?? "manual", capturedAt: str(o.capturedAt), snippet: str(o.snippet) },
  };
}

/** Accepts one profile object or an array; returns usable candidates + per-item errors. */
export function parseLinkedInImport(payload: unknown): { candidates: Candidate[]; errors: string[] } {
  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length > MAX_PROFILES_PER_IMPORT) {
    return { candidates: [], errors: [`Too many profiles in one import (max ${MAX_PROFILES_PER_IMPORT}).`] };
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  items.forEach((item, i) => {
    const c = toCandidate(item);
    if (!c) {
      errors.push(`Item ${i + 1}: needs a linkedin.com/in/... URL and a name.`);
    } else if (!seen.has(c.profileUrl)) {
      seen.add(c.profileUrl);
      candidates.push(c);
    }
  });
  return { candidates, errors };
}
