import { whereNow } from "@/lib/agent";
import { agentRoute } from "../handler";

// GET /api/agent/status — где сейчас все сотрудники и в каком статусе.
export const GET = agentRoute(async () => ({ people: await whereNow() }));
