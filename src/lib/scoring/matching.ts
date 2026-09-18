/**
 * Exact-token skill/term matching, replacing the old scorer's
 * `skills.some(s => s.includes(skill))`.
 *
 * That substring check had two failure modes, both fixed here:
 * - `"Java"` matched `"JavaScript"` (and vice versa) because "java" is a
 *   substring of "javascript".
 * - A one-letter skill like `"R"` matched almost any text containing the
 *   letter r (e.g. "Marketing", "Senior").
 *
 * The fix is to compare whole, canonicalized tokens/phrases rather than
 * substrings. `"Node.js"`, `"NodeJS"`, `"node.js"`, and `"node"` all
 * canonicalize to the same string via `ALIASES` below, so they match each
 * other; `"Java"` and `"JavaScript"` canonicalize to different strings
 * (`"java"` vs `"javascript"`) and never collide.
 */

/**
 * Deliberately partial alias table (like `KNOWN_LANGUAGES` in
 * `src/lib/sources/github.ts`) mapping common spellings/variants of a skill
 * to one canonical form. An unrecognised term simply falls back to its own
 * normalized spelling (see `canonicalizeTerm`), which still matches itself
 * exactly — it just won't be linked to variant spellings nobody added here.
 * Extend this table as real search data surfaces more false negatives.
 */
const ALIASES: Record<string, string> = {
  node: "node",
  "node.js": "node",
  "node js": "node",
  nodejs: "node",

  js: "javascript",
  javascript: "javascript",

  ts: "typescript",
  typescript: "typescript",

  "c++": "cpp",
  cpp: "cpp",

  "c#": "csharp",
  "c sharp": "csharp",
  csharp: "csharp",

  golang: "go",
  go: "go",

  py: "python",
  python: "python",
  "python3": "python",

  postgres: "postgresql",
  postgresql: "postgresql",
  psql: "postgresql",
  "postgres sql": "postgresql",

  k8s: "kubernetes",
  kubernetes: "kubernetes",

  reactjs: "react",
  "react.js": "react",
  "react js": "react",
  react: "react",

  vuejs: "vue",
  "vue.js": "vue",
  "vue js": "vue",
  vue: "vue",

  angularjs: "angular",
  angular: "angular",

  aws: "aws",
  "amazon web services": "aws",

  gcp: "gcp",
  "google cloud": "gcp",
  "google cloud platform": "gcp",

  azure: "azure",
  "microsoft azure": "azure",

  ml: "machine learning",
  "machine learning": "machine learning",

  ai: "artificial intelligence",
  "artificial intelligence": "artificial intelligence",

  dl: "deep learning",
  "deep learning": "deep learning",

  mongo: "mongodb",
  mongodb: "mongodb",

  "next.js": "nextjs",
  "next js": "nextjs",
  nextjs: "nextjs",
  next: "nextjs",

  dotnet: "dotnet",
  ".net": "dotnet",

  ci_cd: "cicd",
  "ci/cd": "cicd",
  cicd: "cicd",

  rest: "rest",
  restful: "rest",
  "rest api": "rest",

  graphql: "graphql",

  sql: "sql",
};

/** Lowercases and trims; the shared first step before alias lookup or
 * stripping. Never throws on a non-string (returns ""). */
function baseNormalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Resolves a raw skill/term string to its canonical comparable form.
 *
 * 1. Try the exact lowercased/trimmed string against `ALIASES` (this is
 *    what lets punctuation-bearing variants like `"c++"`/`"c#"`/`"node.js"`
 *    resolve directly, before any punctuation gets stripped).
 * 2. Otherwise, strip everything but letters/digits/spaces, collapse
 *    whitespace, and try that against `ALIASES` too (catches
 *    `"Node JS"` -> `"node js"` -> alias hit).
 * 3. If neither matches an alias, the stripped, space-collapsed form is
 *    returned as-is — an unrecognised term still matches itself exactly.
 *
 * Never throws: non-string input normalizes to `""`.
 */
export function canonicalizeTerm(raw: unknown): string {
  const normalized = baseNormalize(raw);
  if (!normalized) return "";
  if (ALIASES[normalized]) return ALIASES[normalized];

  const stripped = normalized
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (ALIASES[stripped]) return ALIASES[stripped];
  return stripped;
}

/**
 * Extracts word-ish tokens from free text, preserving internal `.`/`+`/`#`
 * so tokens like `node.js`, `c++`, and `c#` survive as single tokens
 * (rather than being split into meaningless fragments) and can still hit an
 * alias directly. Never throws on non-string input (returns `[]`).
 */
export function tokenize(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const matches = text.toLowerCase().match(/[a-z0-9]+(?:[.+#][a-z0-9]*)*/g);
  return matches ?? [];
}

export interface TermMatch {
  matched: boolean;
  /** Which haystack fields the term was found in, e.g. ["skills"],
   * ["headline", "summary"]. Empty when `matched` is false. */
  where: string[];
}

/**
 * Checks whether `term` (a single skill/title/keyword, possibly
 * multi-word) appears as an exact canonical token/phrase in `skills`
 * (each entry compared as a whole phrase) or in any of `textFields`
 * (searched via sliding word n-grams sized to `term`'s word count, so
 * multi-word terms like "machine learning" can match free text too).
 *
 * This is the single shared primitive behind skill, title, and exclusion
 * matching — see `src/lib/scoring/rules/skills.ts`,
 * `rules/titles.ts`, and `rules/exclusions.ts`.
 */
export function matchesTerm(
  term: string,
  haystacks: { skills?: readonly string[]; textFields?: Record<string, string | null | undefined> },
): TermMatch {
  const canonicalTerm = canonicalizeTerm(term);
  if (!canonicalTerm) return { matched: false, where: [] };

  const where: string[] = [];

  for (const skill of haystacks.skills ?? []) {
    if (canonicalizeTerm(skill) === canonicalTerm) {
      where.push("skills");
      break;
    }
  }

  const wordCount = Math.max(1, term.trim().split(/\s+/).filter(Boolean).length);

  for (const [fieldName, fieldValue] of Object.entries(haystacks.textFields ?? {})) {
    const tokens = tokenize(fieldValue);
    if (tokens.length === 0) continue;
    for (let i = 0; i + wordCount <= tokens.length; i++) {
      const ngram = tokens.slice(i, i + wordCount).join(" ");
      if (canonicalizeTerm(ngram) === canonicalTerm) {
        where.push(fieldName);
        break;
      }
    }
  }

  return { matched: where.length > 0, where };
}
