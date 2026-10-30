import { z } from "zod";
import { AgentError, assignToFree } from "@/lib/agent";
import { agentRoute } from "../handler";

// POST /api/agent/assign { requestNumber, employee?, reassign? } — назначить заявку свободному сотруднику в офисе.
const body = z.object({
  requestNumber: z.number().int().positive(),
  employee: z.string().trim().min(2).max(80).optional(),
  reassign: z.boolean().optional(),
});

export const POST = agentRoute(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AgentError("badInput");
  return assignToFree(parsed.data);
});
