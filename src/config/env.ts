import { existsSync } from "node:fs";
import path from "node:path";

let loaded = false;

/**
 * Loads `<cwd>/.env` into `process.env` once per process.
 *
 * Uses Node's built-in `process.loadEnvFile` (Node >= 20.12), so no `dotenv`
 * dependency is required. Variables already present in the real environment
 * win: `loadEnvFile` does not overwrite them.
 *
 * A missing `.env` is not an error - the app falls back to the defaults in
 * `neo4j_config.ts` (and can be configured purely through real env vars).
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.warn(`Could not load ${envPath}:`, error);
  }
}