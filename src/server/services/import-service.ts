import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { listAccounts } from "@/server/repositories/account-repository";
import { listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { listCategories } from "@/server/repositories/category-repository";
import { createAdminAuditLog } from "@/server/repositories/admin-audit-repository";
import { findTransactionsByFingerprints } from "@/server/repositories/transaction-repository";
import {
  applyClassificationSuggestions,
  getClassificationEngineContext
} from "@/server/services/classification-service";
import { createTransactionWithAutomation } from "@/server/services/transaction-service";
import { parseImportFile } from "@/server/services/import/import-parser";
import { normalizeImportedRows } from "@/server/services/import/import-normalizer";
import { buildDuplicateFingerprint } from "@/server/services/import/import-fingerprint";
import { detectImportTemplate } from "@/server/services/import/import-template-detection";
import { listWorkspaceAwareImportTemplates } from "@/server/services/import/import-template-service";
import { importCommitPayloadSchema, type ImportPreviewRow } from "@/shared/types/imports";
import { DebtorStatus, ExpenseFrequency } from "@prisma/client";

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
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  selectedTemplateId?: string;
}) {
  const parsed = await parseImportFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes
  });
  const availableTemplates = await listWorkspaceAwareImportTemplates({
    workspaceId: input.workspaceId,
    parser: parsed.parser
  });
  const templateDetection = detectImportTemplate({
    parser: parsed.parser,
    fileName: input.fileName,
    headers: parsed.headers,
    templates: availableTemplates,
    selectedTemplateId: input.selectedTemplateId
  });

  const references = await getImportReferenceData(input.workspaceId);
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

  // If the PDF is a Falabella/CMR statement, try to auto-map to an existing credit card account.
  if (pdfStatement && typeof pdfStatement === "object") {
    const statement = pdfStatement as Record<string, unknown>;
    const cardLabel = typeof statement.cardLabel === "string" ? statement.cardLabel : null;
    if (cardLabel) {
      const normalizedLabel = normalizeLookupKey(cardLabel);
      // Map the detected card label to the most likely Falabella credit card account.
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

      if (candidates.length === 1) {
        accountLookup.set(normalizedLabel, candidates[0]!.id);
      }
    }
  }

  const normalizedRows = normalizeImportedRows({
    rows: parsed.rows,
    accountLookup,
    template: templateDetection.detectedTemplate
  });
  const classificationContext = await getClassificationEngineContext(input.workspaceId);
  const suggestedRows = applyClassificationSuggestions(normalizedRows, classificationContext);
  const candidateFingerprints = suggestedRows
    .map((row) => row.duplicateFingerprint)
    .filter((value): value is string => Boolean(value));
  const existing = await findTransactionsByFingerprints(input.workspaceId, candidateFingerprints);
  const existingFingerprints = new Set(
    existing
      .map((item) => item.duplicateFingerprint)
      .filter((value): value is string => Boolean(value))
  );
  const rows = markDuplicateStatuses(suggestedRows, existingFingerprints);

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
    (parsed.meta as { kind?: unknown }).kind === "falabella-cmr"
      ? (parsed.meta as { kind: "falabella-cmr"; statement: unknown }).statement
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
    const closingDay = typeof statement.closingDate === "string"
      ? Number(statement.closingDate.slice(-2))
      : null;
    const paymentDay = typeof statement.paymentDate === "string"
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

    if (candidates.length === 1) {
      pdfAccountSuggestion = { mode: "matched", accountId: candidates[0]!.id };
    } else if (candidates.length > 1) {
      pdfAccountSuggestion = {
        mode: "ambiguous",
        candidates: candidates.map((c) => ({ id: c.id, name: c.name, institution: c.institution ?? null }))
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

  return {
    parser: parsed.parser,
    supported: parsed.supported,
    warnings: parsed.warnings,
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
                  sourceAccountName: row.sourceAccountName ?? null,
                  originalRowNumber: row.rowNumber,
                  suggestionMeta: row.suggestionMeta ?? {},
                  classification: row.classification ?? null,
                  debtorName: row.debtorName ?? null,
                  owedAmount: typeof row.owedAmount === "number" ? row.owedAmount : null,
                  debtMeta: row.classification === "PRESTADO"
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
            includedRows: includedRows.length
          }
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
