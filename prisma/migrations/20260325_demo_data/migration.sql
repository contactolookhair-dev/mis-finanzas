CREATE TABLE "DemoEntity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX "DemoEntity_workspaceId" ON "DemoEntity" ("workspaceId");
CREATE INDEX "DemoEntity_workspaceId_entityType" ON "DemoEntity" ("workspaceId", "entityType");

ALTER TABLE "DemoEntity"
ADD CONSTRAINT "DemoEntity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
