import type { PlanDesk, PlanImage, PlanZone } from "@/components/office/PlanCanvas";
import { db } from "./db";
import { PLAN_H, PLAN_W } from "./test-plan";

// Данные плана офиса для просмотра и редактора.
export async function loadOfficePlan(): Promise<{ plan: PlanImage | null; zones: PlanZone[]; desks: PlanDesk[] }> {
  const [plan, zones, desks] = await Promise.all([
    db.officePlan.findFirst({ orderBy: { createdAt: "desc" }, select: { width: true, height: true, updatedAt: true } }),
    db.zone.findMany({ orderBy: { createdAt: "asc" } }),
    db.desk.findMany({ orderBy: { code: "asc" }, include: { employee: true } }),
  ]);

  return {
    plan: plan && {
      url: `/api/office-plan/image?v=${plan.updatedAt.getTime()}`,
      width: plan.width || PLAN_W,
      height: plan.height || PLAN_H,
    },
    zones: zones.map(({ id, name, type, x, y, width, height }) => ({ id, name, type, x, y, width, height })),
    desks: desks.map((d) => ({
      id: d.id,
      code: d.code,
      pcNumber: d.pcNumber,
      x: d.x,
      y: d.y,
      employee:
        d.employee && d.employee.isActive
          ? { id: d.employee.id, name: `${d.employee.firstName} ${d.employee.lastName}`, status: d.employee.status }
          : null,
    })),
  };
}
