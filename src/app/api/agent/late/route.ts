import { z } from "zod";
import { AgentError, lateOn } from "@/lib/agent";
import { agentRoute, param } from "../handler";

// GET /api/agent/late?date=2026-10-26 — кто опоздал и на сколько минут (без даты — сегодня).
export const GET = agentRoute(async (req) => {
  const date = param(req, "date");
  if (date && !z.iso.date().safeParse(date).success) throw new AgentError("badDate", { date });
  return lateOn(date);
});
