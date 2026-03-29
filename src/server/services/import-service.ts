import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { listAccounts } from "@/server/repositories/account-repository";
import { listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { listCategories } from "@/server/repositories/category-repository";
import { createAdminAuditLog } from "@/server/repositories/admin-audit-repository";
import { findTransactionsByFingerprints } from "@/server/repositories/transaction-repository";
import { createTransactionWithAutomation } from "@/server/services/transaction-service";
import { buildDuplicateFingerprint } from "@/server/services/import/import-fingerprint";
import { importCommitPayloadSchema, type ImportPreviewRow } from "@/shared/types/imports";
import { DebtorStatus, ExpenseFrequency } from "@prisma/client";
import { randomUUID } from "crypto";

function normalizeLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function getImportReferenceData(workspaceId: string) {
  const [categories, businessUnits, accounts] = await Promise.all([
    listCategories(workspaceId),
    listBusinessUnits(workspaceId),
    listAccounts(workspaceId)
  ]);

  return {
    categories: categories.map((item) => ({ id: item.id, name: item.name, type: item.type })),
    businessUnits: businessUnits.map((item) => ({ id: item.id, name: item.name, type: item.type })),
    accounts: accounts.map((item) => ({
      id: item.id,
      name: item.name,
      institution: item.institution,
      type: item.type
    }))
  };
}

function markDuplicateStatuses(rows: ImportPreviewRow[], existingFingerprints: Set<string>) {
  const seenFingerprints = new Set<string>();

  return rows.map((row) => {
    if (!row.duplicateFingerprint) {
      return row;
    }

    if (existingFingerprints.has(row.duplicateFingerprint)) {
      return {
        ...row,
        duplicateStatus: "existing" as const,
        include: false,
        issues: [...row.issues, "Movimiento ya existe en este workspace"]
      };
    }

    if (seenFingerprints.has(row.duplicateFingerprint)) {
      return {
        ...row,
        duplicateStatus: "batch" as const,
        include: false,
        issues: [...row.issues, "Movimiento repetido dentro del archivo"]
      };
    }

    seenFingerprints.add(row.duplicateFingerprint);
    return row;
  });
}

export async function previewImportFile(input: {
  workspaceId: string;
  userKey?: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  selectedTemplateId?: string;
  preferredAccountId?: string;
  preferredImportType?: "account" | "credit";
}) {
  console.log("previewImportFile start", {
    workspaceId: input.workspaceId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    selectedTemplateId: input.selectedTemplateId ?? null,
    preferredAccountId: input.preferredAccountId ?? null,
    preferredImportType: input.preferredImportType ?? null
  });

  const [
    { normalizeImportedRows },
    { detectImportTemplate },
    { listWorkspaceAwareImportTemplates },
    { applyClassificationSuggestions, getClassificationEngineContext }
  ] = await Promise.all([
    import("@/server/services/import/import-normalizer"),
    import("@/server/services/import/import-template-detection"),
    import("@/server/services/import/import-template-service"),
    import("@/server/services/classification-service")
  ]);

  const buildMinimalPreviewRows = (rawRows: Array<Record<string, unknown>>): ImportPreviewRow[] => {
    const pickString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const pickNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

    return rawRows.map((raw, index) => {
      const date =
        pickString(raw.date) ||
        pickString(raw.fecha) ||
        pickString(raw.Date) ||
        pickString(raw.Fecha) ||
        undefined;

      const description =
        pickString(raw.description) ||
        pickString(raw.descripcion) ||
        pickString(raw.Descripcion) ||
        pickString(raw.raw) ||
        JSON.stringify(raw);

      const cargo = pickNumber(raw.cargo);
      const abono = pickNumber(raw.abono);
      const amountCandidate =
        pickNumber(raw.amount) ??
        pickNumber(raw.monto) ??
        (typeof cargo === "number" ? cargo : undefined) ??
        (typeof abono === "number" ? abono : undefined);

      const amount = typeof amountCandidate === "number" ? Math.abs(amountCandidate) : undefined;
      const type =
        typeof cargo === "number"
          ? ("EGRESO" as const)
          : typeof abono === "number"
            ? ("INGRESO" as const)
            : typeof amountCandidate === "number"
              ? amountCandidate < 0
                ? ("EGRESO" as const)
                : ("INGRESO" as const)
              : undefined;

      return {
        id: randomUUID(),
        rowNumber: index + 1,
        date,
        description,
        amount,
        type,
        rawValues: raw,
        issues: [],
        include: true,
        financialOrigin: "PERSONAL",
        isReimbursable: false,
        isBusinessPaidPersonally: false,
        duplicateStatus: "none",
        suggestionMeta: {}
      };
    });
  };

  const looksLikePdf =
    input.fileName.toLowerCase().endsWith(".pdf") ||
    input.mimeType.toLowerCase().includes("pdf") ||
    (input.bytes.length >= 5 &&
      input.bytes[0] === 0x25 &&
      input.bytes[1] === 0x50 &&
      input.bytes[2] === 0x44 &&
      input.bytes[3] === 0x46 &&
      input.bytes[4] === 0x2d);

  let parsed:
    | Awaited<ReturnType<(typeof import("@/server/services/import/import-parser"))["parseImportFile"]>>
    | null = null;

  if (looksLikePdf) {
    const { extractPdfTextFromBytes } = await import("@/server/services/import/pdf-text-extractor");
    const extraction = await extractPdfTextFromBytes(input.bytes);

    if (!extraction.ok) {
      parsed = {
        parser: "pdf",
        rows: [],
        headers: [],
        warnings: [extraction.message],
        supported: false
      };
    } else {
      const rawText = extraction.text;
      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 0);

      // Always build a fallback row list from text so the UI can show something editable
      // even when IA/template parsing fails.
      const extractDate = (value: string) => {
        const match = value.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
        return match?.[1] ?? null;
      };

      const parseChileanAmountToken = (token: string) => {
        const trimmed = token.trim();
        if (!trimmed) return null;
        const negative = trimmed.includes("(") || trimmed.startsWith("-");
        const sanitized = trimmed.replace(/[$()\s-]/g, "");
        const normalized = sanitized.includes(",")
          ? sanitized.replace(/\./g, "").replace(",", ".")
          : sanitized.replace(/\./g, "");
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return null;
        return negative ? -Math.abs(parsed) : parsed;
      };

      const extractAmount = (value: string) => {
        // Prefer "money-looking" tokens. Avoid capturing day/month numbers from dates.
        const candidates: Array<{ token: string; parsed: number }> = [];

        // Primary: numbers with thousand separators (CLP style) e.g. 5.140.163, 30.000, (18.990), -1.200
        const moneyLike = /-?\$?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\)?/g;
        for (const match of value.matchAll(moneyLike)) {
          const token = match[0];
          const parsed = parseChileanAmountToken(token);
          if (typeof parsed === "number") candidates.push({ token, parsed });
        }

        // Secondary: long digit sequences (>= 4 digits) without separators (some banks export like 25140)
        if (candidates.length === 0) {
          const longDigits = /-?\$?\(?\d{4,}(?:,\d{1,2})?\)?/g;
          for (const match of value.matchAll(longDigits)) {
            const token = match[0];
            const parsed = parseChileanAmountToken(token);
            if (typeof parsed === "number") candidates.push({ token, parsed });
          }
        }

        if (candidates.length === 0) return null;
        // Choose the largest absolute value (usually the amount vs. codes).
        candidates.sort((a, b) => Math.abs(b.parsed) - Math.abs(a.parsed));
        return candidates[0]!.parsed;
      };

      const extractInstallment = (value: string) => {
        // Detect installments like 03/06, 10/12, 4/12. Avoid matching dates (dd/mm/yyyy).
        const rx = /\b(\d{1,2})\/(\d{1,2})\b(?!\/\d{4})/g;
        const matches = Array.from(value.matchAll(rx));
        if (matches.length === 0) return null;
        // Use the last match (often the installment is near the end of the line).
        const last = matches[matches.length - 1]!;
        const current = Number(last[1]);
        const total = Number(last[2]);
        if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) return null;
        // Treat 01/01 as "no cuotas" unless we have clear evidence otherwise.
        if (current === 1 && total === 1) return null;
        return {
          cuotaActual: current,
          cuotaTotal: total,
          installments: total,
          installmentLabel: `${String(current).padStart(2, "0")}/${String(total).padStart(2, "0")}`
        };
      };

      const inferDirection = (value: string, amount: number | null) => {
        const lower = value.toLowerCase();
        if (typeof amount === "number" && amount < 0) return "credit" as const;
        if (lower.includes("abono") || lower.includes("pago") || lower.includes("devoluc")) return "credit" as const;
        return "debit" as const;
      };

      const extractDescription = (line: string, date: string | null) => {
        const cityBlacklist = new Set([
          "santiago",
          "las condes",
          "providencia",
          "nunoa",
          "ñuñoa",
          "vitacura",
          "la florida",
          "puente alto",
          "maipu",
          "maipú",
          "valparaiso",
          "valparaíso",
          "vina del mar",
          "viña del mar",
          "concepcion",
          "concepción",
          "rancagua",
          "temuco",
          "antofagasta"
        ]);

        if (!date) return line;
        const dateMatch = line.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
        if (!dateMatch || dateMatch.index == null) return line;

        const prefix = line.slice(0, dateMatch.index).trim();
        const afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();

        const dropPrefix =
          prefix.length > 0 &&
          prefix.length <= 30 &&
          !/\d/.test(prefix) &&
          cityBlacklist.has(prefix.toLowerCase());

        const rest = dropPrefix ? afterDate : `${prefix} ${afterDate}`.trim();

        const markerIndex = rest.indexOf(" T ");
        if (markerIndex >= 0) {
          return rest.slice(0, markerIndex).replace(/\s+/g, " ").trim();
        }

        // Otherwise take text up to the first money-like token
        const moneyLike = rest.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\)?/);
        if (moneyLike && moneyLike.index != null) {
          return rest.slice(0, moneyLike.index).replace(/\s+/g, " ").trim();
        }

        return rest.replace(/\s+/g, " ").trim();
      };

      const cleanedLines = lines.map((l) => l.trim()).filter(Boolean);
      const meaningfulLines = cleanedLines.filter((l) => l.length > 5);
      const fallbackLines = meaningfulLines.length > 0 ? meaningfulLines : cleanedLines;
      const ensuredLines =
        fallbackLines.length > 0
          ? fallbackLines
          : rawText.trim().length > 0
            ? [rawText.trim().slice(0, 400)]
            : [];

      const rowsFallback = ensuredLines.map((line, index) => {
        const date = extractDate(line);
        const amount = extractAmount(line);
        const installment = extractInstallment(line);
        const direction = inferDirection(line, amount);
        const description = extractDescription(line, date);

        const absAmount = typeof amount === "number" ? Math.abs(amount) : null;
        const cargo = direction === "debit" ? absAmount : null;
        const abono = direction === "credit" ? absAmount : null;

        return {
          rowNumber: index + 1,
          // Keep both generic + expected keys so downstream normalizer/template can pick them.
          date,
          description,
          amount,
          needsReview: true,
          fecha: date,
          descripcion: description,
          cargo: typeof cargo === "number" ? cargo : undefined,
          abono: typeof abono === "number" ? abono : undefined,
          cuotaActual: installment?.cuotaActual ?? null,
          cuotaTotal: installment?.cuotaTotal ?? null,
          installments: installment?.installments ?? null,
          installmentLabel: installment?.installmentLabel ?? null
        } as Record<string, unknown>;
      }) as Array<Record<string, unknown>>;

      const pdfDebug: {
        aiUsed: boolean;
        geminiModel?: string | null;
        geminiApiVersion?: string | null;
        geminiStatus: number | null;
        geminiError: string | null;
        geminiModelDiscovery?: unknown;
        geminiAttempts?: unknown;
        textLength: number;
        geminiBody?: string;
        extractorUsed?: string | null;
        extractorAttempts?: unknown;
        extractorError?: string | null;
      } = {
        aiUsed: false,
        geminiStatus: null,
        geminiError: null,
        textLength: rawText.length,
        extractorUsed: extraction.debug.extractorUsed,
        extractorAttempts: extraction.debug.extractorAttempts,
        extractorError: extraction.debug.extractorError
      };

      // Prefer AI structuring when configured. If not configured or it fails,
      // fall back to deterministic templates + generic line fallback.
      const aiConfigured = Boolean(process.env.GEMINI_API_KEY && input.userKey);
      const aiStatusWarning = aiConfigured
        ? null
        : "La lectura con IA no está configurada todavía. Puedes continuar con detección básica o revisar manualmente antes de guardar.";

      if (aiConfigured) {
        const { structurePdfTextWithAI } = await import("@/server/services/import/import-ai-structurer");
        const ai = await structurePdfTextWithAI({
          workspaceId: input.workspaceId,
          userKey: input.userKey!,
          fileName: input.fileName,
          rawText,
          hintType: input.preferredImportType
        });

        if (ai.ok) {
          pdfDebug.aiUsed = true;
          pdfDebug.geminiModel = ai.debug.geminiModel ?? null;
          pdfDebug.geminiApiVersion = ai.debug.geminiApiVersion ?? null;
          pdfDebug.geminiStatus = ai.debug.geminiStatus;
          pdfDebug.geminiError = ai.debug.geminiError;
          pdfDebug.geminiModelDiscovery = ai.debug.modelDiscovery;
          pdfDebug.geminiAttempts = ai.debug.geminiAttempts;
          if (ai.debug.geminiBody) pdfDebug.geminiBody = ai.debug.geminiBody;

          const transactions = ai.preview.transactions ?? [];
          const dubiousCount = transactions.filter((t) => t.needsReview).length;

          const normalizeSpace = (value: string) =>
            value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();

          const stripLeadingCity = (value: string) => {
            // Remove common city prefixes that often appear in CMR lines (keeps the merchant readable).
            const trimmed = value.trim();
            const cities = [
              "santiago",
              "las condes",
              "providencia",
              "vitacura",
              "nunoa",
              "ñuñoa",
              "maipu",
              "maipú",
              "puente alto",
              "la florida",
              "valparaiso",
              "valparaíso",
              "vina del mar",
              "viña del mar",
              "concepcion",
              "concepción"
            ];
            const lower = trimmed.toLowerCase();
            for (const city of cities) {
              if (lower.startsWith(`${city} `)) {
                return trimmed.slice(city.length).trim();
              }
            }
            return trimmed;
          };

          const isNonTransactional = (text: string, date: string | null, amount: number) => {
            if (date) return false;
            const lower = text.toLowerCase();
            // Summary / header lines in statements
            const hints = [
              "estado de cuenta",
              "resumen",
              "totales",
              "total",
              "pago minimo",
              "pago mínimo",
              "cupo",
              "disponible",
              "usado",
              "utilizado",
              "tasa",
              "interes",
              "interés",
              "comision",
              "comisión",
              "fecha de pago",
              "fecha de cierre",
              "periodo",
              "período",
              "cliente",
              "rut",
              "direccion",
              "dirección"
            ];
            if (hints.some((h) => lower.includes(h))) return true;
            // Also drop lines that look like pure section labels.
            if (text.length <= 24 && /^[A-Z0-9\s.:-]+$/.test(text)) return true;
            // If amount is tiny/zero with no date, it's likely informational.
            if (!Number.isFinite(amount) || amount === 0) return true;
            return false;
          };

          const extractInstallmentFromText = (text: string) => {
            const normalized = text.toLowerCase();

            const ratio = text.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
            if (ratio) {
              const current = Number(ratio[1]);
              const total = Number(ratio[2]);
              if (
                Number.isInteger(current) &&
                Number.isInteger(total) &&
                total > 1 &&
                total <= 48 &&
                current >= 1 &&
                current <= total &&
                !(current === 1 && total === 1)
              ) {
                return {
                  cuotaActual: current,
                  cuotaTotal: total,
                  installmentLabel: `${String(current).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
                  installments: total
                };
              }
            }

            const cuotaDe = normalized.match(/\bcuota\s+(\d{1,2})\s+(?:de|\/)\s+(\d{1,2})\b/);
            if (cuotaDe) {
              const current = Number(cuotaDe[1]);
              const total = Number(cuotaDe[2]);
              if (total > 1 && total <= 48 && current >= 1 && current <= total) {
                return {
                  cuotaActual: current,
                  cuotaTotal: total,
                  installmentLabel: `cuota ${current} de ${total}`,
                  installments: total
                };
              }
            }

            return null;
          };

          const classifyCreditCardKind = (text: string, direction: "debit" | "credit") => {
            const lower = text.toLowerCase();
            if (lower.includes("avance")) return "cash_advance";
            if (lower.includes("interes") || lower.includes("interés")) return "interest";
            if (lower.includes("comision") || lower.includes("comisión")) return "fee";
            if (lower.includes("seguro")) return "insurance";
            if (lower.includes("devol") || lower.includes("revers")) return "refund";
            if (direction === "credit" && (lower.includes("pago") || lower.includes("abono"))) return "payment";
            if (direction === "credit") return "payment";
            return "purchase";
          };

          const scoreRowConfidence = (params: {
            date: string | null;
            description: string;
            amount: number;
            kind: string;
            hasInstallment: boolean;
          }) => {
            if (!params.description || params.description === "Movimiento") {
              return { level: "low" as const, confidence: 0.35 };
            }
            let score = 0;
            if (params.date) score += 1;
            if (Number.isFinite(params.amount) && params.amount !== 0) score += 1;
            if (params.description) score += 1;
            if (params.kind && params.kind !== "other") score += 1;
            if (params.hasInstallment) score += 1;
            if (score >= 4) return { level: "high" as const, confidence: 0.9 };
            if (score === 3) return { level: "medium" as const, confidence: 0.65 };
            return { level: "low" as const, confidence: 0.35 };
          };

          const toYmdFromDmy = (dmy: string) => {
            const match = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!match) return null;
            return `${match[3]}-${match[2]}-${match[1]}`;
          };

          // Build once per preview request (no globals): date+amount index for reconstructing missing merchants.
          const lineIndex = new Map<string, string>();
          for (const line of lines) {
            const dmy = extractDate(line);
            const ymd = dmy ? toYmdFromDmy(dmy) : null;
            if (!ymd) continue;

            // Index by all money-looking tokens on the line, not just the largest one.
            // CMR lines often repeat amounts and include additional figures (e.g., cuota/total).
            const moneyLike = /-?\$?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\)?/g;
            const tokens = Array.from(line.matchAll(moneyLike)).map((m) => m[0]);
            const amounts: number[] = [];
            for (const token of tokens) {
              const parsed = parseChileanAmountToken(token);
              if (typeof parsed === "number" && Number.isFinite(parsed)) {
                amounts.push(Math.round(Math.abs(parsed)));
              }
            }

            // Also include the legacy "best amount" as a backstop.
            const best = extractAmount(line);
            if (typeof best === "number" && Number.isFinite(best)) {
              amounts.push(Math.round(Math.abs(best)));
            }

            for (const absAmt of Array.from(new Set(amounts))) {
              const key = `${ymd}|${absAmt}`;
              if (!lineIndex.has(key)) lineIndex.set(key, line);
            }
          }

          const rows = transactions
            .map((tx, index) => {

              const baseText = normalizeSpace(
                (typeof tx.merchant === "string" && tx.merchant) ||
                  (typeof tx.descriptionRaw === "string" && tx.descriptionRaw) ||
                  ""
              );
              const cleanedText = stripLeadingCity(baseText);
              let merchant = cleanedText.length > 0 ? cleanedText : "Movimiento";

              if (merchant === "Movimiento" && typeof tx.date === "string" && typeof tx.amount === "number") {
                const key = `${tx.date}|${Math.round(Math.abs(tx.amount))}`;
                const matchedLine = lineIndex.get(key) ?? null;
                if (matchedLine) {
                  const lineClean = normalizeSpace(matchedLine);
                  const dmy = extractDate(lineClean);
                  const afterDate = dmy ? lineClean.split(dmy).slice(1).join(dmy).trim() : lineClean;
                  if (afterDate.includes(" T ")) {
                    const between = afterDate.split(" T ")[0]?.trim() ?? "";
                    merchant = stripLeadingCity(between) || merchant;
                  } else {
                    // Fallback: take everything before first amount-like token.
                    const amountToken = lineClean.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?/);
                    if (amountToken?.index != null && amountToken.index > 0) {
                      const beforeAmt = lineClean.slice(0, amountToken.index).trim();
                      const withoutCity = stripLeadingCity(beforeAmt);
                      merchant = dmy ? withoutCity.replace(dmy, "").trim() || merchant : withoutCity || merchant;
                    }
                  }
                }
              }

              const installmentFromText = extractInstallmentFromText(merchant);
              const isInstallmentFromAI =
                tx.installment?.isInstallment === true &&
                typeof tx.installment.installmentTotal === "number" &&
                tx.installment.installmentTotal > 1 &&
                !(
                  tx.installment.installmentCurrent === 1 &&
                  tx.installment.installmentTotal === 1
                );

              const isInstallment = Boolean(isInstallmentFromAI || installmentFromText);
              const effectiveInstallment = installmentFromText
                ? installmentFromText
                : isInstallmentFromAI
                  ? {
                      cuotaActual: tx.installment.installmentCurrent ?? null,
                      cuotaTotal: tx.installment.installmentTotal ?? null,
                      installmentLabel:
                        typeof tx.installment.installmentCurrent === "number" &&
                        typeof tx.installment.installmentTotal === "number"
                          ? `${String(tx.installment.installmentCurrent).padStart(2, "0")}/${String(
                              tx.installment.installmentTotal
                            ).padStart(2, "0")}`
                          : null,
                      installments: tx.installment.installmentTotal ?? null
                    }
                  : null;

              const amount = Math.abs(tx.amount);
              const inferredDirection: "debit" | "credit" =
                tx.direction ??
                (() => {
                  const inferredKind = classifyCreditCardKind(merchant, "debit");
                  return inferredKind === "payment" || inferredKind === "refund" ? "credit" : "debit";
                })();

              const kind = classifyCreditCardKind(merchant, inferredDirection);
              const kindWithInstallment = isInstallment && kind === "purchase" ? "installment_purchase" : kind;

              // Drop non-transactional summary/header lines.
              if (isNonTransactional(merchant, tx.date ?? null, amount)) {
                return null;
              }

              const confidence = scoreRowConfidence({
                date: tx.date ?? null,
                description: merchant,
                amount,
                kind: kindWithInstallment,
                hasInstallment: isInstallment
              });
              const needsReview =
                tx.needsReview === true ||
                confidence.level === "low" ||
                merchant === "Movimiento" ||
                kindWithInstallment === "purchase" && merchant.length < 4;

              return {
                fecha: tx.date ?? null,
                descripcion: merchant,
                descripcionBase: merchant,
                cargo: inferredDirection === "debit" ? amount : undefined,
                abono: inferredDirection === "credit" ? amount : undefined,
                esCompraEnCuotas: isInstallment,
                cuotaActual: isInstallment ? (effectiveInstallment?.cuotaActual ?? null) : null,
                cuotaTotal: isInstallment ? (effectiveInstallment?.cuotaTotal ?? null) : null,
                installments: isInstallment ? (effectiveInstallment?.installments ?? null) : null,
                installmentLabel: isInstallment ? (effectiveInstallment?.installmentLabel ?? null) : null,
                montoCuota: isInstallment ? tx.installment.installmentAmount : null,
                montoTotalCompra: isInstallment ? tx.installment.originalAmount : null,
                cuotasRestantes: isInstallment ? tx.installment.installmentsRemaining : null,
                __aiKind: "pdf-ai",
                __aiType: kindWithInstallment,
                __aiNeedsReview: needsReview,
                __aiRaw: tx.descriptionRaw,
                __aiIndex: index + 1,
                __aiConfidence: confidence.confidence
              } as Record<string, unknown>;
            })
            .filter((row): row is Record<string, unknown> => Boolean(row));

          const missingFields: string[] = [];
          if (!ai.preview.statementDate) missingFields.push("fecha de facturación/cierre");
          if (!ai.preview.dueDate) missingFields.push("fecha de vencimiento/pago");
          if (ai.preview.documentType === "credit_card_statement" && ai.preview.creditLimitTotal == null) {
            missingFields.push("cupo total");
          }

          parsed = {
            parser: "pdf",
            rows: rows.length === 0 ? rowsFallback : rows,
            headers: ["fecha", "descripcion", "cargo", "abono"],
            warnings: ai.warnings,
            supported: (rows.length === 0 ? rowsFallback : rows).length > 0,
            meta: {
              kind: "ai-pdf-import",
              statement: {
                institution: ai.preview.issuer ?? "Desconocido",
                brand: ai.preview.issuer?.toLowerCase().includes("falabella") ? "CMR" : null,
                cardLabel: ai.preview.accountName ?? "Tarjeta",
                closingDate: ai.preview.statementDate,
                paymentDate: ai.preview.dueDate,
                totalBilled: ai.preview.billedTotal,
                minimumDue: ai.preview.minimumPayment,
                creditLimit: ai.preview.creditLimitTotal,
                creditUsed: ai.preview.creditLimitUsed,
                creditAvailable: ai.preview.creditLimitAvailable,
                parserConfidence: ai.confidence,
                parsedMovements: (rows.length === 0 ? rowsFallback : rows).length,
                dubiousMovements: dubiousCount,
                missingFields,
                aiFallbackRecommended: ai.preview.summaryNeedsReview === true
              }
            }
          };

          // attach debug (plain JSON)
          (parsed as unknown as Record<string, unknown>).debug = pdfDebug;
        } else {
          pdfDebug.aiUsed = true;
          pdfDebug.geminiModel = ai.debug.geminiModel ?? null;
          pdfDebug.geminiApiVersion = ai.debug.geminiApiVersion ?? null;
          pdfDebug.geminiStatus = ai.debug.geminiStatus;
          pdfDebug.geminiError =
            ai.debug.geminiError ?? `${ai.error}: ${ai.message}`;
          pdfDebug.geminiModelDiscovery = ai.debug.modelDiscovery;
          pdfDebug.geminiAttempts = ai.debug.geminiAttempts;
          if (ai.debug.geminiBody) pdfDebug.geminiBody = ai.debug.geminiBody;

          console.warn("previewImportFile AI structuring failed; falling back", {
            fileName: input.fileName,
            error: ai.error,
            message: ai.message
          });
        }
      }

      if (!parsed) {
        const { tryParseFalabellaCmrPdf } = await import("@/server/services/import/pdf-templates/falabella-cmr");
        const falabella = tryParseFalabellaCmrPdf(lines);
        if (falabella && falabella.rows.length > 0) {
          parsed = {
            parser: "pdf",
            rows: falabella.rows,
            headers: ["fecha", "descripcion", "cargo", "abono"],
            warnings: [aiStatusWarning, ...falabella.warnings].filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0
            ),
            supported: falabella.rows.length > 5,
            meta: {
              kind: "falabella-cmr",
              statement: falabella.meta
            }
          };
          (parsed as unknown as Record<string, unknown>).debug = pdfDebug;
        } else {
          parsed = {
            parser: "pdf",
            rows: rowsFallback.length > 0 ? rowsFallback : lines.map((line, i) => ({ rowNumber: i + 1, description: line, needsReview: true })),
            headers: ["date", "description", "amount"],
            warnings: [
              aiStatusWarning,
              "No se pudo estructurar automáticamente este PDF. Puedes revisar y editar manualmente los movimientos antes de guardar."
            ].filter((v): v is string => typeof v === "string" && v.trim().length > 0),
            supported: (rowsFallback.length > 0 ? rowsFallback : lines).length > 0
          };
          (parsed as unknown as Record<string, unknown>).debug = pdfDebug;
        }
      }

      // Final backstop: never return a PDF preview with zero rows if we had text.
      if (parsed && parsed.parser === "pdf" && Array.isArray(parsed.rows) && parsed.rows.length === 0) {
        parsed.rows = rowsFallback;
        parsed.headers = ["date", "description", "amount"];
        parsed.supported = rowsFallback.length > 0;
      }
    }
  }

  if (!parsed) {
    let parseImportFile: (typeof import("@/server/services/import/import-parser"))["parseImportFile"];

    try {
      const parserModule = await import("@/server/services/import/import-parser");
      parseImportFile = parserModule.parseImportFile;
    } catch (error) {
      console.error("previewImportFile parser module load failed", {
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytesLength: input.bytes.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }

    try {
      parsed = await parseImportFile({
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytes: input.bytes
      });
    } catch (error) {
      console.error("previewImportFile parse failed", {
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytesLength: input.bytes.length,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  console.log("previewImportFile parsed", {
    parser: parsed.parser,
    supported: parsed.supported,
    warnings: parsed.warnings.length,
    rows: parsed.rows.length,
    hasMeta: Boolean(parsed.meta)
  });

  // From here on, we enrich preview with templates, suggestions and duplicate detection.
  // None of that should be able to break the preview (especially for PDFs). If anything fails,
  // we still return a minimal editable preview from the parsed rows.
  let availableTemplates: Awaited<ReturnType<typeof listWorkspaceAwareImportTemplates>> = [];
  let templateDetection:
    | ReturnType<typeof detectImportTemplate>
    | {
      detectedTemplate: null;
      mode: "none";
      confidence: number;
    } = { detectedTemplate: null, mode: "none", confidence: 0 };

  try {
    availableTemplates = await listWorkspaceAwareImportTemplates({
      workspaceId: input.workspaceId,
      parser: parsed.parser
    });

    // If the PDF is (or was detected as) Falabella/CMR, never apply a Banco de Chile cartola template by accident.
    // Force the Falabella template unless the user explicitly selected another one.
    let effectiveSelectedTemplateId = input.selectedTemplateId;
    if (!effectiveSelectedTemplateId && parsed.parser === "pdf" && parsed.meta && typeof parsed.meta === "object") {
      const meta = parsed.meta as Record<string, unknown>;
      const kind = meta.kind;
      const statement = meta.statement as Record<string, unknown> | undefined;
      const institution = typeof statement?.institution === "string" ? statement.institution.toLowerCase() : "";
      const brand = typeof statement?.brand === "string" ? statement.brand.toLowerCase() : "";
      const cardLabel = typeof statement?.cardLabel === "string" ? statement.cardLabel.toLowerCase() : "";
      const looksFalabella =
        kind === "falabella-cmr" ||
        kind === "ai-pdf-import" && (institution.includes("falabella") || brand.includes("cmr") || cardLabel.includes("cmr"));
      if (looksFalabella && availableTemplates.some((t) => t.id === "falabella-cmr-pdf")) {
        effectiveSelectedTemplateId = "falabella-cmr-pdf";
      }
    }

    templateDetection = detectImportTemplate({
      parser: parsed.parser,
      fileName: input.fileName,
      headers: parsed.headers,
      templates: availableTemplates,
      selectedTemplateId: effectiveSelectedTemplateId
    });
  } catch (error) {
    console.error("previewImportFile template enrichment failed; continuing with minimal preview", {
      parser: parsed.parser,
      fileName: input.fileName,
      error: error instanceof Error ? error.message : error
    });
  }

  let references: Awaited<ReturnType<typeof getImportReferenceData>> = {
    categories: [],
    businessUnits: [],
    accounts: []
  };
  try {
    references = await getImportReferenceData(input.workspaceId);
  } catch (error) {
    console.error("previewImportFile reference data load failed; continuing with minimal preview", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : error
    });
  }

  const preferredAccount =
    input.preferredAccountId
      ? references.accounts.find((account) => account.id === input.preferredAccountId) ?? null
      : null;

  if (input.preferredAccountId && !preferredAccount) {
    console.warn("previewImportFile preferred account not found", {
      workspaceId: input.workspaceId,
      preferredAccountId: input.preferredAccountId
    });
  }

  const accountLookup = new Map(
    references.accounts.map((account) => [normalizeLookupKey(account.name), account.id])
  );

  const pdfStatement =
    parsed.parser === "pdf" &&
      parsed.meta &&
      typeof parsed.meta === "object" &&
      (parsed.meta as { kind?: unknown }).kind === "falabella-cmr"
      ? (parsed.meta as { kind: "falabella-cmr"; statement: unknown }).statement
      : null;

  if (pdfStatement && typeof pdfStatement === "object") {
    const statement = pdfStatement as Record<string, unknown>;
    const cardLabel = typeof statement.cardLabel === "string" ? statement.cardLabel : null;

    if (cardLabel) {
      const normalizedLabel = normalizeLookupKey(cardLabel);

      const candidates = references.accounts.filter((account) => {
        const institution = typeof account.institution === "string" ? account.institution : "";
        const normalizedInstitution = normalizeLookupKey(institution);
        const normalizedName = normalizeLookupKey(account.name);
        const isCredit = String(account.type) === "TARJETA_CREDITO";

        return (
          isCredit &&
          (normalizedInstitution.includes("falabella") ||
            normalizedName.includes("falabella") ||
            normalizedName.includes("cmr"))
        );
      });

      if (
        input.preferredImportType === "credit" &&
        preferredAccount &&
        String(preferredAccount.type) === "TARJETA_CREDITO"
      ) {
        accountLookup.set(normalizedLabel, preferredAccount.id);
      } else if (candidates.length === 1) {
        accountLookup.set(normalizedLabel, candidates[0]!.id);
      }
    }
  }

  const normalizedRows = normalizeImportedRows({
    rows: parsed.rows,
    accountLookup,
    template: templateDetection.detectedTemplate
  });

  let suggestedRows = normalizedRows;
  try {
    const classificationContext = await getClassificationEngineContext(input.workspaceId);
    suggestedRows = applyClassificationSuggestions(normalizedRows, classificationContext);
  } catch (error) {
    console.error("previewImportFile classification suggestions failed; continuing", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : error
    });
  }

  const candidateFingerprints = suggestedRows
    .map((row) => row.duplicateFingerprint)
    .filter((value): value is string => Boolean(value));

  let rows: ImportPreviewRow[] = suggestedRows;
  try {
    const existing = await findTransactionsByFingerprints(input.workspaceId, candidateFingerprints);
    const existingFingerprints = new Set(
      existing
        .map((item) => item.duplicateFingerprint)
        .filter((value): value is string => Boolean(value))
    );

    rows = markDuplicateStatuses(suggestedRows, existingFingerprints);
  } catch (error) {
    console.error("previewImportFile duplicate check failed; continuing", {
      workspaceId: input.workspaceId,
      error: error instanceof Error ? error.message : error
    });
  }

  const summary = {
    totalRows: rows.length,
    readyToImport: rows.filter((row) => row.include && row.issues.length === 0).length,
    duplicates: rows.filter((row) => row.duplicateStatus !== "none").length,
    invalid: rows.filter((row) => row.issues.length > 0).length
  };

  const pdfMeta =
    parsed.parser === "pdf" &&
      parsed.meta &&
      typeof parsed.meta === "object" &&
      ((parsed.meta as { kind?: unknown }).kind === "falabella-cmr" ||
        (parsed.meta as { kind?: unknown }).kind === "ai-pdf-import")
      ? (parsed.meta as { kind: "falabella-cmr" | "ai-pdf-import"; statement: unknown }).statement
      : null;

  let pdfAccountSuggestion: null | {
    mode: "matched" | "missing" | "ambiguous";
    accountId?: string;
    suggestedCreate?: {
      name: string;
      bank: string;
      type: "CREDITO";
      creditLimit?: number | null;
      closingDay?: number | null;
      paymentDay?: number | null;
    };
    candidates?: Array<{ id: string; name: string; institution?: string | null }>;
  } = null;

  if (pdfMeta && typeof pdfMeta === "object") {
    const statement = pdfMeta as Record<string, unknown>;
    const cardLabel = typeof statement.cardLabel === "string" ? statement.cardLabel : "Tarjeta CMR Falabella";
    const creditLimit =
      typeof statement.creditLimit === "number" && Number.isFinite(statement.creditLimit)
        ? statement.creditLimit
        : null;
    const closingDay =
      typeof statement.closingDate === "string"
        ? Number(statement.closingDate.slice(-2))
        : null;
    const paymentDay =
      typeof statement.paymentDate === "string"
        ? Number(statement.paymentDate.slice(-2))
        : null;

    const candidates = references.accounts.filter((account) => {
      const institution = typeof account.institution === "string" ? account.institution : "";
      const normalizedInstitution = normalizeLookupKey(institution);
      const normalizedName = normalizeLookupKey(account.name);
      const isCredit = String(account.type) === "TARJETA_CREDITO";

      return (
        isCredit &&
        (normalizedInstitution.includes("falabella") ||
          normalizedName.includes("falabella") ||
          normalizedName.includes("cmr"))
      );
    });

    if (
      input.preferredImportType === "credit" &&
      preferredAccount &&
      String(preferredAccount.type) === "TARJETA_CREDITO"
    ) {
      pdfAccountSuggestion = { mode: "matched", accountId: preferredAccount.id };
    } else if (candidates.length === 1) {
      pdfAccountSuggestion = { mode: "matched", accountId: candidates[0]!.id };
    } else if (candidates.length > 1) {
      pdfAccountSuggestion = {
        mode: "ambiguous",
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          institution: c.institution ?? null
        }))
      };
    } else {
      pdfAccountSuggestion = {
        mode: "missing",
        suggestedCreate: {
          name: cardLabel,
          bank: "Banco Falabella",
          type: "CREDITO",
          creditLimit,
          closingDay: Number.isFinite(closingDay) ? closingDay : null,
          paymentDay: Number.isFinite(paymentDay) ? paymentDay : null
        }
      };
    }
  }

  // Last-resort safety: if enrichment somehow produced zero rows, fall back to raw parsed rows.
  if (!Array.isArray(rows) || rows.length === 0) {
    rows = buildMinimalPreviewRows(parsed.rows as Array<Record<string, unknown>>);
  }

  return {
    parser: parsed.parser,
    supported: parsed.supported,
    warnings: parsed.warnings,
    debug:
      parsed && typeof parsed === "object" && "debug" in parsed && typeof (parsed as any).debug === "object"
        ? ((parsed as any).debug as unknown)
        : undefined,
    pdfMeta,
    pdfAccountSuggestion,
    appliedTemplate: templateDetection.detectedTemplate
      ? {
        id: templateDetection.detectedTemplate.id,
        name: templateDetection.detectedTemplate.name,
        institution: templateDetection.detectedTemplate.institution,
        sourceType: templateDetection.detectedTemplate.sourceType,
        mode: templateDetection.mode,
        confidence: templateDetection.confidence
      }
      : null,
    availableTemplates: availableTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      institution: template.institution,
      sourceType: template.sourceType,
      isSystem: template.isSystem
    })),
    rows,
    summary,
    references
  };
}

export async function commitImportedTransactions(input: {
  workspaceId: string;
  userKey: string;
  sessionId?: string;
  payload: unknown;
}) {
  const payload = importCommitPayloadSchema.parse(input.payload);
  const includedRows = payload.rows.filter((row) => row.include);

  const parserByPayload = {
    csv: "CSV",
    xlsx: "XLSX",
    pdf: "PDF"
  } as const;

  const preparedRows = includedRows.map((row) => {
    const duplicateFingerprint = buildDuplicateFingerprint({
      date: new Date(`${row.date}T12:00:00`),
      amount: row.amount,
      description: row.description,
      sourceAccountName: row.sourceAccountName
    });

    return {
      ...row,
      duplicateFingerprint
    };
  });

  const primaryAccountId = (() => {
    const counts = new Map<string, number>();

    for (const row of preparedRows) {
      if (!row.accountId) continue;
      counts.set(row.accountId, (counts.get(row.accountId) ?? 0) + 1);
    }

    let best: { id: string; count: number } | null = null;

    for (const [id, count] of counts.entries()) {
      if (!best || count > best.count) best = { id, count };
    }

    if (!best) return null;

    const ratio = best.count / Math.max(1, preparedRows.length);
    return ratio >= 0.8 ? best.id : null;
  })();

  const candidateFingerprints = [...new Set(preparedRows.map((row) => row.duplicateFingerprint))];

  const batch = await prisma.importBatch.create({
    data: {
      workspaceId: input.workspaceId,
      userKey: input.userKey,
      sessionId: input.sessionId,
      fileName: payload.fileName,
      parser: parserByPayload[payload.parser],
      status: "PROCESSING",
      rowsTotal: payload.rows.length,
      rowsIncluded: includedRows.length
    }
  });

  let imported = 0;
  let omitted = 0;
  let duplicates = 0;
  const errors: Array<{ rowId: string; message: string }> = [];

  try {
    await prisma.$transaction(async (db) => {
      const existing = await db.transaction.findMany({
        where: {
          workspaceId: input.workspaceId,
          duplicateFingerprint: {
            in: candidateFingerprints
          }
        },
        select: {
          duplicateFingerprint: true
        }
      });

      const existingFingerprints = new Set(
        existing
          .map((item) => item.duplicateFingerprint)
          .filter((value): value is string => Boolean(value))
      );

      const seenDuringCommit = new Set<string>();

      for (const row of preparedRows) {
        if (seenDuringCommit.has(row.duplicateFingerprint) || existingFingerprints.has(row.duplicateFingerprint)) {
          duplicates += 1;
          omitted += 1;
          continue;
        }

        seenDuringCommit.add(row.duplicateFingerprint);

        try {
          const created = await createTransactionWithAutomation(
            {
              workspaceId: input.workspaceId,
              date: new Date(`${row.date}T12:00:00`),
              description: row.description,
              amount: new Prisma.Decimal(row.amount),
              balance:
                typeof row.balance === "number" && Number.isFinite(row.balance)
                  ? new Prisma.Decimal(row.balance)
                  : undefined,
              type: row.type,
              accountId: row.accountId ?? undefined,
              categoryId: row.categoryId ?? undefined,
              businessUnitId: row.businessUnitId ?? undefined,
              financialOrigin: row.financialOrigin,
              isReimbursable: row.isReimbursable,
              isBusinessPaidPersonally: row.isBusinessPaidPersonally,
              reviewStatus: "PENDIENTE",
              duplicateFingerprint: row.duplicateFingerprint,
              importBatchId: batch.id,
              metadata: {
                import: {
                  parser: payload.parser,
                  fileName: payload.fileName,
                  appliedTemplateId: payload.appliedTemplateId ?? null,
                  sourceAccountName: row.sourceAccountName ?? null,
                  originalRowNumber: row.rowNumber,
                  parserMeta: row.parserMeta ?? null,
                  suggestionMeta: row.suggestionMeta ?? {},
                  classification: row.classification ?? null,
                  debtorName: row.debtorName ?? null,
                  owedAmount: typeof row.owedAmount === "number" ? row.owedAmount : null,
                  debtMeta:
                    row.classification === "PRESTADO"
                      ? {
                        isInstallmentDebt: row.isInstallmentDebt ?? false,
                        installmentCount: row.installmentCount ?? 0,
                        installmentValue: row.installmentValue ?? 0,
                        nextInstallmentDate: row.nextInstallmentDate ?? null,
                        debtNote: row.debtNote ?? null
                      }
                      : null
                }
              }
            },
            db
          );

          if (
            row.classification === "PRESTADO" &&
            row.type === "EGRESO" &&
            typeof row.debtorName === "string" &&
            row.debtorName.trim().length >= 3
          ) {
            const owedAmount =
              typeof row.owedAmount === "number" && Number.isFinite(row.owedAmount) && row.owedAmount > 0
                ? row.owedAmount
                : Math.abs(row.amount);

            const isInstallmentDebt = Boolean(row.isInstallmentDebt);
            const installmentCount =
              isInstallmentDebt && typeof row.installmentCount === "number" && Number.isFinite(row.installmentCount)
                ? Math.max(0, Math.floor(row.installmentCount))
                : 0;
            const installmentValue =
              isInstallmentDebt && typeof row.installmentValue === "number" && Number.isFinite(row.installmentValue)
                ? Math.max(0, row.installmentValue)
                : 0;
            const nextInstallmentDate =
              isInstallmentDebt && row.nextInstallmentDate
                ? new Date(`${row.nextInstallmentDate}T12:00:00`)
                : null;

            await db.debtor.create({
              data: {
                workspaceId: input.workspaceId,
                name: row.debtorName.trim(),
                reason: row.description,
                totalAmount: new Prisma.Decimal(owedAmount),
                paidAmount: new Prisma.Decimal(0),
                startDate: new Date(`${row.date}T12:00:00`),
                estimatedPayDate: null,
                status: DebtorStatus.PENDIENTE,
                isInstallmentDebt,
                installmentCount,
                installmentValue: new Prisma.Decimal(installmentValue),
                paidInstallments: 0,
                installmentFrequency: ExpenseFrequency.MENSUAL,
                nextInstallmentDate,
                notes: row.debtNote ?? null
              }
            });
          }

          imported += 1;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            duplicates += 1;
            omitted += 1;
            continue;
          }

          omitted += 1;
          errors.push({
            rowId: row.id,
            message: error instanceof Error ? error.message : "Error guardando movimiento."
          });
        }
      }

      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "COMPLETED",
          importedCount: imported,
          omittedCount: omitted,
          duplicateCount: duplicates,
          errorCount: errors.length,
          completedAt: new Date(),
          metadata: {
            parser: payload.parser,
            sourceRows: payload.rows.length,
            includedRows: includedRows.length,
            pdf:
              payload.parser === "pdf"
                ? {
                  appliedTemplateId: payload.appliedTemplateId ?? null,
                  meta: (payload.pdfMeta ?? null) as unknown as Prisma.InputJsonValue,
                  warnings: payload.pdfWarnings ?? [],
                  primaryAccountId
                }
                : null,
            creditCardStatement:
              payload.parser === "pdf" &&
                payload.pdfMeta &&
                typeof payload.pdfMeta === "object" &&
                (payload.pdfMeta as Record<string, unknown>).institution === "Banco Falabella"
                ? (() => {
                  const meta = payload.pdfMeta as Record<string, unknown>;

                  const statement = {
                    kind: "falabella-cmr",
                    accountId: primaryAccountId,
                    fileName: payload.fileName,
                    periodStart: typeof meta.billingPeriodStart === "string" ? meta.billingPeriodStart : null,
                    periodEnd: typeof meta.billingPeriodEnd === "string" ? meta.billingPeriodEnd : null,
                    closingDate: typeof meta.closingDate === "string" ? meta.closingDate : null,
                    paymentDate: typeof meta.paymentDate === "string" ? meta.paymentDate : null,
                    totalBilled:
                      typeof meta.totalBilled === "number" && Number.isFinite(meta.totalBilled)
                        ? meta.totalBilled
                        : null,
                    minimumDue:
                      typeof meta.minimumDue === "number" && Number.isFinite(meta.minimumDue)
                        ? meta.minimumDue
                        : null,
                    creditLimit:
                      typeof meta.creditLimit === "number" && Number.isFinite(meta.creditLimit)
                        ? meta.creditLimit
                        : null,
                    creditUsed:
                      typeof meta.creditUsed === "number" && Number.isFinite(meta.creditUsed)
                        ? meta.creditUsed
                        : null,
                    creditAvailable:
                      typeof meta.creditAvailable === "number" && Number.isFinite(meta.creditAvailable)
                        ? meta.creditAvailable
                        : null,
                    parserConfidence:
                      typeof meta.parserConfidence === "number" && Number.isFinite(meta.parserConfidence)
                        ? meta.parserConfidence
                        : null,
                    missingFields: Array.isArray(meta.missingFields) ? meta.missingFields : [],
                    warnings: payload.pdfWarnings ?? [],
                    totals: (() => {
                      const totals: Record<string, number> = {
                        purchases: 0,
                        installmentPurchases: 0,
                        payments: 0,
                        refunds: 0,
                        fees: 0,
                        interests: 0,
                        cashAdvances: 0,
                        taxes: 0,
                        insurance: 0,
                        unknownCharges: 0,
                        unknownCredits: 0
                      };

                      let movementCount = 0;
                      let dubiousCount = 0;

                      for (const r of preparedRows) {
                        movementCount += 1;
                        const parserMeta = r.parserMeta as Record<string, unknown> | undefined;
                        const classifiedAs =
                          typeof parserMeta?.classifiedAs === "string"
                            ? (parserMeta.classifiedAs as string)
                            : "unknown";
                        const isDubious = parserMeta?.dubious === true;

                        if (isDubious) dubiousCount += 1;

                        const amount = r.amount;
                        if (!Number.isFinite(amount)) continue;

                        if (r.type === "EGRESO") {
                          const value = Math.abs(amount);
                          if (classifiedAs === "purchase") totals.purchases += value;
                          else if (classifiedAs === "installment_purchase") totals.installmentPurchases += value;
                          else if (classifiedAs === "fee") totals.fees += value;
                          else if (classifiedAs === "interest") totals.interests += value;
                          else if (classifiedAs === "cash_advance") totals.cashAdvances += value;
                          else if (classifiedAs === "tax") totals.taxes += value;
                          else if (classifiedAs === "insurance") totals.insurance += value;
                          else totals.unknownCharges += value;
                        } else {
                          const value = Math.abs(amount);
                          if (classifiedAs === "payment") totals.payments += value;
                          else if (classifiedAs === "refund") totals.refunds += value;
                          else totals.unknownCredits += value;
                        }
                      }

                      return {
                        ...totals,
                        movementCount,
                        dubiousCount
                      };
                    })()
                  };

                  return statement;
                })()
                : null
          } as unknown as Prisma.InputJsonValue
        }
      });
    });
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        importedCount: imported,
        omittedCount: omitted,
        duplicateCount: duplicates,
        errorCount: errors.length + 1,
        completedAt: new Date(),
        metadata: {
          parser: payload.parser,
          sourceRows: payload.rows.length,
          includedRows: includedRows.length,
          failure: error instanceof Error ? error.message : "Error inesperado en importación."
        }
      }
    });

    throw error;
  }

  await createAdminAuditLog({
    workspaceId: input.workspaceId,
    userKey: input.userKey,
    sessionId: input.sessionId,
    section: "imports",
    action: "transactions.import",
    changedFields: [
      { fieldPath: "fileName", previousValue: null, nextValue: payload.fileName },
      { fieldPath: "importBatchId", previousValue: null, nextValue: batch.id },
      { fieldPath: "imported", previousValue: 0, nextValue: imported },
      { fieldPath: "duplicates", previousValue: 0, nextValue: duplicates }
    ],
    afterData: {
      parser: payload.parser,
      importBatchId: batch.id,
      imported,
      omitted,
      duplicates,
      errors: errors.length
    }
  });

  return {
    importBatchId: batch.id,
    imported,
    omitted,
    duplicates,
    errors
  };
}
