import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DBShape } from "@/lib/types";

// Vercel serverless filesystem is read-only except for the runtime temp directory.
// Use a writable location there so JSON-backed storage can still function.
const baseDataDir =
  process.env.VERCEL === "1" ? path.join(os.tmpdir(), "gateqr-data") : path.join(process.cwd(), "data");
const dataDir = baseDataDir;
const dbPath = path.join(dataDir, "db.json");

const defaultDB: DBShape = {
  events: [],
  attendees: [],
  scanLogs: [],
};

let writeQueue: Promise<void> = Promise.resolve();

export async function readDB(): Promise<DBShape> {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as DBShape;
  } catch {
    await writeFile(dbPath, JSON.stringify(defaultDB, null, 2), "utf8");
    return defaultDB;
  }
}

export async function writeDB(db: DBShape): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  writeQueue = writeQueue.then(() =>
    writeFile(dbPath, JSON.stringify(db, null, 2), "utf8"),
  );

  await writeQueue;
}

export async function withDB<T>(handler: (db: DBShape) => Promise<T>): Promise<T> {
  const db = await readDB();
  const result = await handler(db);
  await writeDB(db);
  return result;
}
