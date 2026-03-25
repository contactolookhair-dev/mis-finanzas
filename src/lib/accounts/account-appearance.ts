export type AccountType = "CREDITO" | "DEBITO" | "EFECTIVO";
export type AccountAppearanceMode = "auto" | "manual";

export type AccountAppearanceInput = {
  name: string;
  bank?: string | null;
  type: AccountType;
  color?: string | null;
  icon?: string | null;
  appearanceMode?: AccountAppearanceMode | null;
};

type AccountPreset = {
  label: string;
  keywords: string[];
  color: string;
  icon: string;
};

export const INSTITUTION_PRESETS: AccountPreset[] = [
  { label: "Banco de Chile", keywords: ["banco de chile", "bch"], color: "#0039a6", icon: "🏦" },
  { label: "BancoEstado", keywords: ["bancoestado", "banco estado"], color: "#024e9c", icon: "🏛️" },
  { label: "Santander", keywords: ["santander"], color: "#da1212", icon: "🎯" },
  { label: "BCI", keywords: ["bci"], color: "#0057a0", icon: "🌐" },
  { label: "Scotiabank", keywords: ["scotiabank"], color: "#b21f24", icon: "🛡️" },
  { label: "Itau", keywords: ["itau", "itaú"], color: "#ff7c23", icon: "⚡" },
  { label: "Falabella", keywords: ["falabella"], color: "#5c2e91", icon: "💳" },
  { label: "MACH", keywords: ["mach"], color: "#6c63ff", icon: "📱" },
  { label: "Tenpo", keywords: ["tenpo"], color: "#0d9488", icon: "🧭" },
  { label: "Mercado Pago", keywords: ["mercado pago", "mercadopago"], color: "#009ee6", icon: "🛒" }
];

export const COLOR_PALETTE = [
  "#2563eb",
  "#0f766e",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b"
];

export const ICON_CATALOG = ["💳", "🏦", "💰", "🧾", "📱", "🌟"];

export const DEFAULT_ACCOUNT_ACCENT: Record<AccountType, string> = {
  CREDITO: "#9333ea",
  DEBITO: "#2563eb",
  EFECTIVO: "#f59e0b"
};

export function normalizeHexColor(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$/.test(withoutHash) && !/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
    return null;
  }
  const expanded = withoutHash.length === 3
    ? withoutHash.split("").map((char) => char + char).join("")
    : withoutHash;
  return `#${expanded.toLowerCase()}`;
}

export function hexToRgba(hex: string, alpha = 0.12) {
  const normalized = normalizeHexColor(hex) ?? "#cbd5f5";
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function detectInstitutionPreset(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (
    INSTITUTION_PRESETS.find((preset) =>
      preset.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

export function resolveAccountAppearance(account: AccountAppearanceInput) {
  const bankOrName = `${account.name} ${account.bank ?? ""}`;
  const looksLikeSavings = /ahorro|savings|saving/i.test(bankOrName);
  const matchedInstitution = detectInstitutionPreset(account.bank ?? account.name);
  const kind =
    account.type === "EFECTIVO"
      ? "EFECTIVO"
      : account.type === "CREDITO"
        ? "TARJETA"
        : looksLikeSavings
          ? "AHORRO"
          : "BANCO";

  const label = kind === "EFECTIVO" ? "Efectivo" : kind === "TARJETA" ? "Tarjeta" : kind === "AHORRO" ? "Ahorro" : "Banco";
  const glyph =
    account.icon?.trim() ||
    matchedInstitution?.icon ||
    (kind === "EFECTIVO" ? "💵" : kind === "TARJETA" ? "💳" : kind === "AHORRO" ? "🐷" : "🏦");

  const accentColor =
    normalizeHexColor(account.color) ??
    matchedInstitution?.color ??
    DEFAULT_ACCOUNT_ACCENT[account.type];

  return {
    kind,
    label,
    glyph,
    accentColor,
    accentBackground: hexToRgba(accentColor, 0.16),
    matchedInstitution,
    appearanceMode: account.appearanceMode ?? "manual",
    bankLabel: account.bank?.trim() || label
  };
}
