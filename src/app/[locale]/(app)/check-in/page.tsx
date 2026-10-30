import { setRequestLocale } from "next-intl/server";
import { CheckInGate } from "@/components/CheckInGate";
import { redirect } from "@/i18n/navigation";
import { mustCheckIn, requireUser } from "@/lib/session";

// Экран «Я пришёл»: сюда requireUser отправляет, пока нет отметки прихода.
export default async function CheckInPage({ params }: PageProps<"/[locale]/check-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, undefined, { skipCheckIn: true });
  if (!(await mustCheckIn(user))) redirect({ href: "/", locale });

  return <CheckInGate employeeId={user.employeeId} locale={locale} />;
}
