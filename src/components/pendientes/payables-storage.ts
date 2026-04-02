export type PayableStatus = "PAGADO" | "PROXIMO" | "VENCIDO";

export type PayableItem = {
  id: string;
  origin: string;
  amount: number;
  dueDate: string; // ISO string
  paidAt: string | null; // ISO string
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;

  // Optional installment context (when the payable was auto-generated from a credit-card transaction).
  isInstallmentPurchase?: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  installmentsRemaining?: number | null;
  installmentAmount?: number | null; // amount to pay now (this installment)
  purchaseTotalAmount?: number | null; // total of the purchase (best-effort)
};

export function derivePayableStatus(item: PayableItem, todayISO: string): PayableStatus {
  if (item.paidAt) return "PAGADO";
  const dueISO = item.dueDate.slice(0, 10); // YYYY-MM-DD
  if (dueISO < todayISO) return "VENCIDO";
  return "PROXIMO";
}

export function sumPayables(items: PayableItem[]) {
  return items.reduce((acc, item) => acc + Math.abs(item.amount), 0);
}

export function todayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
