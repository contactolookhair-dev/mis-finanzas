type RawRow = Record<string, unknown>;

export type FalabellaCmrStatementMeta = {
  institution: "Banco Falabella";
  brand: "CMR";
  cardLabel: string;
  cardLast4?: string;
  billingPeriodStart?: string; // yyyy-MM-dd
  billingPeriodEnd?: string; // yyyy-MM-dd
  closingDate?: string; // yyyy-MM-dd
  paymentDate?: string; // yyyy-MM-dd
  totalBilled?: number;
  minimumDue?: number;
  creditLimit?: number;
  creditUsed?: number;
  creditAvailable?: number;
};

export type FalabellaCmrPdfParseResult = {
  meta: FalabellaCmrStatementMeta;
  rows: RawRow[];
  warnings: string[];
  headersForDetection: string[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseChileanAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = trimmed.includes("(") || trimmed.startsWith("-");
  const sanitized = trimmed.replace(/[$()\s-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized.replace(/\./g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function findFirstAmountOnLine(line: string) {
  const match = line.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/);
  return match ? parseChileanAmount(match[0]) : null;
}

function findAllAmountsOnLine(line: string) {
  const matches = line.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/g) ?? [];
  return matches.map((token) => parseChileanAmount(token)).filter((value): value is number => value !== null);
}

function parseDmy(value: string) {
  const normalized = value.trim().replace(/-/g, "/");
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function formatDmyWithYear(day: number, month: number, year: number) {
  const d = `${day}`.padStart(2, "0");
  const m = `${month}`.padStart(2, "0");
  return `${d}/${m}/${year}`;
}

function inferYearForDmy(params: {
  day: number;
  month: number;
  periodStart?: { year: number; month: number };
  periodEnd?: { year: number; month: number };
  fallbackYear: number;
}) {
  const { month, periodStart, periodEnd, fallbackYear } = params;
  if (!periodEnd) return fallbackYear;
  // Handles statements that cross year boundary (e.g. Dec -> Jan).
  if (periodStart && periodStart.year === periodEnd.year) {
    return periodEnd.year;
  }
  if (periodStart && periodStart.year === periodEnd.year - 1 && periodStart.month > periodEnd.month) {
    return month > periodEnd.month ? periodEnd.year - 1 : periodEnd.year;
  }
  return periodEnd.year;
}

function extractHeaderMeta(lines: string[]) {
  const joined = lines.slice(0, 120).join("\n");
  const normalized = normalizeText(joined);

  const meta: Partial<FalabellaCmrStatementMeta> = {
    institution: "Banco Falabella",
    brand: "CMR"
  };

  // Card last 4 digits.
  const last4Match =
    joined.match(/(?:\*{2,}|x{2,})\s*(\d{4})/i) ??
    joined.match(/\b(?:tarjeta|cmr)\s*(?:n(?:u|ú)m(?:ero)?\s*)?(\d{4})\b/i);
  if (last4Match?.[1]) {
    meta.cardLast4 = last4Match[1];
  }

  // Billing period
  const periodMatch =
    joined.match(
      /(?:periodo|per[ií]odo)\s*(?:facturado|facturacion|facturación)?\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}).{0,16}(?:al|hasta|-|a)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i
    ) ?? null;
  if (periodMatch?.[1] && periodMatch?.[2]) {
    const start = parseDmy(periodMatch[1]);
    const end = parseDmy(periodMatch[2]);
    if (start) meta.billingPeriodStart = start;
    if (end) meta.billingPeriodEnd = end;
  }

  // Closing / payment dates
  const closingMatch =
    joined.match(/fecha\s+de\s+cierre\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i) ?? null;
  if (closingMatch?.[1]) {
    const parsed = parseDmy(closingMatch[1]);
    if (parsed) meta.closingDate = parsed;
  }
  const paymentMatch =
    joined.match(/fecha\s+de\s+pago\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i) ?? null;
  if (paymentMatch?.[1]) {
    const parsed = parseDmy(paymentMatch[1]);
    if (parsed) meta.paymentDate = parsed;
  }

  // Totals
  for (const line of lines.slice(0, 160)) {
    const n = normalizeText(line);
    if (!meta.totalBilled && (n.includes("total facturado") || n.includes("monto facturado"))) {
      const amounts = findAllAmountsOnLine(line);
      if (amounts.length) meta.totalBilled = Math.abs(amounts[amounts.length - 1] ?? 0);
    }
    if (!meta.minimumDue && (n.includes("pago minimo") || n.includes("pago mínimo"))) {
      const amounts = findAllAmountsOnLine(line);
      if (amounts.length) meta.minimumDue = Math.abs(amounts[amounts.length - 1] ?? 0);
    }
    if (!meta.creditLimit && (n.includes("cupo total") || n.includes("linea de credito") || n.includes("línea de crédito"))) {
      const amount = findFirstAmountOnLine(line);
      if (typeof amount === "number") meta.creditLimit = Math.abs(amount);
    }
    if (!meta.creditUsed && (n.includes("cupo utilizado") || n.includes("usado"))) {
      const amount = findFirstAmountOnLine(line);
      if (typeof amount === "number") meta.creditUsed = Math.abs(amount);
    }
    if (!meta.creditAvailable && (n.includes("cupo disponible") || n.includes("disponible"))) {
      const amount = findFirstAmountOnLine(line);
      if (typeof amount === "number") meta.creditAvailable = Math.abs(amount);
    }
  }

  const cardLabel =
    normalized.includes("cmr") && normalized.includes("falabella")
      ? "Tarjeta CMR Falabella"
      : normalized.includes("falabella")
        ? "Tarjeta Falabella"
        : "Tarjeta CMR";
  meta.cardLabel = cardLabel;

  return meta as FalabellaCmrStatementMeta;
}

type SectionKind = "unknown" | "purchases" | "purchases_international" | "payments" | "refunds" | "installments";

function detectSection(line: string): SectionKind | null {
  const n = normalizeText(line);
  if (!n) return null;
  if (n.includes("compras nacionales") || n === "compras") return "purchases";
  if (n.includes("compras internacionales") || n.includes("compras int")) return "purchases_international";
  if (n.includes("pagos") || n.includes("abonos") || n.includes("pago y abonos") || n.includes("pagos y abonos")) {
    return "payments";
  }
  if (n.includes("devoluciones") || n.includes("reversa") || n.includes("reversion")) return "refunds";
  if (n.includes("compras en cuotas") || n.includes("cuotas")) return "installments";
  return null;
}

function parseMovementLine(line: string) {
  const trimmed = normalizeWhitespace(line);
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.+)$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearToken = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
  const rest = match[4] ?? "";

  const amounts = findAllAmountsOnLine(rest);
  if (!amounts.length) return null;
  const amount = Math.abs(amounts[amounts.length - 1] ?? 0);

  // Description is everything before last amount token.
  const tokens = rest.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/g) ?? [];
  let desc = rest;
  const lastToken = tokens[tokens.length - 1];
  if (lastToken) {
    const idx = rest.lastIndexOf(lastToken);
    if (idx >= 0) desc = rest.slice(0, idx);
  }
  const description = normalizeWhitespace(desc).replace(/\s{2,}/g, " ").trim();
  if (!description || description.length < 2) return null;

  return { day, month, yearToken, description, amount };
}

export function tryParseFalabellaCmrPdf(lines: string[]): FalabellaCmrPdfParseResult | null {
  const firstBlock = normalizeText(lines.slice(0, 120).join(" "));
  const isCmr = firstBlock.includes("cmr") && (firstBlock.includes("falabella") || firstBlock.includes("banco falabella"));
  const isStatement = firstBlock.includes("estado de cuenta") || firstBlock.includes("resumen") || firstBlock.includes("facturacion");
  if (!isCmr || !isStatement) return null;

  const meta = extractHeaderMeta(lines);
  const warnings: string[] = [];
  if (!meta.billingPeriodStart || !meta.billingPeriodEnd) {
    warnings.push("No se detectó con claridad el período facturado de la tarjeta; algunas fechas podrían requerir revisión.");
  }

  const periodStart = meta.billingPeriodStart ? new Date(`${meta.billingPeriodStart}T12:00:00`) : null;
  const periodEnd = meta.billingPeriodEnd ? new Date(`${meta.billingPeriodEnd}T12:00:00`) : null;
  const periodStartYM = periodStart ? { year: periodStart.getFullYear(), month: periodStart.getMonth() + 1 } : undefined;
  const periodEndYM = periodEnd ? { year: periodEnd.getFullYear(), month: periodEnd.getMonth() + 1 } : undefined;
  const fallbackYear = periodEndYM?.year ?? (meta.closingDate ? new Date(`${meta.closingDate}T12:00:00`).getFullYear() : new Date().getFullYear());

  let section: SectionKind = "unknown";
  const rows: RawRow[] = [];

  for (const line of lines) {
    const nextSection = detectSection(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }

    const movement = parseMovementLine(line);
    if (!movement) continue;

    const year =
      movement.yearToken ??
      inferYearForDmy({
        day: movement.day,
        month: movement.month,
        periodStart: periodStartYM,
        periodEnd: periodEndYM,
        fallbackYear
      });

    const fecha = formatDmyWithYear(movement.day, movement.month, year);
    const base: RawRow = {
      fecha,
      descripcion: movement.description,
      tarjeta: meta.cardLabel
    };

    if (section === "payments" || section === "refunds") {
      rows.push({
        ...base,
        abono: movement.amount,
        __cmrSection: section
      });
    } else {
      rows.push({
        ...base,
        cargo: movement.amount,
        __cmrSection: section
      });
    }
  }

  if (rows.length === 0) {
    return {
      meta,
      rows: [],
      warnings: [...warnings, "No se detectaron movimientos en el PDF de CMR/Falabella con el parser especializado."],
      headersForDetection: ["cmr", "banco falabella", "estado de cuenta"]
    };
  }

  return {
    meta,
    rows,
    warnings,
    headersForDetection: [
      "cmr",
      "banco falabella",
      "estado de cuenta",
      "compras nacionales",
      "compras internacionales",
      "pagos y abonos",
      "devoluciones",
      "compras en cuotas"
    ]
  };
}

