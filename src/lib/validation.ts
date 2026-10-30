import { z } from "zod";

// Логин: латиница в нижнем регистре, цифры, точка, дефис, подчёркивание.
export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "login");

export const passwordSchema = z.string().min(8, "password").max(128, "password");

export const signInSchema = z.object({
  login: loginSchema,
  password: z.string().min(1).max(128),
});

// Роли, которые админ может выдать через форму.
export const EDITABLE_ROLES = ["EMPLOYEE", "MANAGER"] as const;

const baseEmployee = {
  firstName: z.string().trim().min(1, "required").max(60),
  lastName: z.string().trim().min(1, "required").max(60),
  position: z.string().trim().min(1, "required").max(80),
  login: loginSchema,
  role: z.enum(EDITABLE_ROLES),
  deskId: z.string().trim().transform((v) => v || null),
};

export const createEmployeeSchema = z.object({
  ...baseEmployee,
  password: passwordSchema,
});

const optionalId = z.string().trim().transform((v) => v || null);

export const clientSchema = z.object({
  name: z.string().trim().min(1, "required").max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{5,25}$/, "phone"),
  address: z.string().trim().min(1, "required").max(200),
  // Точка обязательна: без клика по карте поля пустые.
  lat: z.string().min(1, "point").transform(Number).pipe(z.number().min(-90, "point").max(90, "point")),
  lng: z.string().min(1, "point").transform(Number).pipe(z.number().min(-180, "point").max(180, "point")),
});

export const requestSchema = z.object({
  clientId: z.string().trim().min(1, "required"),
  description: z.string().trim().min(1, "required").max(2000),
  assigneeId: optionalId,
  dueDate: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.iso.date("date").nullable()),
});

const fraction = z.number().min(0).max(1);

export const deskSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1, "required").max(10),
  pcNumber: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || null)
    .pipe(z.string().max(20).nullable()),
  x: fraction,
  y: fraction,
  employeeId: optionalId,
});

export const ZONE_TYPES = ["WORK", "MEETING", "KITCHEN", "OTHER"] as const;

export const zoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "required").max(60),
  type: z.enum(ZONE_TYPES),
  x: fraction,
  y: fraction,
  width: fraction.refine((v) => v > 0),
  height: fraction.refine((v) => v > 0),
});

// При изменении пароль можно не указывать — тогда он остаётся прежним.
export const updateEmployeeSchema = z.object({
  ...baseEmployee,
  password: z
    .string()
    .transform((v) => v || undefined)
    .pipe(passwordSchema.optional()),
});
