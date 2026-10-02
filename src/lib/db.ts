import "server-only";
import { DatabaseSync } from "node:sqlite";
import { accessSync, constants, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// One handle per process, kept on globalThis so dev reloads do not reopen it.
const g = globalThis as unknown as { __tapeDb?: DatabaseSync; __tapeDbPath?: string; __tapeDbEphemeral?: boolean };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS coins (
  token TEXT PRIMARY KEY,
  symbol TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  logo TEXT,
  graduated INTEGER NOT NULL DEFAULT 0,
  launched_at INTEGER,
  quote_symbol TEXT,
  market_cap REAL,
  latest_buy_at INTEGER,
  tracked INTEGER NOT NULL DEFAULT 0,
  twitter TEXT,
  website TEXT,
  telegram TEXT,
  links_checked_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  token TEXT NOT NULL,
  at INTEGER NOT NULL,
  market_cap REAL,
  fees REAL,
  PRIMARY KEY (token, at)
);
CREATE INDEX IF NOT EXISTS snapshots_at ON snapshots(at);
CREATE TABLE IF NOT EXISTS runs (
  at INTEGER PRIMARY KEY,
  finished_at INTEGER,
  eth_usd REAL,
  btc_usd REAL,
  catalog INTEGER,
  tracked INTEGER,
  measured INTEGER,
  failed INTEGER,
  error TEXT
);
`;

function writable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * TAPE_DATA_DIR when set, else ./data when it can be written, else the OS temp
 * folder (read-only hosts such as serverless: snapshots then live only as long
 * as the instance, which the about page says).
 */
function resolveDir(): { dir: string; ephemeral: boolean } {
  const configured = process.env.TAPE_DATA_DIR;
  if (configured && writable(/* turbopackIgnore: true */ configured)) return { dir: configured, ephemeral: false };
  const local = join(process.cwd(), "data");
  if (writable(local)) return { dir: local, ephemeral: false };
  const temp = join(tmpdir(), "tape");
  mkdirSync(temp, { recursive: true });
  console.warn(`[tape] ${local} is not writable; snapshots go to ${temp} and do not survive a restart.`);
  return { dir: temp, ephemeral: true };
}

export function db(): DatabaseSync {
  if (g.__tapeDb) return g.__tapeDb;
  const { dir, ephemeral } = resolveDir();
  const path = join(dir, "tape.db");
  const handle = new DatabaseSync(path);
  handle.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  handle.exec(SCHEMA);
  g.__tapeDb = handle;
  g.__tapeDbPath = path;
  g.__tapeDbEphemeral = ephemeral;
  return handle;
}

export function storageIsEphemeral(): boolean {
  db();
  return g.__tapeDbEphemeral === true;
}
