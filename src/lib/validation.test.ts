import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { createEmployeeSchema, loginSchema, updateEmployeeSchema } from "./validation";

describe("loginSchema", () => {
  it("принимает латиницу и приводит к нижнему регистру", () => {
    expect(loginSchema.parse(" Employee1 ")).toBe("employee1");
  });

  it("отклоняет кириллицу и слишком короткий логин", () => {
    expect(loginSchema.safeParse("иван").success).toBe(false);
    expect(loginSchema.safeParse("ab").success).toBe(false);
  });
});

describe("employee forms", () => {
  const base = { firstName: "Тест", lastName: "Тестов", position: "QA", login: "test.user", role: "EMPLOYEE", deskId: "" };

  it("при создании пароль обязателен, минимум 8 символов", () => {
    expect(createEmployeeSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...base, password: "long-enough" }).success).toBe(true);
  });

  it("при изменении пустой пароль значит «не менять»", () => {
    const parsed = updateEmployeeSchema.parse({ ...base, password: "" });
    expect(parsed.password).toBeUndefined();
    expect(parsed.deskId).toBeNull();
  });

  it("роль администратора через форму выдать нельзя", () => {
    expect(createEmployeeSchema.safeParse({ ...base, role: "ADMIN", password: "long-enough" }).success).toBe(false);
  });
});

describe("password", () => {
  it("хранит хэш, а не пароль, и проверяет его", async () => {
    const hash = await hashPassword("secret-123");
    expect(hash).not.toContain("secret-123");
    expect(await verifyPassword("secret-123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
