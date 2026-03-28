import { z } from "zod";

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

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[TRUNCATED ${value.length - maxChars} chars]`;
}

function tryParseLooseJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Common case: model wraps JSON with extra text or code fences.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(slice) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function structurePdfTextWithAI(input: {
  workspaceId: string;
  userKey: string;
  fileName: string;
  rawText: string;
  hintType?: "credit" | "account";
}): Promise<AiStructurePdfResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "La lectura inteligente no está configurada todavía (falta GEMINI_API_KEY)."
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: user }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            // Ask for strict JSON, then validate with Zod.
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        error: "ai_failed",
        message: `La IA no respondió correctamente (${res.status}).`
      };
    }

    const payload = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsedJson = typeof text === "string" ? tryParseLooseJson(text) : null;
    if (!parsedJson) {
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
