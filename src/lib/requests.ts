import type { RequestStatus, Role } from "@prisma/client";

export const REQUEST_STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "DONE"] as const satisfies readonly RequestStatus[];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
}

// Просрочена: срок раньше сегодняшней даты, а заявка не выполнена.
export function isOverdue(status: RequestStatus, dueDate: string | null, today: string): boolean {
  return dueDate !== null && dueDate < today && status !== "DONE";
}

// Статус после назначения или снятия исполнителя.
export function statusAfterAssign(status: RequestStatus, hasAssignee: boolean): RequestStatus {
  if (hasAssignee && status === "NEW") return "ASSIGNED";
  if (!hasAssignee) return "NEW";
  return status;
}

type Actor = { role: Role; employeeId: string };

export function canManageRequests(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

// Кто может поставить заявке новый статус.
// Админ и менеджер — любой. Исполнитель — только «в работе» и «выполнена».
// Без исполнителя заявка может быть только «новой».
export function canSetStatus(actor: Actor, assigneeId: string | null, next: RequestStatus): boolean {
  if (next !== "NEW" && !assigneeId) return false;
  if (next === "NEW" && assigneeId) return false;
  if (canManageRequests(actor.role)) return true;
  return actor.employeeId === assigneeId && (next === "IN_PROGRESS" || next === "DONE");
}
