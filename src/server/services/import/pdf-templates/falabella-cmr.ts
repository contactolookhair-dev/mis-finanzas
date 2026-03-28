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
  parserConfidence?: number; // 0..1
  parsedMovements?: number;
  dubiousMovements?: number;
  missingFields?: string[];
  aiFallbackRecommended?: boolean;
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
  if (periodStart && periodStart.year === periodEnd.year) {
    return periodEnd.year;
  }
  if (periodStart && periodStart.year === periodEnd.year - 1 && periodStart.month > periodEnd.month) {
    return month > periodEnd.month ? periodEnd.year - 1 : periodEnd.year;
  }
  return periodEnd.year;
}

function cleanInstallmentDescription(value: string) {
  return value
    .replace(/\(\s*\)/g, "")
    .replace(/\bcuota\b/gi, " ")
    .replace(/\bde\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInstallmentMetaFromDescription(description: string, amount?: number) {
  const raw = String(description ?? "").trim();

  const patterns = [
    /\(\s*cuota\s+(\d{1,2})\s+de\s+(\d{1,2})\s*\)/i,
    /\bcuota\s+(\d{1,2})\s+de\s+(\d{1,2})\b/i,
    /\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/i,
    /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;

    const cuotaActual = Number(match[1]);
    const cuotaTotal = Number(match[2]);

    if (!Number.isFinite(cuotaActual) || !Number.isFinite(cuotaTotal)) continue;
    if (cuotaActual < 1 || cuotaTotal < 1 || cuotaActual > cuotaTotal) continue;

    const descripcionBase = cleanInstallmentDescription(raw.replace(pattern, " "));

    const montoCuota =
      typeof amount === "number" && Number.isFinite(amount) ? Math.abs(amount) : null;
    const montoTotalCompra = montoCuota != null ? montoCuota * cuotaTotal : null;

    return {
      descripcionBase: descripcionBase || raw,
      esCompraEnCuotas: cuotaTotal > 1,
      cuotaActual,
      cuotaTotal,
      installments: cuotaTotal,
      installmentLabel: `${cuotaTotal} cuotas`,
      montoCuota,
      montoTotalCompra,
      cuotasRestantes: cuotaTotal - cuotaActual,
    };
  }

  return {
    descripcionBase: raw,
    esCompraEnCuotas: false,
    cuotaActual: null,
    cuotaTotal: null,
    installments: null,
    installmentLabel: null,
    montoCuota:
      typeof amount === "number" && Number.isFinite(amount) ? Math.abs(amount) : null,
    montoTotalCompra: null,
    cuotasRestantes: null,
  };
}

function extractInstallmentMeta(params: {
  description: string;
  fullLine?: string;
  amount?: number;
}) {
  const { description, fullLine = "", amount } = params;
  const fromDescription = extractInstallmentMetaFromDescription(description, amount);

  if (fromDescription.esCompraEnCuotas) {
    return fromDescription;
  }

  const rawFullLine = String(fullLine ?? "");
  const rawDescription = String(description ?? "").trim();

  const linePatterns = [
    /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/,
    /\bcuota\s+(\d{1,2})\s+de\s+(\d{1,2})\b/i,
  ];

  for (const pattern of linePatterns) {
    const match = rawFullLine.match(pattern);
    if (!match) continue;

    const cuotaActual = Number(match[1]);
    const cuotaTotal = Number(match[2]);

    if (!Number.isFinite(cuotaActual) || !Number.isFinite(cuotaTotal)) continue;
    if (cuotaActual < 1 || cuotaTotal < 1 || cuotaActual > cuotaTotal) continue;

    const montoCuota =
      typeof amount === "number" && Number.isFinite(amount) ? Math.abs(amount) : null;

    const allAmounts = findAllAmountsOnLine(rawFullLine).map((v) => Math.abs(v));
    const uniqueAmounts = Array.from(new Set(allAmounts)).sort((a, b) => a - b);

    let montoTotalCompra: number | null = null;
    if (montoCuota != null) {
      const largerAmounts = uniqueAmounts.filter((value) => value > montoCuota);
      if (largerAmounts.length > 0) {
        montoTotalCompra = largerAmounts[largerAmounts.length - 1] ?? null;
      } else if (cuotaTotal > 1) {
        montoTotalCompra = montoCuota * cuotaTotal;
      }
    }

    return {
      descripcionBase: rawDescription || "Movimiento",
      esCompraEnCuotas: cuotaTotal > 1,
      cuotaActual,
      cuotaTotal,
      installments: cuotaTotal,
      installmentLabel: `${cuotaTotal} cuotas`,
      montoCuota,
      montoTotalCompra,
      cuotasRestantes: cuotaTotal - cuotaActual,
    };
  }

  return {
    descripcionBase: rawDescription || "Movimiento",
    esCompraEnCuotas: false,
    cuotaActual: null,
    cuotaTotal: null,
    installments: null,
    installmentLabel: null,
    montoCuota:
      typeof amount === "number" && Number.isFinite(amount) ? Math.abs(amount) : null,
    montoTotalCompra: null,
    cuotasRestantes: null,
  };
}

function extractHeaderMeta(lines: string[]) {
  const joined = lines.slice(0, 120).join("\n");
  const normalized = normalizeText(joined);

  const meta: Partial<FalabellaCmrStatementMeta> = {
    institution: "Banco Falabella",
    brand: "CMR"
  };

  const last4Match =
    joined.match(/(?:\*{2,}|x{2,})\s*(\d{4})/i) ??
    joined.match(/\b(?:tarjeta|cmr)\s*(?:n(?:u|ú)m(?:ero)?\s*)?(\d{4})\b/i);
  if (last4Match?.[1]) {
    meta.cardLast4 = last4Match[1];
  }

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

type SectionKind =
  | "unknown"
  | "purchases"
  | "purchases_international"
  | "payments"
  | "refunds"
  | "installments";

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
  const specialMatch = trimmed.match(/^\s*(?:[A-Za-zÀ-ÿ\.\-\d\s]+?)?\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+T\s+([\d.]+)(?:\s|$)/i);
  if (specialMatch) {
    const [, dateStr, descriptionSegment, amountRaw] = specialMatch;
    const amount = Number(amountRaw.replace(/[.\s]/g, "")) || 0;
    const [dayStr, monthStr, yearStr] = dateStr.split("/");
    return {
      day: Number(dayStr),
      month: Number(monthStr),
      yearToken: Number(yearStr),
      description: descriptionSegment.trim(),
      amount,
      fecha: dateStr,
      descripcion: descriptionSegment.trim(),
      cargo: amount,
      abono: null,
    };
  }
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.+)$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearToken = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
  const rest = match[4] ?? "";

  const amounts = findAllAmountsOnLine(rest);
  if (!amounts.length) return null;

  const amount = Math.abs(amounts[amounts.length - 1] ?? 0);

  const tokens = rest.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/g) ?? [];
  let desc = rest;
  const lastToken = tokens[tokens.length - 1];
  if (lastToken) {
    const idx = rest.lastIndexOf(lastToken);
    if (idx >= 0) desc = rest.slice(0, idx);
  }

  let description = normalizeWhitespace(desc).replace(/\s{2,}/g, " ").trim();
  if (!description || description.length < 2) return null;

  description = description
    .replace(/\bT\b$/i, "")
    .replace(/\bT\b(?=\s)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!description || description.length < 2) return null;

  return { day, month, yearToken, description, amount };
}

type ClassifiedAs =
  | "purchase"
  | "installment_purchase"
  | "payment"
  | "refund"
  | "fee"
  | "interest"
  | "cash_advance"
  | "tax"
  | "insurance"
  | "unknown";

const KEYWORDS = {
  fee: ["comision", "comisión", "mantencion", "mantención", "administracion", "administración", "costo", "cargo"],
  interest: ["interes", "interés", "int.", "tasa", "mora", "moratorio"],
  cash_advance: ["avance", "giro", "cajero", "efectivo", "retiro"],
  tax: ["impuesto", "iva", "tasa", "gravamen"],
  insurance: ["seguro", "proteccion", "protección", "desgravamen", "fraude", "accidente"],
  installment: ["cuota", "cuotas"]
} as const;

function matchKeywords(description: string) {
  const n = normalizeText(description);
  const matched: string[] = [];
  Object.entries(KEYWORDS).forEach(([group, keywords]) => {
    keywords.forEach((kw) => {
      const nkw = normalizeText(kw);
      if (n.includes(nkw)) {
        matched.push(group);
      }
    });
  });
  return Array.from(new Set(matched));
}

function classifyMovement(params: { section: SectionKind; description: string }) {
  const { section, description } = params;
  const n = normalizeText(description);
  const matchedGroups = matchKeywords(description);

  if (matchedGroups.includes("interest")) return { classifiedAs: "interest" as const, matchedGroups };
  if (matchedGroups.includes("fee")) return { classifiedAs: "fee" as const, matchedGroups };
  if (matchedGroups.includes("insurance")) return { classifiedAs: "insurance" as const, matchedGroups };
  if (matchedGroups.includes("tax")) return { classifiedAs: "tax" as const, matchedGroups };
  if (matchedGroups.includes("cash_advance")) return { classifiedAs: "cash_advance" as const, matchedGroups };

  if (section === "payments") return { classifiedAs: "payment" as const, matchedGroups };
  if (section === "refunds") return { classifiedAs: "refund" as const, matchedGroups };

  const installmentPattern = /\b\d{1,3}\/\d{1,3}\b/.test(n) || matchedGroups.includes("installment");
  if (section === "installments" || installmentPattern) {
    return { classifiedAs: "installment_purchase" as const, matchedGroups };
  }

  if (section === "purchases" || section === "purchases_international") {
    return { classifiedAs: "purchase" as const, matchedGroups };
  }

  return { classifiedAs: "unknown" as const, matchedGroups };
}

function computeMovementConfidence(params: {
  section: SectionKind;
  classifiedAs: ClassifiedAs;
  matchedGroups: string[];
}) {
  const { section, classifiedAs, matchedGroups } = params;
  let confidence = 0.55;
  if (section !== "unknown") confidence += 0.15;
  if (classifiedAs !== "unknown") confidence += 0.15;
  if (matchedGroups.length > 0) confidence += 0.1;
  if (classifiedAs === "installment_purchase" && section === "installments") confidence += 0.05;
  return Math.max(0, Math.min(0.98, confidence));
}

export function tryParseFalabellaCmrPdf(lines: string[]): FalabellaCmrPdfParseResult | null {
  const firstBlock = normalizeText(lines.slice(0, 120).join(" "));
  const isCmr =
    firstBlock.includes("cmr") &&
    (firstBlock.includes("falabella") || firstBlock.includes("banco falabella"));
  const isStatement =
    firstBlock.includes("estado de cuenta") ||
    firstBlock.includes("resumen") ||
    firstBlock.includes("facturacion");

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
  const fallbackYear =
    periodEndYM?.year ??
    (meta.closingDate
      ? new Date(`${meta.closingDate}T12:00:00`).getFullYear()
      : new Date().getFullYear());

  let section: SectionKind = "unknown";
  const rows: RawRow[] = [];
  const dubious: Array<{ rawLine: string; reason: string }> = [];
  const unparsedCandidates: string[] = [];
  let pending: string | null = null;

  for (const line of lines) {
    const nextSection = detectSection(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }

    const normalizedLine = normalizeWhitespace(line);
    const mergedCandidate = pending ? normalizeWhitespace(`${pending} ${normalizedLine}`) : null;

    let movement = parseMovementLine(normalizedLine);
    let rawLine = normalizedLine;

    if (!movement && mergedCandidate) {
      movement = parseMovementLine(mergedCandidate);
      if (movement) rawLine = mergedCandidate;
    }

    if (!movement) {
      const hasAmount =
        /\d{1,3}(?:[.\s]\d{3})+/.test(normalizedLine) || /\$\s*\d+/.test(normalizedLine);
      const looksLikeMaybeMovement =
        hasAmount && section !== "unknown" && normalizedLine.length >= 10;

      if (looksLikeMaybeMovement) {
        unparsedCandidates.push(normalizedLine);
      }

      if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s+/.test(normalizedLine) && !hasAmount) {
        pending = normalizedLine;
      } else {
        pending = null;
      }
      continue;
    }

    pending = null;

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

    const { classifiedAs, matchedGroups } = classifyMovement({
      section,
      description: movement.description
    });
    const confidence = computeMovementConfidence({ section, classifiedAs, matchedGroups });

    const dubiousReasons: string[] = [];
    if (section === "unknown") dubiousReasons.push("Fuera de sección reconocida");
    if (classifiedAs === "unknown") dubiousReasons.push("Concepto ambiguo");
    if (confidence < 0.65) dubiousReasons.push("Baja confianza");

    const isDubious = dubiousReasons.length > 0;
    if (isDubious) {
      dubious.push({ rawLine, reason: dubiousReasons[0] ?? "Dudosa" });
    }

    const installment = extractInstallmentMeta({
      description: movement.description,
      fullLine: rawLine,
      amount: movement.amount
    });

    const base: RawRow = {
      fecha,
      descripcion: installment.descripcionBase,
      descripcionBase: installment.descripcionBase,
      esCompraEnCuotas: installment.esCompraEnCuotas,
      cuotaActual: installment.cuotaActual,
      cuotaTotal: installment.cuotaTotal,
      installments: installment.installments,
      installmentLabel: installment.installmentLabel,
      montoCuota: installment.montoCuota,
      montoTotalCompra: installment.montoTotalCompra,
      cuotasRestantes: installment.cuotasRestantes,
      tarjeta: meta.cardLabel,
      __cmrClassifiedAs: classifiedAs,
      __cmrMatchedSection: section,
      __cmrMatchedKeywords: matchedGroups,
      __cmrConfidence: confidence,
      __cmrRawLine: rawLine,
      __cmrDubious: isDubious,
      __cmrDubiousReasons: dubiousReasons
    };

    const isCreditLike =
      section === "payments" ||
      section === "refunds" ||
      classifiedAs === "payment" ||
      classifiedAs === "refund";

    if (isCreditLike) {
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

  const missingFields: string[] = [];
  if (!meta.billingPeriodStart || !meta.billingPeriodEnd) missingFields.push("período");
  if (!meta.closingDate) missingFields.push("fecha de cierre");
  if (!meta.paymentDate) missingFields.push("fecha de pago");
  if (typeof meta.totalBilled !== "number") missingFields.push("total facturado");
  if (typeof meta.minimumDue !== "number") missingFields.push("pago mínimo");
  if (typeof meta.creditLimit !== "number") missingFields.push("cupo total");
  if (typeof meta.creditUsed !== "number") missingFields.push("cupo usado");
  if (typeof meta.creditAvailable !== "number") missingFields.push("cupo disponible");

  if (
    typeof meta.creditLimit === "number" &&
    typeof meta.creditUsed === "number" &&
    typeof meta.creditAvailable === "number"
  ) {
    const sum = meta.creditUsed + meta.creditAvailable;
    const diff = Math.abs(sum - meta.creditLimit);
    if (diff > Math.max(2000, meta.creditLimit * 0.02)) {
      warnings.push("El cupo total no cuadra con cupo usado + disponible. Revisa los campos detectados.");
    }
  }

  if (missingFields.length > 0) {
    warnings.push(`Faltan campos del resumen del estado de cuenta: ${missingFields.join(", ")}.`);
  }

  if (unparsedCandidates.length > 0) {
    warnings.push(`Se detectaron ${unparsedCandidates.length} líneas con montos que no se pudieron interpretar automáticamente.`);
  }

  const parsedMovements = rows.length;
  const dubiousMovements = rows.filter((row) => Boolean((row as Record<string, unknown>).__cmrDubious)).length;
  const confidence =
    parsedMovements === 0
      ? 0
      : Math.max(0.1, Math.min(0.98, 1 - dubiousMovements / Math.max(1, parsedMovements)));

  meta.parsedMovements = parsedMovements;
  meta.dubiousMovements = dubiousMovements;
  meta.missingFields = missingFields;
  meta.parserConfidence = confidence;
  meta.aiFallbackRecommended =
    confidence < 0.6 || dubiousMovements / Math.max(1, parsedMovements) > 0.25;

  if (rows.length === 0) {
    return {
      meta,
      rows: [],
      warnings: [
        ...warnings,
        "No se detectaron movimientos en el PDF de CMR/Falabella con el parser especializado."
      ],
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
