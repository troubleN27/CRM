import { findEmployee } from "@/lib/agent";
import { agentRoute, param } from "../handler";

// GET /api/agent/search?q=алиса — найти сотрудника по имени или фамилии.
export const GET = agentRoute(async (req) => ({ employees: await findEmployee(param(req, "q") ?? "") }));
