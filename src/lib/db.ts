import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter — there is no implicit
// DATABASE_URL read and no `datasourceUrl` option any more.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Lazy: `next build` imports route modules to collect page data, and that must
// not require a live DATABASE_URL.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    globalForPrisma.prisma ??= create();
    return Reflect.get(globalForPrisma.prisma, prop, globalForPrisma.prisma);
  },
});
