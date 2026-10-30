import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginRateLimiter } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/validation";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; employeeId: string; login: string } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    employeeId: string;
    login: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { login: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;

        const loginKey = parsed.data.login.trim().toLowerCase();
        const limit = loginRateLimiter.check(loginKey);
        if (!limit.allowed) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { login: parsed.data.login },
          include: { employee: true },
        });
        if (!user || !user.employee.isActive) return null;
        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;

        // При успешном входе сбрасываем лимит неудачных попыток
        loginRateLimiter.reset(loginKey);

        return {
          id: user.id,
          login: user.login,
          role: user.role,
          employeeId: user.employeeId,
          name: `${user.employee.firstName} ${user.employee.lastName}`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.login = user.login;
        return token;
      }
      // Каждый запрос сверяем с БД: удалённый или отключённый пользователь выходит,
      // а новая роль или имя действуют сразу, без повторного входа.
      const fresh = await db.user.findUnique({ where: { id: token.uid as string }, include: { employee: true } });
      if (!fresh || !fresh.employee.isActive) return null;
      token.role = fresh.role;
      token.employeeId = fresh.employeeId;
      token.login = fresh.login;
      token.name = `${fresh.employee.firstName} ${fresh.employee.lastName}`;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.user.employeeId = token.employeeId as string;
      session.user.login = token.login as string;
      return session;
    },
  },
});
