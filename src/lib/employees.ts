import { db } from "./db";

// Активные сотрудники для выпадающих списков: «Фамилия Имя — должность».
export async function employeeOptions() {
  const list = await db.employee.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return list.map((e) => ({ id: e.id, label: `${e.lastName} ${e.firstName} — ${e.position}` }));
}
