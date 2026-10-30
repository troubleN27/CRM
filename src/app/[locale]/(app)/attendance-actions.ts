"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { checkIn, comeBack, endWork, goOut } from "@/lib/attendance/service";

// Кнопки отметок. Время берётся на сервере.
export async function checkInAction(locale: string) {
  const session = await auth();
  if (!session) return;
  await checkIn(session.user.employeeId);
  revalidatePath(`/${locale}`, "layout");
  redirect({ href: "/", locale });
}

export async function endWorkAction(locale: string) {
  const session = await auth();
  if (!session) return;
  await endWork(session.user.employeeId);
  revalidatePath(`/${locale}`, "layout");
}

const REASONS = ["LUNCH", "CLIENT_VISIT", "PERSONAL"] as const;

export async function goOutAction(locale: string, formData: FormData) {
  const session = await auth();
  if (!session) return;
  const reason = REASONS.find((r) => r === formData.get("reason"));
  if (!reason) return;
  const requestId = reason === "CLIENT_VISIT" ? String(formData.get("requestId") ?? "") || null : null;
  await goOut(session.user.employeeId, reason, requestId);
  revalidatePath(`/${locale}`, "layout");
}

export async function comeBackAction(locale: string) {
  const session = await auth();
  if (!session) return;
  await comeBack(session.user.employeeId);
  revalidatePath(`/${locale}`, "layout");
}
