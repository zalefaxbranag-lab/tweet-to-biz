import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || `file:${process.cwd()}/dev.db`;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const adapter = authToken
    ? new PrismaLibSql({ url, authToken })
    : new PrismaLibSql({ url });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
