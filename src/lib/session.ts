import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { todayWorkDay } from "@/lib/attendance/service";

// Нужно ли сначала нажать «Я пришёл». Админ отмечается на главной и не блокируется.
export async function mustCheckIn(user: { role: Role; employeeId: string }) {
  return user.role !== "ADMIN" && !(await todayWorkDay(user.employeeId));
}

// Проверка входа и роли на сервере. Скрытая кнопка защитой не считается.
// Пока сотрудник не отметил приход, любая страница уводит на /check-in —
// данные страницы при этом не загружаются и не попадают в браузер.
export async function requireUser(locale: string, roles?: Role[], opts: { skipCheckIn?: boolean } = {}) {
  const session = await auth();
  if (!session?.user) return redirect({ href: "/login", locale });
  if (!opts.skipCheckIn && (await mustCheckIn(session.user))) return redirect({ href: "/check-in", locale });
  if (roles && !roles.includes(session.user.role)) return redirect({ href: "/", locale });
  return session.user;
}
