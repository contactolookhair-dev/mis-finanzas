import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "./auth-prisma-client";

const globalForPrisma = globalThis as unknown as {
  authPrisma?: PrismaClient;
};

// Vercel bundles App Router routes; Prisma sometimes cannot auto-locate the engine.
// Point Prisma at an engine we ship alongside the generated auth client (or node_modules/.prisma).
function ensureAuthPrismaEngine() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;

  const filenames: string[] = [];
  if (process.platform === "linux") {
    filenames.push("libquery_engine-rhel-openssl-3.0.x.so.node");
  } else if (process.platform === "darwin") {
    if (process.arch === "arm64") filenames.push("libquery_engine-darwin-arm64.dylib.node");
    filenames.push("libquery_engine-darwin-x64.dylib.node");
  }

  const baseDirs = [
    path.join(process.cwd(), "src/server/db/auth-prisma-client"),
    path.join(process.cwd(), "node_modules/.prisma/client")
  ];

  try {
    for (const filename of filenames) {
      for (const baseDir of baseDirs) {
        const candidate = path.join(baseDir, filename);
        if (fs.existsSync(candidate)) {
          process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
          return;
        }
      }
    }
  } catch {
    // noop
  }
}

ensureAuthPrismaEngine();

export const authPrisma = globalForPrisma.authPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.authPrisma = authPrisma;
}
