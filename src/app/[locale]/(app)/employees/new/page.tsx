import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { createEmployee } from "../actions";
import { EmployeeForm } from "../EmployeeForm";

export default async function NewEmployeePage({ params }: PageProps<"/[locale]/employees/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN"]);
  const t = await getTranslations("employees");

  const desks = await db.desk.findMany({ where: { employee: null }, orderBy: { code: "asc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-fg">{t("newTitle")}</h1>
      <EmployeeForm action={createEmployee.bind(null, locale)} desks={desks} />
    </div>
  );
}
