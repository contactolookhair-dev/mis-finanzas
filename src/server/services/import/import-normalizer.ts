import type { ImportPreviewRow } from "@/shared/types/imports";
import type { ImportTemplate } from "@/shared/types/import-templates";
import { buildDuplicateFingerprint } from "@/server/services/import/import-fingerprint";

type RawSheetRow = Record<string, unknown>;

const DATE_ALIASES = [
  "fecha",
  "fecha transaccion",
  "fecha movimiento",
  "transaction date",
  "posting date",
  "date"
];
const DESCRIPTION_ALIASES = [
  "descripcion",
  "descripción",
  "glosa",
  "detalle",
  "concepto",
  "memo",
  "descripcion movimiento",
  "description",
  "comercio"
];
const AMOUNT_ALIASES = ["monto", "importe", "amount", "valor", "total"];
const DEBIT_ALIASES = ["cargo", "debito", "débito", "debit", "egreso"];
const CREDIT_ALIASES = ["abono", "credito", "crédito", "credit", "ingreso"];
const TYPE_ALIASES = ["tipo", "tipo movimiento", "movement type", "nature"];
const BALANCE_ALIASES = ["saldo", "balance", "available balance"];
const ACCOUNT_ALIASES = ["cuenta", "account", "producto", "origen", "tarjeta", "medio de pago"];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getValueFromAliases(row: RawSheetRow, aliases: string[]) {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) {
      return value;
    }
  }

  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key);
    if (aliases.some((alias) => normalized.includes(alias))) {
      return value;
    }
  }

  return undefined;
}

function getValueFromTemplateColumns(
  row: RawSheetRow,
  aliases: string[],
  fallbackAliases: string[]
) {
  // Try template-provided aliases first, but never block extraction completely:
  // if the template doesn't match the actual parsed row shape, fall back to standard aliases.
  const primary = aliases.length > 0 ? getValueFromAliases(row, aliases) : undefined;
  if (primary !== undefined) return primary;
  return getValueFromAliases(row, fallbackAliases);
}

function buildDateFromParts(year: number, month: number, day: number) {
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
}

function parseDateByFormat(value: string, format: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (format === "dd/MM/yyyy") {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return buildDateFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  if (format === "dd-MM-yyyy") {
    const match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    return buildDateFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  if (format === "yyyy-MM-dd") {
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    return buildDateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  return null;
}

function parseDateValue(value: unknown, preferredFormats: string[] = []): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "number" && value > 20000 && value < 60000) {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  for (const format of preferredFormats) {
    const parsedPreferred = parseDateByFormat(trimmed, format);
    if (parsedPreferred) {
      return parsedPreferred;
    }
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    return new Date(year, month, day);
  }

  const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

function parseAmountValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative = trimmed.includes("(") && trimmed.includes(")");
  let normalized = trimmed.replace(/[()$\s]/g, "");

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    const commaGroups = normalized.split(",");
    normalized =
      commaGroups[commaGroups.length - 1]?.length === 3
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
  } else if (hasDot) {
    const dotGroups = normalized.split(".");
    if (dotGroups[dotGroups.length - 1]?.length === 3 && dotGroups.length > 1) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

function inferTypeFromText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeHeader(value);
  if (
    normalized.includes("cargo") ||
    normalized.includes("debito") ||
    normalized.includes("egreso") ||
    normalized.includes("compra")
  ) {
    return "EGRESO" as const;
  }
  if (
    normalized.includes("abono") ||
    normalized.includes("credito") ||
    normalized.includes("ingreso") ||
    normalized.includes("deposito")
  ) {
    return "INGRESO" as const;
  }
  return undefined;
}

function formatDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type NormalizeInput = {
  rows: RawSheetRow[];
  accountLookup: Map<string, string>;
  template?: ImportTemplate | null;
};

export function normalizeImportedRows(input: NormalizeInput): ImportPreviewRow[] {
  return input.rows.map((row, index) => {
    const issues: string[] = [];
    const template = input.template ?? null;

    const rawRow = row as Record<string, unknown>;
    const parserMeta =
      typeof rawRow.__cmrClassifiedAs === "string"
        ? {
            kind: "falabella-cmr",
            classifiedAs: rawRow.__cmrClassifiedAs as string,
            section: typeof rawRow.__cmrMatchedSection === "string" ? (rawRow.__cmrMatchedSection as string) : undefined,
            keywords: Array.isArray(rawRow.__cmrMatchedKeywords)
              ? (rawRow.__cmrMatchedKeywords as unknown[]).filter((v): v is string => typeof v === "string")
              : undefined,
            confidence:
              typeof rawRow.__cmrConfidence === "number" && Number.isFinite(rawRow.__cmrConfidence)
                ? (rawRow.__cmrConfidence as number)
                : undefined,
            rawLine: typeof rawRow.__cmrRawLine === "string" ? (rawRow.__cmrRawLine as string) : undefined,
            dubious: rawRow.__cmrDubious === true,
            dubiousReasons: Array.isArray(rawRow.__cmrDubiousReasons)
              ? (rawRow.__cmrDubiousReasons as unknown[]).filter((v): v is string => typeof v === "string")
              : undefined
          }
        : typeof rawRow.__aiKind === "string"
          ? {
              kind: rawRow.__aiKind as string,
              classifiedAs: typeof rawRow.__aiType === "string" ? (rawRow.__aiType as string) : undefined,
              confidence:
                typeof rawRow.__aiConfidence === "number" && Number.isFinite(rawRow.__aiConfidence)
                  ? (rawRow.__aiConfidence as number)
                  : undefined,
              rawLine: typeof rawRow.__aiRaw === "string" ? (rawRow.__aiRaw as string) : undefined,
              dubious: rawRow.__aiNeedsReview === true,
              dubiousReasons: rawRow.__aiNeedsReview === true ? ["Marcado para revisión por IA"] : undefined
            }
          : undefined;

    const parsedDate = parseDateValue(
      getValueFromTemplateColumns(row, template?.columns.date ?? [], DATE_ALIASES),
      template?.dateFormats ?? []
    );
    const descriptionRaw = getValueFromTemplateColumns(
      row,
      template?.columns.description ?? [],
      DESCRIPTION_ALIASES
    );
    const amountRaw = getValueFromTemplateColumns(row, template?.columns.amount ?? [], AMOUNT_ALIASES);
    const debitRaw = getValueFromTemplateColumns(row, template?.columns.debit ?? [], DEBIT_ALIASES);
    const creditRaw = getValueFromTemplateColumns(row, template?.columns.credit ?? [], CREDIT_ALIASES);
    const typeRaw = getValueFromTemplateColumns(row, template?.columns.type ?? [], TYPE_ALIASES);
    const balanceRaw = getValueFromTemplateColumns(row, template?.columns.balance ?? [], BALANCE_ALIASES);
    const sourceAccountRaw = getValueFromTemplateColumns(
      row,
      template?.columns.sourceAccountName ?? [],
      ACCOUNT_ALIASES
    );

    const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";
    const sourceAccountName =
      typeof sourceAccountRaw === "string" && sourceAccountRaw.trim()
        ? sourceAccountRaw.trim()
        : undefined;

    let amount = parseAmountValue(amountRaw);
    const debitAmount = parseAmountValue(debitRaw);
    const creditAmount = parseAmountValue(creditRaw);
    const explicitType = inferTypeFromText(typeRaw);

    if (amount === null || template?.amountMode === "SEPARATE_DEBIT_CREDIT") {
      if (debitAmount !== null && Math.abs(debitAmount) > 0) {
        amount = -Math.abs(debitAmount);
      } else if (creditAmount !== null && Math.abs(creditAmount) > 0) {
        amount = Math.abs(creditAmount);
      }
    }

    let type = explicitType;
    if (!type && typeof amount === "number") {
      type = amount < 0 ? "EGRESO" : "INGRESO";
    }

    if (typeof amount === "number" && type === "EGRESO") {
      amount = -Math.abs(amount);
    }
    if (typeof amount === "number" && type === "INGRESO") {
      amount = Math.abs(amount);
    }

    const balance = parseAmountValue(balanceRaw);
    const accountId = sourceAccountName
      ? input.accountLookup.get(normalizeHeader(sourceAccountName))
      : undefined;

    if (!parsedDate) issues.push("Fecha no reconocida");
    if (!description) issues.push("Descripcion vacia");
    if (amount === null) issues.push("Monto no reconocido");
    if (!type) issues.push("Tipo no reconocido");

    const duplicateFingerprint =
      parsedDate && description && amount !== null
        ? buildDuplicateFingerprint({
            date: parsedDate,
            amount,
            description,
            sourceAccountName
          })
        : undefined;

    return {
      id: `row-${index + 1}`,
      rowNumber: index + 1,
      date: parsedDate ? formatDateForInput(parsedDate) : undefined,
      description,
      amount: amount ?? undefined,
      type,
      balance,
      sourceAccountName,
      accountId,
      financialOrigin: "PERSONAL",
      isReimbursable: false,
      isBusinessPaidPersonally: false,
      duplicateFingerprint,
      duplicateStatus: "none",
      suggestionMeta: {},
      issues,
      include: issues.length === 0,
      parserMeta,
      rawValues: row,
      cuotaActual: typeof rawRow.cuotaActual === "number" ? rawRow.cuotaActual : undefined,
      cuotaTotal: typeof rawRow.cuotaTotal === "number" ? rawRow.cuotaTotal : undefined,
      montoCuota: typeof rawRow.montoCuota === "number" ? rawRow.montoCuota : undefined,
      montoTotalCompra: typeof rawRow.montoTotalCompra === "number" ? rawRow.montoTotalCompra : undefined,
      cuotasRestantes: typeof rawRow.cuotasRestantes === "number" ? rawRow.cuotasRestantes : undefined,
      descripcionBase: typeof rawRow.descripcionBase === "string" ? rawRow.descripcionBase : undefined,
      esCompraEnCuotas: rawRow.esCompraEnCuotas === true,
      installments: typeof rawRow.installments === "number" ? rawRow.installments : undefined,
      installmentLabel: typeof rawRow.installmentLabel === "string" ? rawRow.installmentLabel : undefined,
      currentInstallment: typeof rawRow.currentInstallment === "number" ? rawRow.currentInstallment : undefined,
      totalInstallments: typeof rawRow.totalInstallments === "number" ? rawRow.totalInstallments : undefined,
      installmentAmount: typeof rawRow.installmentAmount === "number" ? rawRow.installmentAmount : undefined,
      totalPurchaseAmount:
        typeof rawRow.totalPurchaseAmount === "number" ? rawRow.totalPurchaseAmount : undefined,
      remainingInstallments:
        typeof rawRow.remainingInstallments === "number" ? rawRow.remainingInstallments : undefined
    };
  });
}
