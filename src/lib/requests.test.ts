import { describe, expect, it } from "vitest";
import { canSetStatus, isOverdue, statusAfterAssign } from "./requests";
import { requestSchema } from "./validation";

describe("isOverdue", () => {
  it("просрочена, если срок вчера и заявка не выполнена", () => {
    expect(isOverdue("IN_PROGRESS", "2026-10-22", "2026-10-23")).toBe(true);
  });
  it("не просрочена в день срока, без срока и если выполнена", () => {
    expect(isOverdue("NEW", "2026-10-23", "2026-10-23")).toBe(false);
    expect(isOverdue("NEW", null, "2026-10-23")).toBe(false);
    expect(isOverdue("DONE", "2026-10-01", "2026-10-23")).toBe(false);
  });
});

describe("statusAfterAssign", () => {
  it("новая → назначена при назначении", () => expect(statusAfterAssign("NEW", true)).toBe("ASSIGNED"));
  it("в работе остаётся в работе при смене исполнителя", () => expect(statusAfterAssign("IN_PROGRESS", true)).toBe("IN_PROGRESS"));
  it("без исполнителя заявка снова новая", () => expect(statusAfterAssign("IN_PROGRESS", false)).toBe("NEW"));
});

describe("canSetStatus", () => {
  const manager = { role: "MANAGER" as const, employeeId: "m" };
  const worker = { role: "EMPLOYEE" as const, employeeId: "w" };

  it("менеджер может любой статус, если есть исполнитель", () => {
    expect(canSetStatus(manager, "w", "DONE")).toBe(true);
    expect(canSetStatus(manager, "w", "ASSIGNED")).toBe(true);
  });
  it("без исполнителя нельзя «назначена», «в работе», «выполнена»", () => {
    expect(canSetStatus(manager, null, "ASSIGNED")).toBe(false);
    expect(canSetStatus(manager, null, "DONE")).toBe(false);
  });
  it("исполнитель может только «в работе» и «выполнена»", () => {
    expect(canSetStatus(worker, "w", "IN_PROGRESS")).toBe(true);
    expect(canSetStatus(worker, "w", "DONE")).toBe(true);
    expect(canSetStatus(worker, "w", "ASSIGNED")).toBe(false);
  });
  it("чужую заявку сотрудник не меняет", () => {
    expect(canSetStatus(worker, "other", "DONE")).toBe(false);
  });
});

describe("requestSchema", () => {
  it("пустой срок и исполнитель → null", () => {
    const r = requestSchema.parse({ clientId: "c1", description: "Тест", assigneeId: "", dueDate: "" });
    expect(r.assigneeId).toBeNull();
    expect(r.dueDate).toBeNull();
  });
  it("неверная дата не проходит", () => {
    expect(requestSchema.safeParse({ clientId: "c1", description: "Тест", assigneeId: "", dueDate: "2026-13-40" }).success).toBe(false);
  });
});
