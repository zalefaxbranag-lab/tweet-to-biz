import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const neonUrl = process.env.DATABASE_URL;
  if (neonUrl && neonUrl.startsWith("postgresql")) {
    const { Pool } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const pool = new Pool({ connectionString: neonUrl });
    const adapter = new PrismaNeon(pool);
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
