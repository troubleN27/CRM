import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { createClient } from "../actions";
import { ClientForm } from "../ClientForm";

export default async function NewClientPage({ params }: PageProps<"/[locale]/clients/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["ADMIN", "MANAGER"]);
  const t = await getTranslations("clients");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium text-fg">{t("newTitle")}</h1>
      <ClientForm action={createClient.bind(null, locale)} />
    </div>
  );
}
