type FingerprintInput = {
  date: Date;
  amount: number;
  description: string;
  sourceAccountName?: string | null;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildDuplicateFingerprint(input: FingerprintInput) {
  return [
    formatDate(input.date),
    Math.abs(input.amount),
    normalizeText(input.description),
    normalizeText(input.sourceAccountName ?? "sin-cuenta")
  ].join("|");
}

