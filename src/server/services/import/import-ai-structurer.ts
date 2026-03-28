import { z } from "zod";
import { createAIProvider } from "@/server/services/ai-provider";
import { getResolvedSettings } from "@/server/services/settings-service";

const aiImportPreviewSchema = z.object({
  documentType: z.enum(["credit_card_statement", "bank_statement", "unknown"]),
  issuer: z.string().nullable(),
  accountName: z.string().nullable(),
  statementDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  billedTotal: z.number().nullable(),
  minimumPayment: z.number().nullable(),
  creditLimitTotal: z.number().nullable(),
  creditLimitUsed: z.number().nullable(),
  creditLimitAvailable: z.number().nullable(),
  currency: z.enum(["CLP", "USD", "UNKNOWN"]),
  summaryNeedsReview: z.boolean(),
  transactions: z
    .array(
      z.object({
        date: z.string().nullable(),
        merchant: z.string(),
        amount: z.number(),
        direction: z.enum(["debit", "credit"]),
        type: z.enum([
          "purchase",
          "payment",
          "refund",
          "fee",
          "interest",
          "cash_advance",
          "other"
        ]),
        categorySuggestion: z.string().nullable(),
        descriptionRaw: z.string().nullable(),
        installment: z.object({
          isInstallment: z.boolean(),
          installmentCurrent: z.number().int().nullable(),
          installmentTotal: z.number().int().nullable(),
          installmentsRemaining: z.number().int().nullable(),
          installmentAmount: z.number().nullable(),
          originalAmount: z.number().nullable()
        }),
        needsReview: z.boolean()
      })
    )
    .default([])
});

export type AiImportPreview = z.infer<typeof aiImportPreviewSchema>;

export type AiStructurePdfResult =
  | {
      ok: true;
      preview: AiImportPreview;
      warnings: string[];
      confidence: number | null;
    }
  | {
      ok: false;
      error: "ai_not_configured" | "ai_failed" | "ai_invalid_response";
      message: string;
    };

function buildJsonSchemaForOpenAI() {
  // Zod -> JSON Schema is overkill here; we keep a minimal compatible schema for response_format.
  // The strict validation happens via Zod after parsing.
  return {
    name: "ai_import_preview",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        documentType: {
          type: "string",
          enum: ["credit_card_statement", "bank_statement", "unknown"]
        },
        issuer: { type: ["string", "null"] },
        accountName: { type: ["string", "null"] },
        statementDate: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"] },
        billedTotal: { type: ["number", "null"] },
        minimumPayment: { type: ["number", "null"] },
        creditLimitTotal: { type: ["number", "null"] },
        creditLimitUsed: { type: ["number", "null"] },
        creditLimitAvailable: { type: ["number", "null"] },
        currency: { type: "string", enum: ["CLP", "USD", "UNKNOWN"] },
        summaryNeedsReview: { type: "boolean" },
        transactions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              date: { type: ["string", "null"] },
              merchant: { type: "string" },
              amount: { type: "number" },
              direction: { type: "string", enum: ["debit", "credit"] },
              type: {
                type: "string",
                enum: ["purchase", "payment", "refund", "fee", "interest", "cash_advance", "other"]
              },
              categorySuggestion: { type: ["string", "null"] },
              descriptionRaw: { type: ["string", "null"] },
              installment: {
                type: "object",
                additionalProperties: false,
                properties: {
                  isInstallment: { type: "boolean" },
                  installmentCurrent: { type: ["integer", "null"] },
                  installmentTotal: { type: ["integer", "null"] },
                  installmentsRemaining: { type: ["integer", "null"] },
                  installmentAmount: { type: ["number", "null"] },
                  originalAmount: { type: ["number", "null"] }
                },
                required: ["isInstallment"]
              },
              needsReview: { type: "boolean" }
            },
            required: ["merchant", "amount", "direction", "type", "installment", "needsReview"]
          }
        }
      },
      required: ["documentType", "currency", "summaryNeedsReview", "transactions"]
    }
  };
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[TRUNCATED ${value.length - maxChars} chars]`;
}

export async function structurePdfTextWithAI(input: {
  workspaceId: string;
  userKey: string;
  fileName: string;
  rawText: string;
  hintType?: "credit" | "account";
}): Promise<AiStructurePdfResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "La importación con IA no está configurada (falta OPENAI_API_KEY)."
    };
  }

  const settings = await getResolvedSettings(input.workspaceId, input.userKey);
  const provider = createAIProvider({
    modelProvider: settings.aiSettings.modelProvider,
    modelName: settings.aiSettings.modelName
  });

  if (provider.kind !== "openai") {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "La importación con IA no está habilitada para este workspace."
    };
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = settings.aiSettings.modelName || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const system = [
    "Eres un motor de extracción de datos para importación de PDFs de finanzas personales (Chile).",
    "Devuelves SOLO JSON válido, sin texto adicional.",
    "No inventes: si un campo no está claro, usa null y marca needsReview=true.",
    "Cuotas: patrones como 03/06, 10/12, 04/12 representan cuotaActual/totalCuotas.",
    "Si el patrón es 01/01, normalmente NO es compra en cuotas real (trátalo como no-cuotas salvo evidencia clara).",
    "Montos: CLP usualmente viene con separador de miles '.' (ej: 5.140.163). Interpreta como número.",
    "Direction: debit = cargo/compra (aumenta deuda), credit = abono/pago/devolución (reduce deuda)."
  ].join("\n");

  const user = [
    `Nombre archivo: ${input.fileName}`,
    `Hint tipo documento: ${input.hintType ?? "unknown"}`,
    "Texto extraído del PDF:",
    truncateText(input.rawText, 18000)
  ].join("\n\n");

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildJsonSchemaForOpenAI()
        }
      })
    });

    if (!res.ok) {
      return {
        ok: false,
        error: "ai_failed",
        message: `La IA no respondió correctamente (${res.status}).`
      };
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "ai_failed", message: "La IA devolvió contenido vacío." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      return { ok: false, error: "ai_invalid_response", message: "La IA no devolvió JSON válido." };
    }

    const preview = aiImportPreviewSchema.parse(parsedJson);

    const warnings: string[] = [];
    if (preview.summaryNeedsReview) warnings.push("La IA marcó el resumen como 'requiere revisión'.");
    const dubiousCount = preview.transactions.filter((t) => t.needsReview).length;
    if (dubiousCount > 0) warnings.push(`Hay ${dubiousCount} movimientos marcados para revisión.`);

    // Confidence here is basic (we can improve later).
    const confidence =
      preview.transactions.length > 0
        ? Math.max(0.2, 1 - dubiousCount / Math.max(1, preview.transactions.length))
        : null;

    return { ok: true, preview, warnings, confidence };
  } catch (error) {
    return {
      ok: false,
      error: "ai_failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

