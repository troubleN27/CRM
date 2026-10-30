// Обращение к сайту Офис-CRM: GET/POST /api/agent/* с ключом агента.
// Все правила (кто свободен, приватность, расчёт часов) живут на сайте, здесь только вызов.

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const APP_AGENT_KEY = process.env.APP_AGENT_KEY ?? "";

// Ошибка, которую можно показать человеку как есть.
export class FriendlyError extends Error {}

type ApiError = { error: string; details?: Record<string, unknown> };

export async function callApp<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!APP_AGENT_KEY) {
    throw new FriendlyError("MCP-сервер не настроен: в mcp-server/.env не задан APP_AGENT_KEY (это AGENT_API_KEY из .env сайта).");
  }
  let res: Response;
  try {
    res = await fetch(`${APP_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${APP_AGENT_KEY}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new FriendlyError(`Сайт Офис-CRM не отвечает по адресу ${APP_URL}. Запустите его командой «npm run dev» в папке проекта и повторите.`);
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (res.ok && data) return data;
  throw new FriendlyError(explain(data?.error ?? `http${res.status}`, data?.details ?? {}));
}

const names = (list: unknown) => (Array.isArray(list) && list.length ? list.join(", ") : "никого");

// Коды ошибок сайта → понятные сообщения.
export function explain(code: string, d: Record<string, unknown>): string {
  switch (code) {
    case "unauthorized":
      return "Сайт отклонил ключ агента: APP_AGENT_KEY в mcp-server/.env не совпадает с AGENT_API_KEY в .env сайта.";
    case "queryTooShort":
      return "Слишком короткий запрос: напишите хотя бы 2 буквы имени или фамилии.";
    case "badDate":
      return `Не понимаю дату «${d.date}». Пишите в формате ГГГГ-ММ-ДД, например 2026-10-23.`;
    case "futureDate":
      return `Дата ${d.date} ещё не наступила — опозданий за неё нет.`;
    case "badPeriod":
      return `Начало периода (${d.from}) позже конца (${d.to}). Поменяйте даты местами.`;
    case "periodTooLong":
      return `Период слишком длинный: можно не больше ${d.max} дней. Для больших периодов скачайте Excel на странице «Отчёты».`;
    case "badInput":
      return "Неверные параметры: номер заявки должен быть целым числом, имя сотрудника — от 2 букв.";
    case "requestNotFound":
      return `Заявка #${d.number} не найдена. Проверьте номер на странице «Заявки».`;
    case "requestDone":
      return `Заявка #${d.number} уже выполнена — назначать её не нужно.`;
    case "alreadyAssigned":
      return `Заявка #${d.number} уже назначена на ${d.assignee}. Если нужно передать её другому, вызовите ещё раз с reassign: true.`;
    case "employeeNotFound":
      return `Сотрудник «${d.query}» не найден. Проверьте имя или найдите его инструментом find_employee.`;
    case "employeeAmbiguous":
      return `По запросу «${d.query}» нашлось несколько сотрудников: ${names(d.names)}. Уточните имя и фамилию.`;
    case "employeeNotFree": {
      const why =
        d.status === "OUT_OF_OFFICE" ? "сейчас вне офиса" : d.status === "OFF_WORK" ? "сейчас не на работе" : "уже есть заявка в работе (или это не сотрудник, а менеджер или админ)";
      return `${d.name} не может взять заявку: ${why}.`;
    }
    case "noFreeEmployee":
      return `Сейчас нет свободных сотрудников в офисе. В офисе: ${names(d.inOffice)}, но у всех есть заявки в работе. Попробуйте позже или назначьте вручную на сайте.`;
    case "internal":
      return "На сайте произошла внутренняя ошибка. Посмотрите вывод «npm run dev» и повторите.";
    default:
      return `Сайт вернул ошибку «${code}».`;
  }
}
