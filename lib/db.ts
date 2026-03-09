import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

async function createAdapter() {
  const neonUrl = process.env.DATABASE_URL;
  if (neonUrl && neonUrl.startsWith("postgresql")) {
    const { neon } = await import("@neondatabase/serverless");
    const { PrismaNeon } = await import("@prisma/adapter-neon");
    const sql = neon(neonUrl);
    return new PrismaNeon(sql);
  }

  // Fallback to libsql for local dev
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || `file:${process.cwd()}/dev.db`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return authToken
    ? new PrismaLibSql({ url, authToken })
    : new PrismaLibSql({ url });
}

// Synchronous init with lazy adapter connection
function createPrismaClient() {
  // For Neon/Postgres in production
  const neonUrl = process.env.DATABASE_URL;
  if (neonUrl && neonUrl.startsWith("postgresql")) {
    // Dynamic import workaround: use require-style for sync init
    const { neon } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const sql = neon(neonUrl);
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({ adapter });
  }

  // Fallback to libsql for local dev
  const { PrismaLibSql } = require("@prisma/adapter-libsql");
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || `file:${process.cwd()}/dev.db`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const adapter = authToken
    ? new PrismaLibSql({ url, authToken })
    : new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
