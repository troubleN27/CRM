import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { updateEmployee } from "../../actions";
import { EmployeeForm } from "../../EmployeeForm";

export default async function EditEmployeePage({ params }: PageProps<"/[locale]/employees/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN"]);
  const t = await getTranslations("employees");

  const employee = await db.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee?.user || employee.user.role === "ADMIN") notFound();

  // Свободные места плюс текущее место сотрудника.
  const desks = await db.desk.findMany({
    where: { OR: [{ employee: null }, { employee: { id } }] },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-fg">{t("editTitle")}</h1>
      <EmployeeForm
        action={updateEmployee.bind(null, locale, id)}
        desks={desks}
        isEdit
        values={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          position: employee.position,
          login: employee.user.login,
          role: employee.user.role,
          deskId: employee.deskId ?? "",
        }}
      />
    </div>
  );
}
