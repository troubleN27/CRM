"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fieldErrors, withValues, type FormState } from "@/lib/forms";
import { canManageRequests, canSetStatus, isRequestStatus, statusAfterAssign } from "@/lib/requests";
import { requestSchema } from "@/lib/validation";

async function activeEmployeeExists(id: string) {
  return Boolean(await db.employee.findFirst({ where: { id, isActive: true } }));
}

export async function createRequest(locale: string, prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session || !canManageRequests(session.user.role)) {
    return withValues({ errors: { form: "forbidden" } }, prev, formData);
  }

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return withValues({ errors: fieldErrors(parsed.error) }, prev, formData);
  const { clientId, description, assigneeId, dueDate } = parsed.data;

  if (!(await db.client.findUnique({ where: { id: clientId } }))) {
    return withValues({ errors: { clientId: "notFound" } }, prev, formData);
  }
  if (assigneeId && !(await activeEmployeeExists(assigneeId))) {
    return withValues({ errors: { assigneeId: "notFound" } }, prev, formData);
  }

  const request = await db.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        clientId,
        description,
        assigneeId,
        status: assigneeId ? "ASSIGNED" : "NEW",
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null,
      },
    });
    await audit(tx, session.user.id, "Request", created.id, "CREATE", undefined, { clientId, description, assigneeId, dueDate });
    return created;
  });

  revalidatePath(`/${locale}/requests`, "layout");
  redirect({ href: `/requests/${request.id}`, locale });
  return {};
}

// Назначить исполнителя (или снять, если выбрано «не назначен»).
export async function assignRequest(locale: string, id: string, formData: FormData) {
  const session = await auth();
  if (!session || !canManageRequests(session.user.role)) return;

  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  if (assigneeId && !(await activeEmployeeExists(assigneeId))) return;

  const current = await db.request.findUnique({ where: { id } });
  if (!current) return;
  const status = statusAfterAssign(current.status, Boolean(assigneeId));

  await db.$transaction(async (tx) => {
    await tx.request.update({ where: { id }, data: { assigneeId, status } });
    await audit(
      tx,
      session.user.id,
      "Request",
      id,
      "UPDATE",
      { assigneeId: current.assigneeId, status: current.status },
      { assigneeId, status },
    );
  });
  revalidatePath(`/${locale}/requests`, "layout");
}

export async function setRequestStatus(locale: string, id: string, formData: FormData) {
  const session = await auth();
  if (!session) return;

  const next = formData.get("status");
  if (!isRequestStatus(next)) return;

  const current = await db.request.findUnique({ where: { id } });
  if (!current || current.status === next) return;
  if (!canSetStatus(session.user, current.assigneeId, next)) return;

  await db.$transaction(async (tx) => {
    await tx.request.update({ where: { id }, data: { status: next } });
    await audit(tx, session.user.id, "Request", id, "UPDATE", { status: current.status }, { status: next });
  });
  revalidatePath(`/${locale}/requests`, "layout");
}
