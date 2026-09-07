This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Running on the shared server

This app is meant to run as a single instance on one shared company server (e.g.
an internal LAN box), backed by a local SQLite file. There is no multi-instance
or multi-region deployment story here — one process, one database file.

1. `npm ci && npx prisma migrate deploy && npx prisma generate`
2. Set the environment variables below in `.env` (not committed — copy them into
   place on the server, they are never checked into git)
3. `npm run seed:admin` — creates the first admin account from
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; that account is forced to change
   its password on first sign-in. Running it again after an admin already
   exists is a no-op.
4. `npm run build && npm start`
5. Sign in as the seeded admin, open **Users**, and add an account for each HR
   person. Every account created there gets a temporary password shown once at
   creation, and is forced to change it on first login. Passwords are
   scrypt-hashed; sessions live in the `Session` table and can be revoked by
   disabling the user (or by deleting their session rows directly).

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite connection string, e.g. `file:./prod.db`. The database runs in WAL mode for safe concurrent reads/writes from multiple HR users hitting the same file. |
| `SEED_ADMIN_EMAIL` | Email for the first admin account created by `npm run seed:admin`. |
| `SEED_ADMIN_PASSWORD` | Bootstrap password for that first admin. Change it (or let the forced password-change flow change it) immediately after first login — do not leave the bootstrap value in place. |
| `SEED_ADMIN_NAME` | Optional display name for the seeded admin (defaults to "Administrator"). |
| `APIFY_MOCK` | When `true`, all scraping runs against local mock data (`src/data/mockCandidates.json`) instead of calling Apify — this is the default for development and for any environment without real Apify credentials. Set to `false` and supply `APIFY_TOKEN` / `APIFY_ACTOR_ID` to scrape LinkedIn for real. |
| `APIFY_TOKEN` | Apify API token, required when `APIFY_MOCK=false`. Get one from https://console.apify.com/account/integrations. |
| `APIFY_ACTOR_ID` | The Apify actor to run, required when `APIFY_MOCK=false`. No actor is chosen yet in this codebase — `src/lib/apify.ts`'s `buildActorInput()`/`mapToCandidate()` are a provisional, unverified mapping for a generic LinkedIn scraper actor. Run `npm run apify:probe` against the actor you choose to see its real input schema and dataset shape before wiring it up for real. |
| `APIFY_ACTOR_INPUT_VERIFIED` | Must be set to `true` before a live (non-mock) Apify run is allowed. This is a deliberate safety gate: `buildActorInput()` is a guess, not a confirmed mapping, and a malformed request to a real actor still gets billed. Set this only after checking `buildActorInput()`/`mapToCandidate()` against `npm run apify:probe` output for your chosen actor. |
| `SESSION_COOKIE_SECURE` | Controls the `Secure` flag on the session cookie. Defaults to secure (any value other than the literal string `false` counts as secure) because that is the safe choice for an HTTPS deployment. If this shared server is plain HTTP rather than TLS, set this to `false` — otherwise browsers silently refuse to store or send the cookie and login will appear to succeed while no session persists. Setting it to `false` sends the session token in cleartext on the LAN, so prefer adding TLS to the server instead if at all possible. |
| `GITHUB_TOKEN` | Optional. A GitHub personal access token used only to raise the GitHub candidate source's rate limit (unauthenticated: 10 requests/min on search, 60/hour on the per-user lookups that enrich each hit; with a token: 30/min search, 5000/hour core, per GitHub's documented limits). The GitHub source works with no token at all, just at the lower limit. Never required. |

## Candidate sources

The search screen lets you choose which source a search runs against, via the
**Source** control above the search button (defaults to **GitHub**):

- **GitHub** (`src/lib/sources/github.ts`) queries the public GitHub REST API
  (`GET /search/users`, then one `GET /users/{login}` per hit to enrich it) —
  no credentials required, works out of the box. It executes **synchronously**:
  results come back and are stored within the same `POST /api/search` request,
  so the very first poll to `GET /api/search/[searchRunId]` already returns
  `SUCCEEDED` with candidates.
  - **Can provide:** name, avatar, bio (used as headline/summary), company,
    location, profile URL.
  - **Cannot provide** (and never guesses at): current job title, industry,
    skills list, employment history, education, spoken languages,
    certifications, or years of experience — GitHub has none of this data.
    Scoring treats a missing years-of-experience figure as neutral (neither a
    bonus nor a penalty) rather than as zero.
  - **Filters it cannot act on:** years of experience (min/max), work mode,
    company size, industry, education, spoken languages, certifications, and
    target/excluded companies. When one of these is set, the search screen
    shows a note (e.g. *"GitHub can't filter on work mode — this will be
    ignored for this search."*) naming exactly which filters will be ignored,
    rather than silently dropping them.
  - Only the first location filter is used (GitHub's query qualifiers AND
    together, so multiple `location:` terms would require a single user to
    match all of them at once — not what "any of these locations" means).
- **LinkedIn (Apify)** (`src/lib/apify.ts`) is the pre-existing scraper
  integration — see "Wiring up a real Apify actor" below. It executes
  **asynchronously**: `POST /api/search` starts an Apify run and the client
  polls `GET /api/search/[searchRunId]` until it reports `SUCCEEDED`, at which
  point the dataset is fetched and stored. With `APIFY_MOCK=true` (the
  development default) it returns the two mock profiles in
  `src/data/mockCandidates.json` without calling Apify at all.

Every candidate, regardless of source, is upserted onto a `Person` row keyed on
`profileUrl` (see `src/lib/profileStorage.ts`, shared by both source paths so
dedup behaves identically no matter which source produced the row) and tagged
with `Person.source` / `SearchRun.source`. The results table shows each row's
source and flags a person as "Known before" when they already existed from an
earlier search — including one from a different source.

### Maintenance scripts

- `npm run db:backfill` — re-runs the normalisation pipeline (location, industry,
  education, language, experience parsing) over every existing `Person` row and
  writes the results back. Use this after changing normalisation logic, so
  previously-scraped candidates pick up the new rules without having to be
  re-scraped.
- `npm run seed:admin` — see above; safe to re-run, it only acts when no admin
  exists yet.
- `npm run apify:probe` — standalone script that validates `APIFY_TOKEN` against
  the Apify API and, if `APIFY_ACTOR_ID` is also set, prints that actor's input
  schema (field names, types, which are required) and the union of top-level
  field names (with an example value each) seen in a sample of its most recent
  successful run's dataset. Run this first when mapping a newly-chosen actor —
  its output is what `buildActorInput()` and `mapToCandidate()` in
  `src/lib/apify.ts` need to be updated to match. Never prints the token and
  never writes to any tracked file.

### Wiring up a real Apify actor

The scraper integration (`src/lib/apify.ts`) is actor-agnostic hardening only —
no actor has been chosen yet, and `buildActorInput()` is a guessed, provisional
mapping for a generic LinkedIn scraper actor. To use a real actor:

1. Choose the actor and set `APIFY_TOKEN` / `APIFY_ACTOR_ID` in `.env`.
2. Run `npm run apify:probe` to see that actor's real input schema and dataset
   shape.
3. Update `buildActorInput()` (input field names) and `mapToCandidate()`
   (dataset → `Candidate` field mapping) in `src/lib/apify.ts` to match.
4. Set `APIFY_ACTOR_INPUT_VERIFIED=true` in `.env`. Until this is set, starting
   a live (non-mock) run fails fast with an explanatory error instead of
   silently sending an unverified, possibly-billed request.
5. Set `APIFY_MOCK=false`.

A `SearchRun` stuck at `RUNNING`/`READY` for more than 15 minutes is
automatically recorded as `TIMED-OUT` (with `failureReason` set) the next time
its status is polled, rather than being polled forever; the search UI also
gives up after roughly the same amount of time and lets you cancel a search
that is taking too long.

### Backing up the database

The database is a single SQLite file in WAL mode. To back it up reliably, stop
the app first, then copy the database file (and its `-wal`/`-shm` sidecar files,
if present) elsewhere. Copying the file while the app is running risks an
inconsistent snapshot even in WAL mode, since a checkpoint could be in
progress.
