import { AgentError, isAgent } from "@/lib/agent";

// Общая обёртка для /api/agent/*: проверка ключа и единый формат ошибок { error, details }.
export function agentRoute(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    if (!isAgent(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    try {
      return Response.json(await fn(req));
    } catch (e) {
      if (e instanceof AgentError) return Response.json({ error: e.code, details: e.details }, { status: e.status });
      console.error("agent api", e);
      return Response.json({ error: "internal" }, { status: 500 });
    }
  };
}

export function param(req: Request, name: string) {
  return new URL(req.url).searchParams.get(name);
}
