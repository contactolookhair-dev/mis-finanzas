"use client";

export type PayableStatus = "PAGADO" | "PROXIMO" | "VENCIDO";

export type PayableItem = {
  id: string;
  origin: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paidAt?: string | null; // YYYY-MM-DD
  notes?: string | null;
};

const STORAGE_KEY = "mis-finanzas.payables.v1";

function safeParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isPayableItem(value: unknown): value is PayableItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.origin === "string" &&
    typeof item.amount === "number" &&
    typeof item.dueDate === "string"
  );
}

export function readPayablesFromStorage(): PayableItem[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPayableItem);
}

export function writePayablesToStorage(items: PayableItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getPayablesStorageKey() {
  return STORAGE_KEY;
}

export function derivePayableStatus(item: PayableItem, todayISO: string): PayableStatus {
  if (item.paidAt) return "PAGADO";
  // ISO YYYY-MM-DD sorts lexicographically.
  if (item.dueDate < todayISO) return "VENCIDO";
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
