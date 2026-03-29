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
      debug: {
        geminiKeyPresent: boolean;
        geminiModel: string | null;
        geminiStatus: number | null;
        geminiError: string | null;
        geminiBody?: string;
      };
    }
  | {
      ok: false;
      error: "ai_not_configured" | "ai_failed" | "ai_invalid_response";
      message: string;
      debug: {
        geminiKeyPresent: boolean;
        geminiModel: string | null;
        geminiStatus: number | null;
        geminiError: string | null;
        geminiBody?: string;
      };
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
  const apiKey = process.env.GEMINI_API_KEY;
  const geminiKeyPresent = Boolean(apiKey);
  const includeDevBody = process.env.NODE_ENV !== "production";

  // Always log presence of key (safe) for quick diagnosis.
  console.log("[imports/ai] gemini key present:", geminiKeyPresent);

  if (!apiKey) {
    return {
      ok: false,
      error: "ai_not_configured",
      message: "La lectura inteligente no está configurada todavía (falta GEMINI_API_KEY).",
      debug: {
        geminiKeyPresent: false,
        geminiModel: null,
        geminiStatus: null,
        geminiError: "missing_api_key"
      }
    };
  }

  const modelCandidates = [
    process.env.GEMINI_MODEL,
    // Keep in sync with financial-insights-service defaults
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash"
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());

  const modelsToTry = Array.from(new Set(modelCandidates));

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

  let geminiStatus: number | null = null;
  let geminiBody: string | undefined;
  let geminiModel: string | null = null;
  try {
    let lastErrorBody: string | null = null;
    let lastStatus: number | null = null;

    for (const candidateModel of modelsToTry) {
      geminiModel = candidateModel;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        candidateModel
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
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
            responseMimeType: "application/json"
          }
        })
      });

      geminiStatus = res.status;
      lastStatus = res.status;
      console.log("[imports/ai] gemini status:", res.status, "model:", candidateModel);

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        lastErrorBody = bodyText || `HTTP_${res.status}`;
        if (includeDevBody) {
          console.log("[imports/ai] gemini error body:", bodyText);
        }

        // Retry on "model not found/unsupported" errors, otherwise fail fast.
        const shouldRetry =
          res.status === 404 ||
          bodyText.toLowerCase().includes("is not found") ||
          bodyText.toLowerCase().includes("not supported");
        if (shouldRetry) {
          continue;
        }

        return {
          ok: false,
          error: "ai_failed",
          message: `Gemini respondió error (${res.status}).`,
          debug: {
            geminiKeyPresent,
            geminiModel: candidateModel,
            geminiStatus: res.status,
            geminiError: bodyText ? bodyText.slice(0, 1200) : `HTTP_${res.status}`,
            geminiBody: includeDevBody ? bodyText : undefined
          }
        };
      }

      const payload = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const content = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
      if (includeDevBody) {
        geminiBody = content.slice(0, 8000);
      }
      const parsedJson = typeof content === "string" ? tryParseLooseJson(content) : null;
      if (!parsedJson) {
        return {
          ok: false,
          error: "ai_invalid_response",
          message: "La IA no devolvió JSON válido.",
          debug: {
            geminiKeyPresent,
            geminiModel: candidateModel,
            geminiStatus,
            geminiError: "invalid_json",
            geminiBody: includeDevBody ? geminiBody : undefined
          }
        };
      }

      const preview = aiImportPreviewSchema.parse(parsedJson);

      const warnings: string[] = [];
      if (preview.summaryNeedsReview) warnings.push("La IA marcó el resumen como 'requiere revisión'.");
      const dubiousCount = preview.transactions.filter((t) => t.needsReview).length;
      if (dubiousCount > 0) warnings.push(`Hay ${dubiousCount} movimientos marcados para revisión.`);

      const confidence =
        preview.transactions.length > 0
          ? Math.max(0.2, 1 - dubiousCount / Math.max(1, preview.transactions.length))
          : null;

      return {
        ok: true,
        preview,
        warnings,
        confidence,
        debug: {
          geminiKeyPresent,
          geminiModel: candidateModel,
          geminiStatus,
          geminiError: null,
          geminiBody: includeDevBody ? geminiBody : undefined
        }
      };
    }

    // Exhausted model list
    return {
      ok: false,
      error: "ai_failed",
      message: `Gemini respondió error (${lastStatus ?? "unknown"}).`,
      debug: {
        geminiKeyPresent,
        geminiModel,
        geminiStatus: lastStatus,
        geminiError: lastErrorBody ? lastErrorBody.slice(0, 1200) : "unknown_error"
      }
    };

  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : null;
    console.log("[imports/ai] gemini exception:", errMessage);
    if (includeDevBody && errStack) {
      console.log("[imports/ai] gemini exception stack:", errStack);
    }
    return {
      ok: false,
      error: "ai_failed",
      message: errMessage,
      debug: {
        geminiKeyPresent,
        geminiModel,
        geminiStatus,
        geminiError: errMessage,
        geminiBody: includeDevBody ? geminiBody : undefined
      }
    };
  }
}
