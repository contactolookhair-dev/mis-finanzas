import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { authPrisma } from "@/server/db/auth-prisma";
import { ensurePersonalWorkspaceForUser } from "@/server/tenant/ensure-personal-workspace-for-user";

export const authOptions: NextAuthOptions = {
  // PrismaAdapter types are coupled to the default Prisma Client type.
  // We use a separate Prisma schema/client for auth to avoid name collisions with the finance "Account" model.
  // Runtime is safe: the adapter only touches User/Account/Session/VerificationToken from the auth client.
  adapter: PrismaAdapter(authPrisma as unknown as any),
  session: {
    strategy: "database"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Allows users who registered with email/password to later sign in with Google using the same email.
            // Without this, NextAuth can throw OAuthAccountNotLinked for the same Gmail.
            allowDangerousEmailAccountLinking: true
          })
        ]
      : []),
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await authPrisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, image: true, passwordHash: true }
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Ensure tenant exists for this user.
        await ensurePersonalWorkspaceForUser({
          userKey: user.id,
          displayName: user.name ?? user.email ?? null
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    }
  },
  events: {
    async createUser(message) {
      // When OAuth creates a new user, create/claim a workspace automatically.
      await ensurePersonalWorkspaceForUser({
        userKey: message.user.id,
        displayName: message.user.name ?? message.user.email ?? null
      });
    }
  }
};
