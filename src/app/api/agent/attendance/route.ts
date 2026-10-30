import { z } from "zod";
import { AgentError, attendanceSummary } from "@/lib/agent";
import { agentRoute, param } from "../handler";

// GET /api/agent/attendance?from=2026-10-19&to=2026-10-23 — сводка прихода и ухода за период.
export const GET = agentRoute(async (req) => {
  const from = param(req, "from") ?? "";
  const to = param(req, "to") ?? "";
  for (const date of [from, to]) if (!z.iso.date().safeParse(date).success) throw new AgentError("badDate", { date });
  return attendanceSummary(from, to);
});
