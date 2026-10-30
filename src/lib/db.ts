import { PrismaClient } from "@prisma/client";

// Один клиент на всё приложение (в dev Next перезагружает модули).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
