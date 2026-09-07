/**
 * Probe a real Apify actor and print exactly what src/lib/apify.ts needs to
 * know to be wired up correctly: the actor's input schema (for
 * buildActorInput) and the field shape of a real dataset item (for
 * mapToCandidate). It intentionally runs standalone, before any of that
 * wiring is trusted, so it can be used to map a newly-chosen actor without
 * risking a live paid run against a guessed input payload.
 *
 * Usage:
 *   npm run apify:probe
 *
 * Reads from .env (via dotenv, same convention as prisma/seed-admin.ts):
 *   APIFY_TOKEN     required — validated against the Apify API
 *   APIFY_ACTOR_ID  optional — if set, its input schema and a dataset
 *                   sample are fetched too
 *
 * Never prints the token. Never writes to any tracked file — output goes
 * to stdout/stderr only.
 */
import "dotenv/config";

const APIFY_API = "https://api.apify.com/v2";

type JsonRecord = Record<string, unknown>;

function truncate(value: unknown, maxLen = 120): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str === undefined) return "undefined";
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}

async function apifyGet(path: string, token: string): Promise<{ ok: boolean; status: number; body: JsonRecord | null; rawText: string }> {
  const res = await fetch(`${APIFY_API}${path}${path.includes("?") ? "&" : "?"}token=${token}`);
  const rawText = await res.text();
  let body: JsonRecord | null = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, rawText };
}

/** Redacts a token out of any string before it could ever reach stdout/stderr. */
function redact(text: string, token: string): string {
  return token ? text.split(token).join("***REDACTED***") : text;
}

async function main() {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID;

  const findings: string[] = [];
  const unknowns: string[] = [];

  if (!token) {
    console.error(
      "APIFY_TOKEN is not set.\n\n" +
        "This script needs a real Apify API token to probe anything. Add it to .env:\n\n" +
        "  APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n\n" +
        "Get one from https://console.apify.com/account/integrations. Nothing was contacted.",
    );
    process.exitCode = 1;
    return;
  }

  // 1. Validate the token and report the authenticated account.
  console.log("Checking APIFY_TOKEN against the Apify API...");
  let accountLabel = "";
  try {
    const me = await apifyGet("/users/me", token);
    if (!me.ok) {
      console.error(
        redact(
          `APIFY_TOKEN was rejected: HTTP ${me.status}. ${me.rawText.slice(0, 300)}\n\n` +
            "Double-check the token in .env against https://console.apify.com/account/integrations.",
          token,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const username = (me.body?.data as JsonRecord | undefined)?.username ?? "(unknown username)";
    const email = (me.body?.data as JsonRecord | undefined)?.email ?? "(no email on account)";
    accountLabel = `${username} <${email}>`;
    console.log(`Token is valid. Authenticated as: ${accountLabel}`);
    findings.push(`Authenticated Apify account: ${accountLabel}`);
  } catch (error) {
    console.error(redact(`Could not reach the Apify API to validate the token: ${String(error)}`, token));
    process.exitCode = 1;
    return;
  }

  if (!actorId) {
    console.log(
      "\nAPIFY_ACTOR_ID is not set, so the actor's input schema and dataset shape can't be probed yet. " +
        "Set APIFY_ACTOR_ID in .env once an actor has been chosen, and re-run this script.",
    );
    unknowns.push("Actor input schema (no APIFY_ACTOR_ID set)");
    unknowns.push("Dataset item shape (no APIFY_ACTOR_ID set)");
    printSummary(findings, unknowns);
    return;
  }

  // 2. Fetch the actor and its input schema.
  console.log(`\nFetching actor ${actorId}...`);
  let latestBuildId: string | undefined;
  try {
    const actor = await apifyGet(`/acts/${encodeURIComponent(actorId)}`, token);
    if (!actor.ok) {
      console.error(
        redact(
          `Could not fetch actor "${actorId}": HTTP ${actor.status}. ${actor.rawText.slice(0, 300)}\n` +
            "Check that APIFY_ACTOR_ID is correct and that this account can access it.",
          token,
        ),
      );
      process.exitCode = 1;
    } else {
      const data = actor.body?.data as JsonRecord | undefined;
      const name = (data?.name as string) ?? actorId;
      console.log(`Found actor: ${name}`);
      findings.push(`Actor: ${name} (${actorId})`);

      latestBuildId = ((data?.taggedBuilds as JsonRecord | undefined)?.latest as JsonRecord | undefined)?.buildId as
        | string
        | undefined;

      if (latestBuildId) {
        const build = await apifyGet(`/actor-builds/${latestBuildId}`, token);
        const inputSchema = (
          (build.body?.data as JsonRecord | undefined)?.actorDefinition as JsonRecord | undefined
        )?.input as JsonRecord | undefined;

        if (inputSchema && typeof inputSchema.properties === "object" && inputSchema.properties) {
          const properties = inputSchema.properties as Record<string, JsonRecord>;
          const required = new Set((inputSchema.required as string[] | undefined) ?? []);
          console.log("\nInput schema fields (this is what buildActorInput() must produce):");
          for (const [field, spec] of Object.entries(properties)) {
            const type = (spec.type as string) ?? "unknown";
            const req = required.has(field) ? "REQUIRED" : "optional";
            const desc = spec.description ? ` — ${truncate(spec.description, 80)}` : "";
            console.log(`  - ${field} (${type}, ${req})${desc}`);
          }
          findings.push(`Input schema: ${Object.keys(properties).length} fields (${required.size} required) — see printed list above`);
        } else {
          console.log("Actor build did not expose a structured input schema (actorDefinition.input was missing or had no properties).");
          unknowns.push("Actor input schema (build response had no actorDefinition.input.properties)");
        }
      } else {
        console.log("Actor has no tagged 'latest' build to read an input schema from.");
        unknowns.push("Actor input schema (no latest build found)");
      }
    }
  } catch (error) {
    console.error(redact(`Error while fetching actor details: ${String(error)}`, token));
    unknowns.push("Actor input schema (request failed)");
  }

  // 3. Sample the most recent successful run's dataset.
  console.log(`\nLooking for the most recent successful run of ${actorId}...`);
  try {
    const runs = await apifyGet(`/acts/${encodeURIComponent(actorId)}/runs?desc=true&limit=25`, token);
    if (!runs.ok) {
      console.error(redact(`Could not list runs: HTTP ${runs.status}. ${runs.rawText.slice(0, 300)}`, token));
      unknowns.push("Dataset item shape (could not list runs)");
    } else {
      const items = ((runs.body?.data as JsonRecord | undefined)?.items as JsonRecord[] | undefined) ?? [];
      const lastSucceeded = items.find((r) => r.status === "SUCCEEDED");
      if (!lastSucceeded) {
        console.log("No previous SUCCEEDED run found for this actor — nothing to sample yet.");
        unknowns.push("Dataset item shape (no successful run yet — run the actor once, then re-run this script)");
      } else {
        const datasetId = lastSucceeded.defaultDatasetId as string;
        console.log(`Sampling dataset ${datasetId} from run ${lastSucceeded.id}...`);
        const sample = await apifyGet(`/datasets/${datasetId}/items?clean=true&limit=5`, token);
        if (!sample.ok) {
          console.error(redact(`Could not fetch dataset items: HTTP ${sample.status}. ${sample.rawText.slice(0, 300)}`, token));
          unknowns.push("Dataset item shape (could not fetch dataset items)");
        } else {
          let sampleItems: JsonRecord[] = [];
          try {
            sampleItems = JSON.parse(sample.rawText);
          } catch {
            sampleItems = [];
          }
          if (sampleItems.length === 0) {
            console.log("Dataset was empty.");
            unknowns.push("Dataset item shape (most recent successful run's dataset was empty)");
          } else {
            const union = new Map<string, unknown>();
            for (const item of sampleItems) {
              for (const [key, value] of Object.entries(item)) {
                if (!union.has(key)) union.set(key, value);
              }
            }
            console.log(
              `\nDataset field names observed across ${sampleItems.length} sample item(s) (this is what mapToCandidate() must read from):`,
            );
            for (const [key, value] of union) {
              console.log(`  - ${key}: ${truncate(value)}`);
            }
            findings.push(`Dataset sample: ${union.size} distinct top-level fields observed — see printed list above`);
          }
        }
      }
    }
  } catch (error) {
    console.error(redact(`Error while sampling the dataset: ${String(error)}`, token));
    unknowns.push("Dataset item shape (request failed)");
  }

  printSummary(findings, unknowns);
}

function printSummary(findings: string[], unknowns: string[]) {
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  if (findings.length > 0) {
    console.log("\nFound:");
    for (const f of findings) console.log(`  - ${f}`);
  }
  if (unknowns.length > 0) {
    console.log("\nStill unknown:");
    for (const u of unknowns) console.log(`  - ${u}`);
  }
  console.log(
    "\nNext step: update buildActorInput() and mapToCandidate() in src/lib/apify.ts to match the fields " +
      "printed above, then set APIFY_ACTOR_INPUT_VERIFIED=true in .env to allow a live run.",
  );
}

main().catch((error) => {
  console.error(`apify-probe crashed unexpectedly: ${String(error)}`);
  process.exitCode = 1;
});
