"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fieldErrors, withValues, type FormState } from "@/lib/forms";
import { canManageRequests } from "@/lib/requests";
import { clientSchema } from "@/lib/validation";

export async function createClient(locale: string, prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session || !canManageRequests(session.user.role)) {
    return withValues({ errors: { form: "forbidden" } }, prev, formData);
  }

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return withValues({ errors: fieldErrors(parsed.error) }, prev, formData);

  const client = await db.$transaction(async (tx) => {
    const created = await tx.client.create({ data: parsed.data });
    await audit(tx, session.user.id, "Client", created.id, "CREATE", undefined, parsed.data);
    return created;
  });

  revalidatePath(`/${locale}/clients`);
  redirect({ href: `/clients/${client.id}`, locale });
  return {};
}
