// Демо-данные. Все люди и компании вымышленные. Пароли берутся из .env.
import { PrismaClient, RequestStatus, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { todayInOffice } from "../src/lib/time";
import { lateness, officeClock, officeTimeToDate, workDayDate, workedMinutes } from "../src/lib/attendance/time";
import { PLAN_H, PLAN_W, testDesks, testPlanSvg, testZones } from "../src/lib/test-plan";

const db = new PrismaClient();

function requirePassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 8) {
    throw new Error(`Задайте ${name} в .env (минимум 8 символов)`);
  }
  return value;
}

type Person = {
  login: string;
  role: Role;
  firstName: string;
  lastName: string;
  position: string;
  desk: string;
  isGpsTracked?: boolean;
};

const people: Person[] = [
  { login: "admin", role: "ADMIN", firstName: "Ольга", lastName: "Демонова", position: "Офис-менеджер", desk: "13" },
  { login: "manager1", role: "MANAGER", firstName: "Тимур", lastName: "Примеров", position: "Руководитель проектов", desk: "11" },
  { login: "manager2", role: "MANAGER", firstName: "Джессика", lastName: "Сэмплтон", position: "Аккаунт-менеджер", desk: "12" },
  { login: "employee1", role: "EMPLOYEE", firstName: "Алиса", lastName: "Тестова", position: "UI/UX-дизайнер", desk: "06" },
  { login: "employee2", role: "EMPLOYEE", firstName: "Бахтиёр", lastName: "Намунаев", position: "Frontend-разработчик", desk: "01" },
  { login: "employee3", role: "EMPLOYEE", firstName: "Дилноза", lastName: "Синовова", position: "Backend-разработчик", desk: "02" },
  { login: "employee4", role: "EMPLOYEE", firstName: "Кевин", lastName: "Демосон", position: "Fullstack-разработчик", desk: "03" },
  { login: "employee5", role: "EMPLOYEE", firstName: "Мария", lastName: "Образцова", position: "QA-инженер", desk: "04" },
  { login: "employee6", role: "EMPLOYEE", firstName: "Шерзод", lastName: "Мисолов", position: "DevOps-инженер", desk: "05" },
  { login: "employee7", role: "EMPLOYEE", firstName: "Эмили", lastName: "Плейсхолдер", position: "Контент-менеджер", desk: "10" },
  { login: "employee8", role: "EMPLOYEE", firstName: "Иван", lastName: "Пробный", position: "Frontend-разработчик", desk: "08" },
  { login: "employee9", role: "EMPLOYEE", firstName: "Нодира", lastName: "Тажрибаева", position: "Графический дизайнер", desk: "07" },
  { login: "employee10", role: "EMPLOYEE", firstName: "Райан", lastName: "Мокап", position: "Mobile-разработчик", desk: "09" },
  { login: "courier", role: "EMPLOYEE", firstName: "Азиз", lastName: "Курьеров", position: "Выездной специалист / Курьер", desk: "", isGpsTracked: true },
];

// Клиенты в Ташкенте. Компании и улицы вымышленные, точки — в общих районах города.
// Код оператора «00» не существует, поэтому номера заведомо ненастоящие.
const clients = [
  { name: "ООО «Namuna Logistics»", phone: "+998 00 000-00-01", address: "Ташкент, Юнусабадский р-н, ул. Примерная, 12", lat: 41.3655, lng: 69.2865 },
  { name: "Sinov Medical", phone: "+998 00 000-00-02", address: "Ташкент, Мирзо-Улугбекский р-н, ул. Тестовая, 5", lat: 41.3262, lng: 69.3348 },
  { name: "Демо Текстиль", phone: "+998 00 000-00-03", address: "Ташкент, Чиланзарский р-н, кв. Образцовый, 7", lat: 41.2738, lng: 69.2042 },
  { name: "Misol Print", phone: "+998 00 000-00-04", address: "Ташкент, Шайхантахурский р-н, ул. Вымышленная, 21", lat: 41.3265, lng: 69.2415 },
  { name: "Tajriba Foods", phone: "+998 00 000-00-05", address: "Ташкент, Сергелийский р-н, ул. Демо, 3", lat: 41.2285, lng: 69.2205 },
];

type DemoRequest = { client: number; description: string; status: RequestStatus; assignee: string | null; dueInDays: number | null };

const requests: DemoRequest[] = [
  { client: 0, description: "Сделать лендинг для новой услуги доставки", status: "NEW", assignee: null, dueInDays: 14 },
  { client: 1, description: "Починить форму записи к врачу на сайте", status: "NEW", assignee: null, dueInDays: 3 },
  { client: 2, description: "Обновить каталог тканей и фотографии", status: "ASSIGNED", assignee: "employee1", dueInDays: 7 },
  { client: 3, description: "Настроить онлайн-калькулятор стоимости печати", status: "ASSIGNED", assignee: "employee3", dueInDays: 5 },
  { client: 4, description: "Выезд: сфотографировать меню для сайта", status: "ASSIGNED", assignee: "employee9", dueInDays: -1 },
  { client: 0, description: "Подключить трекинг посылок по номеру заказа", status: "IN_PROGRESS", assignee: "employee4", dueInDays: 2 },
  { client: 1, description: "Выезд: настроить сайт на компьютере в регистратуре", status: "IN_PROGRESS", assignee: "employee6", dueInDays: -2 },
  { client: 2, description: "Мобильная версия интернет-магазина", status: "IN_PROGRESS", assignee: "employee10", dueInDays: 20 },
  { client: 3, description: "Перенести сайт на новый хостинг", status: "DONE", assignee: "employee6", dueInDays: -5 },
  { client: 4, description: "Нарисовать логотип и фирменные цвета", status: "DONE", assignee: "employee9", dueInDays: -10 },
];

// Отметки «Я пришёл» за сегодня (время офиса). Остальные ещё не отметились.
const arrivalsToday: Record<string, [number, number]> = {
  manager2: [8, 55],
  employee2: [8, 47],
  employee3: [8, 58],
  employee4: [9, 3],
  employee5: [9, 12], // опоздание 12 мин
  employee6: [9, 27], // опоздание 27 мин
};

// Повторяемые «случайные» числа: при каждом сиде история одинаковая.
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Последние n рабочих дней (пн–пт) до сегодняшнего, от свежего к старому.
function previousWeekdays(today: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${today}T00:00:00Z`);
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type Ev = { type: "IN" | "OUT"; reason: "LUNCH" | "CLIENT_VISIT" | "PERSONAL" | "END_OF_DAY" | null; min: number };

// Один прошедший рабочий день в минутах от полуночи по времени офиса.
function historyDay(rnd: () => number, isExample: boolean): Ev[] {
  // Пример из задания: приход 09:12, обед 13:00–14:00, уход 18:00.
  if (isExample) {
    return [
      { type: "IN", reason: null, min: 9 * 60 + 12 },
      { type: "OUT", reason: "LUNCH", min: 13 * 60 },
      { type: "IN", reason: null, min: 14 * 60 },
      { type: "OUT", reason: "END_OF_DAY", min: 18 * 60 },
    ];
  }
  const events: Ev[] = [{ type: "IN", reason: null, min: 8 * 60 + 40 + Math.floor(rnd() * 32) }]; // 08:40–09:11
  if (rnd() < 0.75) {
    const start = 12 * 60 + 30 + Math.floor(rnd() * 60);
    events.push({ type: "OUT", reason: "LUNCH", min: start }, { type: "IN", reason: null, min: start + 40 + Math.floor(rnd() * 30) });
  }
  if (rnd() < 0.3) {
    const start = 15 * 60 + Math.floor(rnd() * 30);
    events.push({ type: "OUT", reason: "CLIENT_VISIT", min: start }, { type: "IN", reason: null, min: start + 60 + Math.floor(rnd() * 60) });
  }
  events.push({ type: "OUT", reason: "END_OF_DAY", min: 17 * 60 + 30 + Math.floor(rnd() * 60) });
  return events;
}

function addDays(isoDate: string, days: number): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  const passwords: Record<Role, string> = {
    ADMIN: await hashPassword(requirePassword("DEMO_ADMIN_PASSWORD")),
    MANAGER: await hashPassword(requirePassword("DEMO_MANAGER_PASSWORD")),
    EMPLOYEE: await hashPassword(requirePassword("DEMO_EMPLOYEE_PASSWORD")),
  };

  // Сид можно запускать повторно: всё демо создаётся заново.
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.locationPoint.deleteMany(),
    db.attendanceEvent.deleteMany(),
    db.workDay.deleteMany(),
    db.request.deleteMany(),
    db.contactPerson.deleteMany(),
    db.client.deleteMany(),
    db.user.deleteMany(),
    db.employee.deleteMany(),
    db.desk.deleteMany(),
    db.zone.deleteMany(),
    db.officePlan.deleteMany(),
    // Номера заявок снова с #1.
    db.$executeRaw`ALTER SEQUENCE "Request_number_seq" RESTART WITH 1`,
  ]);

  await db.officePlan.create({
    data: { mimeType: "image/svg+xml", data: Buffer.from(testPlanSvg()), width: PLAN_W, height: PLAN_H },
  });
  await db.zone.createMany({ data: testZones });
  await db.desk.createMany({ data: testDesks });
  const deskIds = new Map((await db.desk.findMany()).map((d) => [d.code, d.id]));

  const employeeIds = new Map<string, string>();
  for (const [i, p] of people.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const employee = await db.employee.create({
      data: {
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        phone: `+1 555-01${n}`,
        email: `${p.login}@example.com`,
        deskId: deskIds.get(p.desk),
        isGpsTracked: p.isGpsTracked ?? false,
        user: { create: { login: p.login, role: p.role, passwordHash: passwords[p.role] } },
      },
    });
    employeeIds.set(p.login, employee.id);
  }

  const clientIds: string[] = [];
  for (const c of clients) clientIds.push((await db.client.create({ data: c })).id);

  const today = todayInOffice();
  for (const r of requests) {
    await db.request.create({
      data: {
        clientId: clientIds[r.client],
        description: r.description,
        status: r.status,
        assigneeId: r.assignee ? employeeIds.get(r.assignee) : null,
        dueDate: r.dueInDays === null ? null : addDays(today, r.dueInDays),
      },
    });
  }

  const now = new Date();
  const officeToday = officeClock(now).date;
  let arrived = 0;
  for (const [login, [h, m]] of Object.entries(arrivalsToday)) {
    const at = officeTimeToDate(officeToday, h, m);
    if (at > now) continue; // сид запущен раньше этого времени — не придумываем будущее
    const employeeId = employeeIds.get(login)!;
    await db.workDay.create({
      data: { employeeId, date: workDayDate(at), firstInAt: at, ...lateness(at), events: { create: { type: "IN", at } } },
    });
    await db.employee.update({ where: { id: employeeId }, data: { status: "IN_OFFICE" } });
    arrived++;
  }

  // История за прошлые рабочие дни — для отчётов.
  const rnd = seededRandom(42);
  const history = previousWeekdays(officeToday, 5);
  let historyDays = 0;
  for (const date of history) {
    for (const p of people) {
      if (p.role === "ADMIN") continue;
      const events = historyDay(rnd, p.login === "employee1" && date === history[0]).map((e) => ({
        type: e.type,
        reason: e.reason,
        at: officeTimeToDate(date, Math.floor(e.min / 60), e.min % 60),
      }));
      const firstIn = events[0].at;
      const end = events.at(-1)!.at;
      await db.workDay.create({
        data: {
          employeeId: employeeIds.get(p.login)!,
          date: new Date(`${date}T00:00:00Z`),
          firstInAt: firstIn,
          endedAt: end,
          endType: "END_OF_DAY",
          ...lateness(firstIn),
          workedMinutes: workedMinutes(firstIn, end, events),
          events: { create: events },
        },
      });
      historyDays++;
    }
  }

  console.log(
    `Готово: план ${PLAN_W}×${PLAN_H}, ${testZones.length} зоны, ${testDesks.length} мест, ` +
      `${people.length} человек, ${clients.length} клиентов, ${requests.length} заявок, ` +
      `${arrived} отметок прихода за ${officeToday}, история: ${historyDays} рабочих дней (${history.at(-1)} — ${history[0]}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
