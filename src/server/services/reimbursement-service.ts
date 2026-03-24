import { listReimbursements } from "@/server/repositories/reimbursement-repository";

export async function getReimbursementSummary(workspaceId: string) {
  const reimbursements = await listReimbursements(workspaceId);

  const byBusinessUnit = reimbursements.reduce<Record<string, number>>((acc, reimbursement) => {
    const key = reimbursement.businessUnit.name;
    const amount = Number(reimbursement.amount);
    acc[key] = (acc[key] ?? 0) + amount;
    return acc;
  }, {});

  const totalAmount = reimbursements.reduce((acc, reimbursement) => {
    return acc + Number(reimbursement.amount);
  }, 0);

  return {
    totalAmount,
    byBusinessUnit,
    count: reimbursements.length
  };
}
