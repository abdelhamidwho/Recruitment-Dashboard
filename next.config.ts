import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";

// In development the project's .env is the source of truth. Without this, a
// stale variable of the same name in the parent shell/app (e.g. an old
// APIFY_TOKEN) silently wins over .env. Production hosts keep using the
// real environment.
if (process.env.NODE_ENV !== "production") {
  loadEnv({ override: true, quiet: true });
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
