import { prisma } from "@/server/db/prisma";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function claimLegacyWorkspaceIfPresent(input: { userKey: string }) {
  const legacyUserKey = process.env.LEGACY_USER_KEY ?? "dev-user";
  if (!legacyUserKey || legacyUserKey === input.userKey) return null;

  const legacyMembership = await prisma.workspaceMember.findFirst({
    where: { userKey: legacyUserKey, isActive: true },
    orderBy: { createdAt: "asc" }
  });
  if (!legacyMembership) return null;

  // Only claim if the new user has no memberships yet.
  const existing = await prisma.workspaceMember.findFirst({
    where: { userKey: input.userKey, isActive: true }
  });
  if (existing) return null;

  await prisma.workspaceMember.updateMany({
    where: { userKey: legacyUserKey },
    data: { userKey: input.userKey }
  });

  return legacyMembership.workspaceId;
}

export async function ensurePersonalWorkspaceForUser(input: {
  userKey: string;
  displayName: string | null;
}) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userKey: input.userKey, isActive: true },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    return { workspaceId: existing.workspaceId, role: existing.role };
  }

  const claimedWorkspaceId = await claimLegacyWorkspaceIfPresent({ userKey: input.userKey });
  if (claimedWorkspaceId) {
    const claimed = await prisma.workspaceMember.findFirst({
      where: { userKey: input.userKey, workspaceId: claimedWorkspaceId, isActive: true }
    });
    if (claimed) return { workspaceId: claimed.workspaceId, role: claimed.role };
  }

  const name = input.displayName ? `${input.displayName}` : "Personal";
  const slugBase = input.displayName ? `personal-${slugify(input.displayName)}` : `personal-${input.userKey}`;
  const slug = `${slugBase}-${input.userKey.slice(0, 8)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      isActive: true
    },
    select: { id: true }
  });

  const membership = await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userKey: input.userKey,
      role: "OWNER",
      isActive: true
    },
    select: { workspaceId: true, role: true }
  });

  return membership;
}

