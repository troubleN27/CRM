"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { fieldErrors, withValues, type FormState } from "@/lib/forms";
import { hashPassword } from "@/lib/password";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validation";


async function requireAdmin() {
  const session = await auth();
  return session?.user.role === "ADMIN" ? session.user : null;
}

// Ошибки уникальности из БД переводим в понятные сообщения.
function uniqueErrors(e: unknown): FormState | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String(e.meta?.target ?? "");
    if (target.includes("login")) return { errors: { login: "loginTaken" } };
    if (target.includes("deskId")) return { errors: { deskId: "deskTaken" } };
  }
  return null;
}

// Снимок для журнала, без хэша пароля.
function snapshot(e: { firstName: string; lastName: string; position: string; deskId: string | null }, login: string, role: string) {
  return { firstName: e.firstName, lastName: e.lastName, position: e.position, deskId: e.deskId, login, role };
}

export async function createEmployee(locale: string, prev: FormState, formData: FormData): Promise<FormState> {
  const state = await createEmployeeInner(locale, formData);
  return withValues(state, prev, formData);
}

export async function updateEmployee(locale: string, id: string, prev: FormState, formData: FormData): Promise<FormState> {
  const state = await updateEmployeeInner(locale, id, formData);
  return withValues(state, prev, formData);
}

async function createEmployeeInner(locale: string, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { errors: { form: "forbidden" } };

  const parsed = createEmployeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { login, role, password, ...profile } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: { ...profile, user: { create: { login, role, passwordHash } } },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          entity: "Employee",
          entityId: employee.id,
          action: "CREATE",
          after: snapshot(employee, login, role),
        },
      });
    });
  } catch (e) {
    const known = uniqueErrors(e);
    if (known) return known;
    throw e;
  }

  revalidatePath(`/${locale}/employees`);
  redirect({ href: "/employees", locale });
  return {};
}

async function updateEmployeeInner(locale: string, id: string, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { errors: { form: "forbidden" } };

  const current = await db.employee.findUnique({ where: { id }, include: { user: true } });
  if (!current?.user) return { errors: { form: "notFound" } };
  // Учётки администраторов через эту форму не меняются.
  if (current.user.role === "ADMIN") return { errors: { form: "forbidden" } };

  const parsed = updateEmployeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { login, role, password, ...profile } = parsed.data;

  try {
    const passwordHash = password ? await hashPassword(password) : undefined;
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: { ...profile, user: { update: { login, role, ...(passwordHash && { passwordHash }) } } },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          entity: "Employee",
          entityId: id,
          action: "UPDATE",
          before: snapshot(current, current.user!.login, current.user!.role),
          after: { ...snapshot(employee, login, role), passwordChanged: Boolean(passwordHash) },
        },
      });
    });
  } catch (e) {
    const known = uniqueErrors(e);
    if (known) return known;
    throw e;
  }

  revalidatePath(`/${locale}/employees`);
  redirect({ href: "/employees", locale });
  return {};
}
