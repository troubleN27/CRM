"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { PLAN_H, PLAN_W, testPlanSvg } from "@/lib/test-plan";
import { deskSchema, zoneSchema } from "@/lib/validation";

export type ActionResult = { error?: string };

async function requireAdmin() {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session.user : null;
}

function done(): ActionResult {
  revalidatePath("/", "layout");
  return {};
}

// Сохранить место (новое или существующее) и посадить на него сотрудника.
export async function saveDesk(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "forbidden" };
  const parsed = deskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message === "required" ? "required" : "invalid" };
  const { id, employeeId, ...data } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const before = id ? await tx.desk.findUnique({ where: { id }, include: { employee: true } }) : null;
      const desk = id ? await tx.desk.update({ where: { id }, data }) : await tx.desk.create({ data });

      // На месте может сидеть только один сотрудник, у сотрудника — одно место.
      await tx.employee.updateMany({
        where: employeeId ? { deskId: desk.id, id: { not: employeeId } } : { deskId: desk.id },
        data: { deskId: null },
      });
      if (employeeId) await tx.employee.update({ where: { id: employeeId }, data: { deskId: desk.id } });

      await audit(
        tx,
        admin.id,
        "Desk",
        desk.id,
        id ? "UPDATE" : "CREATE",
        before ? { code: before.code, pcNumber: before.pcNumber, x: before.x, y: before.y, employeeId: before.employee?.id ?? null } : undefined,
        { ...data, employeeId },
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      return { error: target.includes("pcNumber") ? "pcTaken" : "codeTaken" };
    }
    throw e;
  }
  return done();
}

export async function deleteDesk(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "forbidden" };
  await db.$transaction(async (tx) => {
    const desk = await tx.desk.delete({ where: { id } });
    await audit(tx, admin.id, "Desk", id, "DELETE", { code: desk.code, pcNumber: desk.pcNumber, x: desk.x, y: desk.y });
  });
  return done();
}

export async function saveZone(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "forbidden" };
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message === "required" ? "required" : "invalid" };
  const { id, ...data } = parsed.data;

  await db.$transaction(async (tx) => {
    const before = id ? await tx.zone.findUnique({ where: { id } }) : null;
    const zone = id ? await tx.zone.update({ where: { id }, data }) : await tx.zone.create({ data });
    await audit(
      tx,
      admin.id,
      "Zone",
      zone.id,
      id ? "UPDATE" : "CREATE",
      before ? { name: before.name, type: before.type, x: before.x, y: before.y, width: before.width, height: before.height } : undefined,
      data,
    );
  });
  return done();
}

export async function deleteZone(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "forbidden" };
  await db.$transaction(async (tx) => {
    const zone = await tx.zone.delete({ where: { id } });
    await audit(tx, admin.id, "Zone", id, "DELETE", { name: zone.name, type: zone.type });
  });
  return done();
}

// Вернуть простую тестовую картинку плана (места и зоны не трогаем).
export async function restoreTestPlan(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "forbidden" };
  await db.$transaction(async (tx) => {
    await tx.officePlan.deleteMany();
    const plan = await tx.officePlan.create({
      data: { mimeType: "image/svg+xml", data: Buffer.from(testPlanSvg()), width: PLAN_W, height: PLAN_H },
    });
    await audit(tx, admin.id, "OfficePlan", plan.id, "CREATE", undefined, { testPlan: true });
  });
  return done();
}
