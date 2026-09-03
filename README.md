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
| `SESSION_COOKIE_SECURE` | Controls the `Secure` flag on the session cookie. Defaults to secure (any value other than the literal string `false` counts as secure) because that is the safe choice for an HTTPS deployment. If this shared server is plain HTTP rather than TLS, set this to `false` — otherwise browsers silently refuse to store or send the cookie and login will appear to succeed while no session persists. Setting it to `false` sends the session token in cleartext on the LAN, so prefer adding TLS to the server instead if at all possible. |

### Maintenance scripts

- `npm run db:backfill` — re-runs the normalisation pipeline (location, industry,
  education, language, experience parsing) over every existing `Person` row and
  writes the results back. Use this after changing normalisation logic, so
  previously-scraped candidates pick up the new rules without having to be
  re-scraped.
- `npm run seed:admin` — see above; safe to re-run, it only acts when no admin
  exists yet.

### Backing up the database

The database is a single SQLite file in WAL mode. To back it up reliably, stop
the app first, then copy the database file (and its `-wal`/`-shm` sidecar files,
if present) elsewhere. Copying the file while the app is running risks an
inconsistent snapshot even in WAL mode, since a checkpoint could be in
progress.
