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
        .filter(Boolean);

      // Prefer AI structuring when configured. If not configured or it fails,
      // fall back to deterministic templates + generic line fallback.
      const canUseAI = Boolean(process.env.OPENAI_API_KEY && input.userKey);
      if (canUseAI) {
        const { structurePdfTextWithAI } = await import("@/server/services/import/import-ai-structurer");
        const ai = await structurePdfTextWithAI({
          workspaceId: input.workspaceId,
          userKey: input.userKey!,
          fileName: input.fileName,
          rawText,
          hintType: input.preferredImportType
        });

        if (ai.ok) {
          const transactions = ai.preview.transactions ?? [];
          const dubiousCount = transactions.filter((t) => t.needsReview).length;

          const rows = transactions.map((tx, index) => {
            const amount = Math.abs(tx.amount);
            const isInstallment =
              tx.installment?.isInstallment === true &&
              typeof tx.installment.installmentTotal === "number" &&
              tx.installment.installmentTotal > 1 &&
              !(
                tx.installment.installmentCurrent === 1 &&
                tx.installment.installmentTotal === 1
              );

            return {
              fecha: tx.date ?? null,
              descripcion: tx.merchant,
              descripcionBase: tx.merchant,
              cargo: tx.direction === "debit" ? amount : undefined,
              abono: tx.direction === "credit" ? amount : undefined,
              esCompraEnCuotas: isInstallment,
              cuotaActual: isInstallment ? tx.installment.installmentCurrent : null,
              cuotaTotal: isInstallment ? tx.installment.installmentTotal : null,
              montoCuota: isInstallment ? tx.installment.installmentAmount : null,
              montoTotalCompra: isInstallment ? tx.installment.originalAmount : null,
              cuotasRestantes: isInstallment ? tx.installment.installmentsRemaining : null,
              __aiKind: "pdf-ai",
              __aiType: tx.type,
              __aiNeedsReview: tx.needsReview,
              __aiRaw: tx.descriptionRaw,
              __aiIndex: index + 1,
              __aiConfidence: ai.confidence
            } as Record<string, unknown>;
          });

          const missingFields: string[] = [];
          if (!ai.preview.statementDate) missingFields.push("fecha de facturación/cierre");
          if (!ai.preview.dueDate) missingFields.push("fecha de vencimiento/pago");
          if (ai.preview.documentType === "credit_card_statement" && ai.preview.creditLimitTotal == null) {
            missingFields.push("cupo total");
          }

          parsed = {
            parser: "pdf",
            rows,
            headers: ["fecha", "descripcion", "cargo", "abono"],
            warnings: ai.warnings,
            supported: rows.length > 0,
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
                parsedMovements: rows.length,
                dubiousMovements: dubiousCount,
                missingFields,
                aiFallbackRecommended: ai.preview.summaryNeedsReview === true
              }
            }
          };
        } else {
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
            warnings: falabella.warnings,
            supported: falabella.rows.length > 5,
            meta: {
              kind: "falabella-cmr",
              statement: falabella.meta
            }
          };
        } else {
          parsed = {
            parser: "pdf",
            rows: lines.map((line, i) => ({ id: i, raw: line, description: line })),
            headers: ["raw"],
            warnings: [
              "No se pudo estructurar automáticamente este PDF. Puedes revisar y editar manualmente los movimientos antes de guardar."
            ],
            supported: true
          };
        }
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
