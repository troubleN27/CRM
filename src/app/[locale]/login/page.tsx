import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await auth()) redirect({ href: "/", locale });

  const t = await getTranslations();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-medium">{t("login.title")}</h1>
          <LanguageSwitcher />
        </div>
        <p className="mb-4 text-sm text-fg-2">{t("common.appName")}</p>
        <LoginForm />
      </div>
    </main>
  );
}
