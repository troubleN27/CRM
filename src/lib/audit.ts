import type { AuditAction, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// Запись в журнал изменений (AuditLog). Пароли и хэши сюда не передавать.
export function audit(
  tx: Tx,
  actorUserId: string,
  entity: string,
  entityId: string,
  action: AuditAction,
  before?: Prisma.InputJsonValue,
  after?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({ data: { actorUserId, entity, entityId, action, before, after } });
}
