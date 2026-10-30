// Проверка входа за три роли и прав доступа. Сайт должен быть запущен (npm run dev).
// Пароли берутся из .env и на экран не выводятся.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function login(loginName, password) {
  const jar = new Map();
  const keep = (res) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      jar.set(k, v);
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  keep(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ csrfToken, login: loginName, password, callbackUrl: `${BASE}/ru` }),
  });
  keep(res);

  const session = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookie() } })).json();
  const get = (path) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { cookie: cookie() } });
  const post = (path, body) => fetch(`${BASE}${path}`, { method: "POST", body, redirect: "manual", headers: { cookie: cookie() } });
  const attendance = async (action) => {
    const res = await fetch(`${BASE}/api/attendance`, {
      method: action ? "POST" : "GET",
      headers: { cookie: cookie(), "content-type": "application/json" },
      body: action ? JSON.stringify({ action }) : undefined,
    });
    return { status: res.status, ...(await res.json()) };
  };
  // Страница открылась, если 200 и внутри нет перенаправления. С экраном загрузки (loading.tsx)
  // Next отдаёт 200 потоком, а «нет прав» приходит внутри потока как NEXT_REDIRECT.
  const opens = async (path) => {
    const r = await get(path);
    return r.status === 200 && !(await r.text()).includes("NEXT_REDIRECT");
  };
  return { session, get, post, attendance, opens };
}

// Отметки, которые сделал этот скрипт, в конце удаляются, чтобы демо осталось как было.
const scriptStart = new Date();
const createdBy = [];

let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? "✔" : "✘"} ${text}`);
  if (!ok) failed++;
};

const cases = [
  { login: "admin", password: process.env.DEMO_ADMIN_PASSWORD, role: "ADMIN", canManage: true, canSales: true },
  { login: "manager1", password: process.env.DEMO_MANAGER_PASSWORD, role: "MANAGER", canManage: false, canSales: true },
  { login: "employee1", password: process.env.DEMO_EMPLOYEE_PASSWORD, role: "EMPLOYEE", canManage: false, canSales: false },
];

// Страницы, открытые всем вошедшим.
const shared = ["/ru/clients", "/ru/requests", "/ru/requests?status=NEW", "/ru/office"];

for (const c of cases) {
  const { session, get, post, attendance, opens } = await login(c.login, c.password);
  check(session?.user?.role === c.role, `${c.login}: вход выполнен, роль ${session?.user?.role ?? "—"}`);

  // Обязательная отметка прихода: до «Я пришёл» любая страница показывает только кнопку и рабочее место.
  if (c.role !== "ADMIN") {
    const state = await attendance();
    if (state.checkedIn) {
      console.log(`  ${c.login}: уже отмечен сегодня — проверку экрана «Я пришёл» пропускаю`);
    } else {
      for (const path of ["/ru", "/ru/clients", "/ru/requests", "/ru/office"]) {
        const res = await get(path);
        const body = await res.text();
        const toGate = (res.status >= 300 && res.status < 400 && res.headers.get("location")?.includes("/check-in")) || body.includes("/ru/check-in");
        check(toGate && !body.includes("Misol Print"), `${c.login}: до отметки ${path} → «Я пришёл», данных нет`);
      }
      const gate = await (await get("/ru/check-in")).text();
      check(gate.includes('data-testid="check-in"') && gate.includes('data-testid="my-desk"'), `${c.login}: на экране «Я пришёл» есть кнопка и своё место`);
      const res = await attendance("in");
      check(res.status === 200 && res.ok, `${c.login}: «Я пришёл» сохранено${res.isLate ? `, опоздание ${res.lateMinutes} мин` : ""}`);
      createdBy.push(session.user.employeeId);
      const again = await attendance("in");
      check(again.status === 409, `${c.login}: повторный «Я пришёл» отклонён`);
    }
  } else {
    const home = await (await get("/ru")).text();
    check(home.includes('data-testid="not-checked"') && home.includes('data-testid="late-today"'), `${c.login}: на главной блоки «Не отметились» и «Опоздали»`);
  }

  const list = await get("/ru/employees");
  const html = await list.text();
  check(list.status === 200 && html.includes("Сотрудники"), `${c.login}: видит список сотрудников`);
  check(html.includes('href="/ru/employees/new"') === c.canManage, `${c.login}: кнопка «Добавить» ${c.canManage ? "есть" : "скрыта"}`);

  const allowed = await opens("/ru/employees/new");
  check(allowed === c.canManage, `${c.login}: страница добавления ${allowed ? "открывается" : "закрыта"}`);

  for (const path of shared) {
    check(await opens(path), `${c.login}: открывается ${path}`);
  }
  for (const path of ["/ru/clients/new", "/ru/requests/new"]) {
    const ok = await opens(path);
    check(ok === c.canSales, `${c.login}: ${path} ${ok ? "открывается" : "закрыта"}`);
  }
  const editPlan = await opens("/ru/office/edit");
  check(editPlan === c.canManage, `${c.login}: редактор плана ${editPlan ? "открывается" : "закрыт"}`);

  const image = await get("/api/office-plan/image");
  check(image.status === 200, `${c.login}: картинка плана загружается`);
  // Загрузка плана: не-админу — 403, а SVG не принимается даже у админа.
  const svg = new FormData();
  svg.set("file", new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: "image/svg+xml" }), "x.svg");
  const upload = await post("/api/office-plan/image", svg);
  const expected = c.role === "ADMIN" ? 400 : 403;
  check(upload.status === expected, `${c.login}: загрузка SVG отклонена (${upload.status})`);

  // Отчёты: админ и менеджер — да, сотрудник — нет.
  const canReports = c.role !== "EMPLOYEE";
  check((await opens("/ru/reports")) === canReports, `${c.login}: страница «Отчёты» ${canReports ? "открывается" : "закрыта"}`);
  const xlsx = await get("/api/reports/attendance?from=2026-10-19&to=2026-10-23&locale=ru");
  check(
    canReports ? xlsx.status === 200 && xlsx.headers.get("content-type")?.includes("spreadsheetml") : xlsx.status === 403,
    `${c.login}: скачивание Excel ${canReports ? "работает" : "запрещено"} (${xlsx.status})`,
  );
  // Карта города и данные главной админа — только админ.
  const isAdmin = c.role === "ADMIN";
  check((await opens("/ru/map")) === isAdmin, `${c.login}: карта города ${isAdmin ? "открывается" : "закрыта"}`);
  for (const path of ["/api/admin/dashboard", "/api/admin/city"]) {
    const s = (await get(path)).status;
    check(isAdmin ? s === 200 : s === 403, `${c.login}: ${path} ${isAdmin ? "отдаёт данные" : "закрыт"} (${s})`);
  }
  // Телефон может отправлять только свои точки.
  const foreign = await post(
    "/api/positions",
    JSON.stringify({ positions: [{ employeeId: "someone-else", kind: "CITY", lat: 41.3, lng: 69.2 }] }),
  );
  check(foreign.status === 403 || foreign.status === 400, `${c.login}: чужую позицию отправить нельзя (${foreign.status})`);

  if (createdBy.includes(session?.user?.employeeId)) {
    const end = await attendance("end");
    const after = await attendance();
    check(end.ok && after.ended && after.endedAt, `${c.login}: «Закончить работу» сохранило время ухода`);
    check((await attendance("in")).status === 409, `${c.login}: после конца дня снова отметиться нельзя`);
  }
}

if (createdBy.length) {
  const { PrismaClient } = (await import("@prisma/client")).default;
  const db = new PrismaClient();
  await db.workDay.deleteMany({ where: { employeeId: { in: createdBy }, createdAt: { gte: scriptStart } } });
  await db.employee.updateMany({ where: { id: { in: createdBy } }, data: { status: "OFF_WORK" } });
  await db.$disconnect();
  console.log(`  отметки проверки удалены (${createdBy.length})`);
}

const wrong = await login("admin", "wrong-password");
check(!wrong.session?.user, "неверный пароль: вход не выполнен");

const anon = await fetch(`${BASE}/ru/employees`, { redirect: "manual" });
check(anon.status >= 300 && anon.status < 400, "без входа: перенаправление на страницу входа");
const anonImage = await fetch(`${BASE}/api/office-plan/image`);
check(anonImage.status === 401, "без входа: картинка плана закрыта");
const anonPos = await fetch(`${BASE}/api/positions`, { method: "POST", body: "{}", headers: { authorization: "Bearer wrong-key" } });
check(anonPos.status === 401, "чужой ключ устройства: позиции не принимаются");
const anonReport = await fetch(`${BASE}/api/reports/attendance?from=2026-10-19&to=2026-10-23`);
check(anonReport.status === 401, "без входа: Excel не скачать");

console.log(failed ? `\nОшибок: ${failed}` : "\nВсе проверки пройдены");
process.exit(failed ? 1 : 0);
