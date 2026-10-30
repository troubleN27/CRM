// Демо «рабочий день прямо сейчас»: чтобы имитации было кого двигать в любое время суток.
//   npm run demo:today
// Отмечает приход всем сотрудникам и менеджерам (кроме уже отметившихся),
// одного отправляет на выезд к клиенту, одного на обед, одного по личным делам.
import { PrismaClient } from "@prisma/client";
import { checkIn, goOut } from "../src/lib/attendance/service";

const db = new PrismaClient();

async function main() {
  const people = await db.employee.findMany({
    where: { isActive: true, user: { is: { role: { in: ["EMPLOYEE", "MANAGER"] } } } },
    include: { user: true },
  });
  const byLogin = new Map(people.map((p) => [p.user!.login, p]));

  let checkedIn = 0;
  for (const p of people) if ((await checkIn(p.id)).ok) checkedIn++;

  const out: string[] = [];
  const visit = byLogin.get("employee4");
  if (visit) {
    const request = await db.request.findFirst({ where: { assigneeId: visit.id, status: { not: "DONE" } } });
    if ((await goOut(visit.id, "CLIENT_VISIT", request?.id ?? null)).ok) out.push(`${visit.firstName} — выезд${request ? ` по заявке #${request.number}` : ""}`);
  }
  const lunch = byLogin.get("employee6");
  if (lunch && (await goOut(lunch.id, "LUNCH", null)).ok) out.push(`${lunch.firstName} — обед`);
  const personal = byLogin.get("employee9");
  if (personal && (await goOut(personal.id, "PERSONAL", null)).ok) out.push(`${personal.firstName} — личное`);

  console.log(`Отметили приход: ${checkedIn}. Вне офиса: ${out.length ? out.join(", ") : "никто (уже были отправлены)"}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
