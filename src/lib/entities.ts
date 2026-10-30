import type { AuditLog, Role } from "@prisma/client";
import { db } from "./db";
import { canManageRequests, canSetStatus, REQUEST_STATUSES } from "./requests";
import { officeTimeZone } from "./attendance/config";
import { dateOnly } from "./time";

// Данные выезжающей карточки (заявка или клиент): поля, права и история изменений.

type Actor = { role: Role; employeeId: string };

export type TimelineItem =
  | { id: string; at: string; actor: string | null; byAgent: boolean; kind: "created" }
  | { id: string; at: string; actor: string | null; byAgent: boolean; kind: "change"; field: string; from: string | null; to: string | null }
  | { id: string; at: string; actor: string | null; byAgent: boolean; kind: "requestCreated"; number: number }
  | { id: string; at: string; actor: null; byAgent: false; kind: "visit"; phase: "out" | "back"; employee: string };

const FIELDS = ["status", "assigneeId", "dueDate", "description", "name", "phone", "address"] as const;

async function actorNames(logs: AuditLog[]) {
  const users = await db.user.findMany({
    where: { id: { in: logs.flatMap((l) => (l.actorUserId ? [l.actorUserId] : [])) } },
    include: { employee: true },
  });
  return new Map(users.map((u) => [u.id, `${u.employee.firstName} ${u.employee.lastName}`]));
}

// Изменения из журнала: разница «было → стало» по известным полям.
async function changesFrom(logs: AuditLog[]): Promise<TimelineItem[]> {
  const names = await actorNames(logs);
  const assigneeIds = new Set<string>();
  for (const l of logs) for (const side of [l.before, l.after] as Record<string, unknown>[]) if (side?.assigneeId) assigneeIds.add(String(side.assigneeId));
  const employees = new Map(
    (await db.employee.findMany({ where: { id: { in: [...assigneeIds] } } })).map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
  );
  const show = (field: string, v: unknown) =>
    v === null || v === undefined || v === "" ? null : field === "assigneeId" ? (employees.get(String(v)) ?? "?") : String(v);

  const items: TimelineItem[] = [];
  for (const l of logs) {
    const base = { at: l.createdAt.toISOString(), actor: l.actorUserId ? (names.get(l.actorUserId) ?? null) : null, byAgent: l.actorLabel === "ai-agent" };
    if (l.action === "CREATE") {
      items.push({ id: l.id, ...base, kind: "created" });
      continue;
    }
    const before = (l.before ?? {}) as Record<string, unknown>;
    const after = (l.after ?? {}) as Record<string, unknown>;
    for (const field of FIELDS) {
      if (!(field in after) || String(before[field] ?? "") === String(after[field] ?? "")) continue;
      items.push({ id: `${l.id}-${field}`, ...base, kind: "change", field, from: show(field, before[field]), to: show(field, after[field]) });
    }
  }
  return items;
}

export async function requestEntity(id: string, actor: Actor) {
  const r = await db.request.findUnique({ where: { id }, include: { client: true, assignee: true } });
  if (!r) return null;
  const canManage = canManageRequests(actor.role);

  const [logs, visits, employees] = await Promise.all([
    db.auditLog.findMany({ where: { entity: "Request", entityId: id }, orderBy: { createdAt: "asc" } }),
    db.attendanceEvent.findMany({ where: { requestId: id }, include: { workDay: { include: { employee: true } } }, orderBy: { at: "asc" } }),
    canManage ? db.employee.findMany({ where: { isActive: true }, orderBy: [{ lastName: "asc" }] }) : Promise.resolve([]),
  ]);

  const timeline: TimelineItem[] = [
    ...(await changesFrom(logs)),
    ...visits.map((v) => ({
      id: v.id,
      at: v.at.toISOString(),
      actor: null,
      byAgent: false as const,
      kind: "visit" as const,
      phase: v.type === "OUT" ? ("out" as const) : ("back" as const),
      employee: `${v.workDay.employee.firstName} ${v.workDay.employee.lastName}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    type: "request" as const,
    id: r.id,
    number: r.number,
    description: r.description,
    status: r.status,
    dueDate: r.dueDate ? dateOnly(r.dueDate) : null,
    assigneeId: r.assigneeId,
    assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : null,
    client: { id: r.client.id, name: r.client.name, phone: r.client.phone, address: r.client.address },
    createdAt: r.createdAt.toISOString(),
    timeZone: officeTimeZone(),
    canEdit: canManage,
    statusOptions: REQUEST_STATUSES.filter((s) => s === r.status || canSetStatus(actor, r.assigneeId, s)),
    employees: employees.map((e) => ({ id: e.id, name: `${e.lastName} ${e.firstName}` })),
    timeline,
  };
}

export async function clientEntity(id: string, actor: Actor) {
  const c = await db.client.findUnique({
    where: { id },
    include: { requests: { include: { assignee: true }, orderBy: { number: "desc" } } },
  });
  if (!c) return null;
  const [logs, requestLogs] = await Promise.all([
    db.auditLog.findMany({ where: { entity: "Client", entityId: id }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ where: { entity: "Request", action: "CREATE", entityId: { in: c.requests.map((r) => r.id) } } }),
  ]);
  const names = await actorNames(requestLogs);
  const numberById = new Map(c.requests.map((r) => [r.id, r.number]));

  const timeline: TimelineItem[] = [
    ...(await changesFrom(logs)),
    ...requestLogs.map((l) => ({
      id: l.id,
      at: l.createdAt.toISOString(),
      actor: l.actorUserId ? (names.get(l.actorUserId) ?? null) : null,
      byAgent: l.actorLabel === "ai-agent",
      kind: "requestCreated" as const,
      number: numberById.get(l.entityId) ?? 0,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    type: "client" as const,
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    createdAt: c.createdAt.toISOString(),
    timeZone: officeTimeZone(),
    canEdit: canManageRequests(actor.role),
    requests: c.requests.map((r) => ({
      id: r.id,
      number: r.number,
      description: r.description,
      status: r.status,
      assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : null,
    })),
    timeline,
  };
}

export type RequestEntity = NonNullable<Awaited<ReturnType<typeof requestEntity>>>;
export type ClientEntity = NonNullable<Awaited<ReturnType<typeof clientEntity>>>;
