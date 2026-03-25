export type CreditCardMeta = {
  creditLimit?: number | null;
  closingDay?: number | null;
  paymentDay?: number | null;
};

export function computeCreditCardMetrics(input: { balance: number } & CreditCardMeta) {
  const debt = Math.max(0, -input.balance);
  const creditLimit = typeof input.creditLimit === "number" && Number.isFinite(input.creditLimit) ? input.creditLimit : null;
  const available = creditLimit !== null ? Math.max(0, creditLimit - debt) : null;
  const utilization =
    creditLimit !== null && creditLimit > 0 ? Math.max(0, Math.min(1, debt / creditLimit)) : null;

  return {
    debt,
    creditLimit,
    available,
    utilization
  };
}

