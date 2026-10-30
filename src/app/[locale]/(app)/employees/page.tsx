import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonClass, pageTitleClass } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EmployeesGrid, type EmployeeRow } from "./EmployeesGrid";

export default async function EmployeesPage({ params, searchParams }: PageProps<"/[locale]/employees">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();
  const isAdmin = user.role === "ADMIN";
  const { q } = await searchParams;

  const employees = await db.employee.findMany({
    where: { isActive: true },
    include: { user: true, desk: true, _count: { select: { requests: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } } } } } },
    orderBy: [{ lastName: "asc" }],
  });

  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    position: e.position,
    role: e.user?.role ?? "EMPLOYEE",
    login: isAdmin ? (e.user?.login ?? null) : null,
    desk: e.desk?.code ?? null,
    pc: e.desk?.pcNumber ?? null,
    status: e.status,
    phone: e.phone,
    email: e.email,
    activeRequests: e._count.requests,
    canEdit: isAdmin && e.user?.role !== "ADMIN",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className={pageTitleClass}>{t("employees.title")}</h1>
        {isAdmin && (
          <Link href="/employees/new" className={`${buttonClass} ml-auto`}>
            {t("employees.add")}
          </Link>
        )}
      </div>
      <EmployeesGrid rows={rows} showLogin={isAdmin} initialQuery={typeof q === "string" ? q : undefined} />
    </div>
  );
}
