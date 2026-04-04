import { prisma } from "@/server/db/prisma";
import { authPrisma } from "@/server/db/auth-prisma";

type Args = {
  email?: string;
  userKey?: string;
  workspaceId?: string;
  role?: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  apply: boolean;
  makePrimary: boolean;
};

function readFlag(name: string) {
  return process.argv.includes(name);
}

function readValue(name: string) {
  const idx = process.argv.findIndex((item) => item === name);
  if (idx === -1) return undefined;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

function usage() {
  return `
Usage:
  npx tsx scripts/claim-legacy-workspace.ts --email you@gmail.com [--workspaceId <id>] [--apply] [--makePrimary]
  npx tsx scripts/claim-legacy-workspace.ts --userKey <authUserId> [--workspaceId <id>] [--apply] [--makePrimary]

Flags:
  --apply         Actually writes membership changes (default: dry-run)
  --makePrimary   Deactivates other memberships for this user so the claimed workspace becomes the default

Examples:
  npx tsx scripts/claim-legacy-workspace.ts --email you@gmail.com
  npx tsx scripts/claim-legacy-workspace.ts --email you@gmail.com --workspaceId <workspaceId> --apply --makePrimary
`.trim();
}

function toInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

async function resolveUserKey(args: Args) {
  if (args.userKey) return args.userKey;
  if (!args.email) return null;

  const user = await authPrisma.user.findUnique({
    where: { email: args.email.toLowerCase().trim() },
    select: { id: true, email: true, name: true }
  });
  if (!user) return null;

  console.log("[auth] resolved user", {
    id: user.id,
    email: user.email,
    name: user.name
  });

  return user.id;
}

async function listWorkspaceStats() {
  const workspaces = await prisma.workspace.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: {
        select: {
          accounts: true,
          transactions: true,
          debtors: true,
          payables: true,
          loans: true,
          reimbursements: true,
          importBatches: true,
          members: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const members = await prisma.workspaceMember.findMany({
    where: { isActive: true },
    select: { workspaceId: true, userKey: true, role: true, createdAt: true }
  });

  const membersByWorkspace = new Map<string, Array<{ userKey: string; role: string }>>();
  for (const m of members) {
    const list = membersByWorkspace.get(m.workspaceId) ?? [];
    list.push({ userKey: m.userKey, role: m.role });
    membersByWorkspace.set(m.workspaceId, list);
  }

  const scored = workspaces
    .map((w) => {
      const c = w._count;
      const score =
        toInt(c.transactions) * 5 +
        toInt(c.accounts) * 3 +
        toInt(c.debtors) * 2 +
        toInt(c.payables) * 2 +
        toInt(c.importBatches) * 2 +
        toInt(c.loans) * 1;

      const wsMembers = membersByWorkspace.get(w.id) ?? [];
      const hasDevUser = wsMembers.some((m) => m.userKey === "dev-user");
      const hasPublic = wsMembers.some((m) => m.userKey === "public");

      return {
        ...w,
        score,
        hasDevUser,
        hasPublic,
        members: wsMembers
      };
    })
    .sort((a, b) => b.score - a.score);

  console.log("\n[workspaces] candidates (sorted by score)\n");
  for (const w of scored.slice(0, 15)) {
    console.log({
      workspaceId: w.id,
      name: w.name,
      slug: w.slug,
      createdAt: w.createdAt.toISOString(),
      score: w.score,
      counts: w._count,
      flags: {
        hasDevUser: w.hasDevUser,
        hasPublic: w.hasPublic
      },
      members: w.members.slice(0, 6)
    });
  }

  const best = scored[0] ?? null;
  if (best) {
    console.log("\n[hint] top candidate workspaceId:", best.id, "name:", best.name, "\n");
  }

  return { scored };
}

async function main() {
  const args: Args = {
    email: readValue("--email"),
    userKey: readValue("--userKey"),
    workspaceId: readValue("--workspaceId"),
    role: (readValue("--role") as Args["role"]) ?? "OWNER",
    apply: readFlag("--apply"),
    makePrimary: readFlag("--makePrimary")
  };

  if (!args.email && !args.userKey) {
    console.error(usage());
    process.exit(1);
  }

  const userKey = await resolveUserKey(args);
  if (!userKey) {
    console.error("[auth] could not resolve userKey. Provide --userKey or a valid --email.");
    process.exit(1);
  }

  const { scored } = await listWorkspaceStats();

  if (!args.workspaceId) {
    console.log(
      "[next] Choose a workspaceId from the list above and re-run with --workspaceId <id> --apply (and optionally --makePrimary)."
    );
    return;
  }

  const target = scored.find((w) => w.id === args.workspaceId);
  if (!target) {
    console.error("[error] workspaceId not found in active workspaces:", args.workspaceId);
    process.exit(1);
  }

  const existing = await prisma.workspaceMember.findFirst({
    where: { workspaceId: args.workspaceId, userKey }
  });

  console.log("\n[plan]", {
    userKey,
    workspaceId: args.workspaceId,
    workspaceName: target.name,
    alreadyMember: Boolean(existing),
    role: args.role,
    apply: args.apply,
    makePrimary: args.makePrimary
  });

  if (!args.apply) {
    console.log("\n[dry-run] No changes applied. Re-run with --apply to write.\n");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userKey: {
          workspaceId: args.workspaceId!,
          userKey
        }
      },
      update: {
        isActive: true,
        role: args.role ?? "OWNER"
      },
      create: {
        workspaceId: args.workspaceId!,
        userKey,
        role: args.role ?? "OWNER",
        isActive: true
      }
    });

    if (args.makePrimary) {
      await tx.workspaceMember.updateMany({
        where: {
          userKey,
          workspaceId: { not: args.workspaceId! }
        },
        data: { isActive: false }
      });
    }
  });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userKey },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" }
  });

  console.log("\n[done] memberships for user\n");
  for (const m of memberships) {
    console.log({
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      workspaceSlug: m.workspace.slug,
      role: m.role,
      isActive: m.isActive
    });
  }

  console.log(
    "\n[validate]\n" +
      "1) In the app, open Configuracion and verify the workspace chips include the legacy workspace.\n" +
      "2) If you did not use --makePrimary, click the workspace chip to activate it.\n" +
      "3) Refresh /inicio and /cuentas: your old accounts/transactions should appear.\n"
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[fatal]", error);
    process.exit(1);
  });

