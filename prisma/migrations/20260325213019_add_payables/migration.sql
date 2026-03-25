-- DropForeignKey
ALTER TABLE "DemoEntity" DROP CONSTRAINT "DemoEntity_workspaceId_fkey";

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payable_workspaceId_dueDate_idx" ON "Payable"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "Payable_workspaceId_paidAt_idx" ON "Payable"("workspaceId", "paidAt");

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoEntity" ADD CONSTRAINT "DemoEntity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DemoEntity_workspaceId" RENAME TO "DemoEntity_workspaceId_idx";

-- RenameIndex
ALTER INDEX "DemoEntity_workspaceId_entityType" RENAME TO "DemoEntity_workspaceId_entityType_idx";
