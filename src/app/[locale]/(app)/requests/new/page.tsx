import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { employeeOptions } from "@/lib/employees";
import { requireUser } from "@/lib/session";
import { createRequest } from "../actions";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage({ params, searchParams }: PageProps<"/[locale]/requests/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN", "MANAGER"]);
  const t = await getTranslations("requests");
  const { client } = await searchParams;

  const [clients, employees] = await Promise.all([db.client.findMany({ orderBy: { name: "asc" } }), employeeOptions()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-fg">{t("newTitle")}</h1>
      <RequestForm
        action={createRequest.bind(null, locale)}
        clients={clients.map((c) => ({ id: c.id, label: c.name }))}
        employees={employees}
        clientId={typeof client === "string" ? client : undefined}
      />
    </div>
  );
}
