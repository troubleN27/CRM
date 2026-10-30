"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { canManageRequests, canSetStatus, isRequestStatus, statusAfterAssign } from "@/lib/requests";
import { mustCheckIn } from "@/lib/session";
import { clientSchema } from "@/lib/validation";

// Правка полей «на лету» в выезжающей карточке, перетаскивание в канбане и массовые действия.
// Ответ — { ok } или { error: код } (код переводится в messages/*.json, раздел entity.errors).

type Result = { ok: true } | { ok: false; error: string };

async function actor() {
  const session = await auth();
  if (!session || (await mustCheckIn(session.user))) return null;
  return session.user;
}

const done = (): Result => {
  revalidatePath("/", "layout");
  return { ok: true };
};

const REQUEST_FIELDS = {
  description: z.string().trim().min(1, "required").max(2000),
  dueDate: z.union([z.literal(""), z.iso.date()]),
} as const;

export async function updateRequestField(id: string, field: "description" | "dueDate" | "status" | "assigneeId", value: string): Promise<Result> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  const current = await db.request.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "notFound" };

  if (field === "status") {
    if (!isRequestStatus(value)) return { ok: false, error: "invalid" };
    if (value === current.status) return { ok: true };
    if (!canSetStatus(user, current.assigneeId, value)) return { ok: false, error: current.assigneeId ? "statusForbidden" : "needAssignee" };
    await db.$transaction(async (tx) => {
      await tx.request.update({ where: { id }, data: { status: value } });
      await audit(tx, user.id, "Request", id, "UPDATE", { status: current.status }, { status: value });
    });
    return done();
  }

  if (!canManageRequests(user.role)) return { ok: false, error: "forbidden" };

  if (field === "assigneeId") {
    const assigneeId = value || null;
    if (assigneeId && !(await db.employee.findFirst({ where: { id: assigneeId, isActive: true } }))) return { ok: false, error: "notFound" };
    const status = statusAfterAssign(current.status, Boolean(assigneeId));
    await db.$transaction(async (tx) => {
      await tx.request.update({ where: { id }, data: { assigneeId, status } });
      await audit(tx, user.id, "Request", id, "UPDATE", { assigneeId: current.assigneeId, status: current.status }, { assigneeId, status });
    });
    return done();
  }

  const parsed = REQUEST_FIELDS[field].safeParse(value);
  if (!parsed.success) return { ok: false, error: field === "dueDate" ? "date" : "required" };
  const before = field === "dueDate" ? (current.dueDate?.toISOString().slice(0, 10) ?? "") : current.description;
  await db.$transaction(async (tx) => {
    await tx.request.update({
      where: { id },
      data: field === "dueDate" ? { dueDate: parsed.data ? new Date(`${parsed.data}T00:00:00Z`) : null } : { description: parsed.data },
    });
    await audit(tx, user.id, "Request", id, "UPDATE", { [field]: before }, { [field]: parsed.data });
  });
  return done();
}

const CLIENT_FIELDS = { name: clientSchema.shape.name, phone: clientSchema.shape.phone, address: clientSchema.shape.address } as const;

export async function updateClientField(id: string, field: "name" | "phone" | "address", value: string): Promise<Result> {
  const user = await actor();
  if (!user || !canManageRequests(user.role)) return { ok: false, error: "forbidden" };
  const current = await db.client.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "notFound" };
  const parsed = CLIENT_FIELDS[field].safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  await db.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { [field]: parsed.data } });
    await audit(tx, user.id, "Client", id, "UPDATE", { [field]: current[field] }, { [field]: parsed.data });
  });
  return done();
}

// Массовые действия над выбранными заявками. Каждая проверяется отдельно; что нельзя — пропускается.
export async function bulkUpdateRequests(ids: string[], change: { assigneeId: string } | { status: string }): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  for (const id of ids.slice(0, 200)) {
    const r = "status" in change ? await updateRequestField(id, "status", change.status) : await updateRequestField(id, "assigneeId", change.assigneeId);
    if (r.ok) updated++;
  }
  return { updated, skipped: Math.min(ids.length, 200) - updated };
}
