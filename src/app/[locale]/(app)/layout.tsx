import { setRequestLocale } from "next-intl/server";
import type { Role } from "@prisma/client";
import { signOut } from "@/auth";
import { LocationReporter } from "@/components/LocationReporter";
import { AppShell, type NavItem } from "@/components/shell/AppShell";
import { db } from "@/lib/db";
import { mustCheckIn, requireUser } from "@/lib/session";

// Разделы в меню и кому они видны.
const NAV: (NavItem & { roles?: Role[] })[] = [
  { key: "home", href: "/", icon: "home" },
  { key: "employees", href: "/employees", icon: "users" },
  { key: "clients", href: "/clients", icon: "building" },
  { key: "requests", href: "/requests", icon: "clipboard" },
  { key: "office", href: "/office", icon: "plan" },
  { key: "map", href: "/map", icon: "globe", roles: ["ADMIN"] },
  { key: "timeline", href: "/timeline", icon: "calendar", roles: ["ADMIN", "MANAGER"] },
  { key: "reports", href: "/reports", icon: "chart", roles: ["ADMIN", "MANAGER"] },
];

// Все страницы внутри (app) доступны только после входа.
// Обязательную отметку прихода проверяет requireUser в каждой странице;
// здесь только прячем меню, пока сотрудник не отметился.
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, undefined, { skipCheckIn: true });
  const [me, gated] = await Promise.all([
    db.employee.findUnique({ where: { id: user.employeeId }, select: { status: true, isGpsTracked: true } }),
    mustCheckIn(user),
  ]);

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}/login` });
  }

  const nav = gated ? [] : NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map(({ key, href, icon }) => ({ key, href, icon }));

  return (
    <AppShell user={{ name: user.name ?? "", role: user.role }} nav={nav} logout={logout}>
      {/* Вне офиса телефон работает как датчик; для курьера — на протяжении всей смены с момента прихода. */}
      {(me?.status === "OUT_OF_OFFICE" || (me?.isGpsTracked && me?.status !== "OFF_WORK")) && (
        <LocationReporter employeeId={user.employeeId} isGpsTracked={me?.isGpsTracked ?? false} />
      )}
      {children}
    </AppShell>
  );
}
