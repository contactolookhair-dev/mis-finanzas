import { z } from "zod";

const normalizeEnum = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const documentTypeSchema = z.preprocess((value) => {
  const v = normalizeEnum(value);
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (lower === "credit_card_statement" || lower === "bank_statement" || lower === "unknown") return lower;
  if (lower.includes("credit") || lower.includes("tarjeta") || lower.includes("estado de cuenta")) {
    return "credit_card_statement";
  }
  if (lower.includes("cartola") || lower.includes("cuenta") || lower.includes("corriente")) {
    return "bank_statement";
  }
  return "unknown";
}, z.enum(["credit_card_statement", "bank_statement", "unknown"]));

const currencySchema = z.preprocess((value) => {
  const v = normalizeEnum(value);
  if (typeof v !== "string") return v;
  const upper = v.toUpperCase();
  if (upper.includes("CLP") || upper.includes("PESO")) return "CLP";
  if (upper.includes("USD") || upper.includes("DOLAR") || upper.includes("DÓLAR")) return "USD";
  return "UNKNOWN";
}, z.enum(["CLP", "USD", "UNKNOWN"]));

const directionSchema = z.preprocess((value) => {
  const v = normalizeEnum(value);
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (lower === "debit" || lower === "cargo" || lower === "egreso" || lower === "compra") return "debit";
  if (lower === "credit" || lower === "abono" || lower === "ingreso" || lower === "pago") return "credit";
  return "debit";
}, z.enum(["debit", "credit"]));

const txTypeSchema = z.preprocess((value) => {
  const v = normalizeEnum(value);
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (lower === "purchase" || lower === "compra") return "purchase";
  if (lower === "payment" || lower === "pago" || lower === "abono") return "payment";
  if (lower === "refund" || lower.includes("devol")) return "refund";
  if (lower === "fee" || lower.includes("comisi")) return "fee";
  if (lower === "interest" || lower.includes("intere")) return "interest";
  if (lower === "cash_advance" || lower.includes("avance")) return "cash_advance";
  return "other";
}, z.enum(["purchase", "payment", "refund", "fee", "interest", "cash_advance", "other"]));

const aiImportPreviewSchema = z.object({
  documentType: documentTypeSchema.default("unknown"),
  issuer: z.string().nullable().optional().default(null),
  accountName: z.string().nullable().optional().default(null),
  statementDate: z.string().nullable().optional().default(null),
  dueDate: z.string().nullable().optional().default(null),
  billedTotal: z.number().nullable().optional().default(null),
  minimumPayment: z.number().nullable().optional().default(null),
  creditLimitTotal: z.number().nullable().optional().default(null),
  creditLimitUsed: z.number().nullable().optional().default(null),
  creditLimitAvailable: z.number().nullable().optional().default(null),
  currency: currencySchema.default("UNKNOWN"),
  summaryNeedsReview: z.boolean().optional().default(true),
  transactions: z
    .array(
      z.object({
        date: z.string().nullable().optional().default(null),
        merchant: z.string().default(""),
        amount: z.number(),
        direction: directionSchema,
        type: txTypeSchema,
        categorySuggestion: z.string().nullable().optional().default(null),
        descriptionRaw: z.string().nullable().optional().default(null),
        installment: z
          .object({
            isInstallment: z.boolean(),
            installmentCurrent: z.number().int().nullable(),
            installmentTotal: z.number().int().nullable(),
            installmentsRemaining: z.number().int().nullable(),
            installmentAmount: z.number().nullable(),
            originalAmount: z.number().nullable()
          })
          .default({
            isInstallment: false,
            installmentCurrent: null,
            installmentTotal: null,
            installmentsRemaining: null,
            installmentAmount: null,
            originalAmount: null
          }),
        needsReview: z.boolean().optional().default(true)
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
        geminiApiVersion: "v1" | "v1beta" | null;
        geminiStatus: number | null;
        geminiError: string | null;
        geminiBody?: string;
        modelDiscovery?: {
          chosenApiVersion: "v1" | "v1beta" | null;
          chosenCount: number;
          v1?: { ok: boolean; status: number | null; count: number; error?: string };
          v1beta?: { ok: boolean; status: number | null; count: number; error?: string };
        };
      };
    }
  | {
      ok: false;
      error: "ai_not_configured" | "ai_failed" | "ai_invalid_response";
      message: string;
      debug: {
        geminiKeyPresent: boolean;
        geminiModel: string | null;
        geminiApiVersion: "v1" | "v1beta" | null;
        geminiStatus: number | null;
        geminiError: string | null;
        geminiBody?: string;
        modelDiscovery?: {
          chosenApiVersion: "v1" | "v1beta" | null;
          chosenCount: number;
          v1?: { ok: boolean; status: number | null; count: number; error?: string };
          v1beta?: { ok: boolean; status: number | null; count: number; error?: string };
        };
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

type GeminiApiVersion = "v1" | "v1beta";

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const modelCache: Partial<Record<GeminiApiVersion, { fetchedAt: number; models: string[] }>> = {};

type ListModelsResult =
  | { ok: true; apiVersion: GeminiApiVersion; models: string[]; status: number }
  | { ok: false; apiVersion: GeminiApiVersion; models: []; status: number | null; error: string };

async function listGeminiModels(params: { apiKey: string; apiVersion: GeminiApiVersion }): Promise<ListModelsResult> {
  const cached = modelCache[params.apiVersion];
  if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
    return { ok: true, apiVersion: params.apiVersion, models: cached.models, status: 200 };
  }

  const url = `https://generativelanguage.googleapis.com/${params.apiVersion}/models?key=${encodeURIComponent(
    params.apiKey
  )}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.warn("[imports/ai] listModels failed", { api: params.apiVersion, status: res.status, body: bodyText });
      return {
        ok: false,
        apiVersion: params.apiVersion,
        models: [],
        status: res.status,
        error: (bodyText || `HTTP_${res.status}`).slice(0, 1600)
      };
    }

    const payload = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const models =
      payload.models
        ?.filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => String(m.name ?? "").trim())
        .filter(Boolean)
        // API returns names like "models/gemini-..."; we pass only the id part to our URL builder.
        .map((name) => (name.startsWith("models/") ? name.slice("models/".length) : name)) ?? [];

    if (models.length > 0) {
      modelCache[params.apiVersion] = { fetchedAt: Date.now(), models };
      return { ok: true, apiVersion: params.apiVersion, models, status: res.status };
    }

    return {
      ok: false,
      apiVersion: params.apiVersion,
      models: [],
      status: res.status,
      error: "empty_models"
    };
  } catch (error) {
    console.warn("[imports/ai] listModels exception", {
      api: params.apiVersion,
      message: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      apiVersion: params.apiVersion,
      models: [],
      status: null,
      error: error instanceof Error ? error.message : String(error)
    };
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
        geminiApiVersion: null,
        geminiStatus: null,
        geminiError: "missing_api_key"
      }
    };
  }

  // Discover models at runtime for the current API version to avoid hardcoding invalid names.
  // Prefer flash variants for cost/perf.
  let discoveredApiVersion: GeminiApiVersion | null = null;
  let discoveredModels: string[] = [];
  const listV1 = await listGeminiModels({ apiKey, apiVersion: "v1" });
  const listV1beta = await listGeminiModels({ apiKey, apiVersion: "v1beta" });

  if (listV1.ok && listV1.models.length > 0) {
    discoveredApiVersion = "v1";
    discoveredModels = listV1.models;
  } else if (listV1beta.ok && listV1beta.models.length > 0) {
    discoveredApiVersion = "v1beta";
    discoveredModels = listV1beta.models;
  }

  const modelDiscoveryDebug = {
    chosenApiVersion: discoveredApiVersion,
    chosenCount: discoveredModels.length,
    v1: {
      ok: listV1.ok,
      status: listV1.status,
      count: listV1.ok ? listV1.models.length : 0,
      ...(listV1.ok ? { sample: listV1.models.slice(0, 12) } : {}),
      ...(listV1.ok ? {} : { error: listV1.error })
    },
    v1beta: {
      ok: listV1beta.ok,
      status: listV1beta.status,
      count: listV1beta.ok ? listV1beta.models.length : 0,
      ...(listV1beta.ok ? { sample: listV1beta.models.slice(0, 12) } : {}),
      ...(listV1beta.ok ? {} : { error: listV1beta.error })
    }
  } as const;

  const preferFlash = (m: string) => m.toLowerCase().includes("flash");
  const discoveredSorted = discoveredModels.length
    ? [
        ...discoveredModels.filter(preferFlash),
        ...discoveredModels.filter((m) => !preferFlash(m))
      ]
    : [];

  const modelCandidates = [
    process.env.GEMINI_MODEL,
    ...discoveredSorted,
    // Safety net if listModels fails for some reason.
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro"
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
  let geminiApiVersion: GeminiApiVersion | null = null;
  try {
    let lastErrorBody: string | null = null;
    let lastStatus: number | null = null;

    for (const candidateModel of modelsToTry) {
      geminiModel = candidateModel;
      // Prefer v1beta (supports systemInstruction + responseMimeType). Fall back to v1 with a compatible payload.
      const apiVersions: Array<GeminiApiVersion> =
        discoveredApiVersion === "v1" ? ["v1", "v1beta"] : ["v1beta", "v1"];
      let payload: {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      } | null = null;

      let lastHttpBodyText = "";
      let lastHttpStatus: number | null = null;
      let lastApiVersionTried: "v1" | "v1beta" | null = null;

      for (const apiVersion of apiVersions) {
        lastApiVersionTried = apiVersion;
        geminiApiVersion = apiVersion;
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
          candidateModel
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const requestBody =
          apiVersion === "v1beta"
            ? {
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
              }
            : {
                // v1 does not accept systemInstruction/responseMimeType. Merge instructions into user prompt.
                contents: [
                  {
                    role: "user",
                    parts: [{ text: `${system}\n\n${user}` }]
                  }
                ],
                generationConfig: {
                  temperature: 0.1
                }
              };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });

        geminiStatus = res.status;
        lastStatus = res.status;
        lastHttpStatus = res.status;
        console.log("[imports/ai] gemini status:", res.status, "model:", candidateModel, "api:", apiVersion);

      if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          lastHttpBodyText = bodyText;
          lastErrorBody = bodyText || `HTTP_${res.status}`;
          if (includeDevBody) {
            console.log("[imports/ai] gemini error body:", bodyText);
          }

          // If this API version isn't available (or model not found), try next apiVersion/model.
          const bodyLower = bodyText.toLowerCase();
          const shouldRetry =
            res.status === 404 ||
            bodyLower.includes("is not found") ||
            bodyLower.includes("not supported") ||
            bodyLower.includes("not found");

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
              geminiApiVersion: apiVersion,
              geminiStatus: res.status,
              geminiError: bodyText ? bodyText.slice(0, 1200) : `HTTP_${res.status}`,
              geminiBody: includeDevBody ? bodyText : undefined,
              modelDiscovery: modelDiscoveryDebug
            }
          };
        }

        payload = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        break;
      }

      if (!payload) {
        return {
          ok: false,
          error: "ai_failed",
          message: `Gemini respondió error (${lastHttpStatus ?? "unknown"}).`,
          debug: {
            geminiKeyPresent,
            geminiModel: candidateModel,
            geminiApiVersion: lastApiVersionTried,
            geminiStatus: lastHttpStatus,
            geminiError: (lastHttpBodyText || lastErrorBody || "unknown_error").slice(0, 1200),
            modelDiscovery: modelDiscoveryDebug
          }
        };
      }

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
            geminiApiVersion,
            geminiStatus,
            geminiError: "invalid_json",
            geminiBody: includeDevBody ? geminiBody : undefined,
            modelDiscovery: modelDiscoveryDebug
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
          geminiApiVersion,
          geminiStatus,
          geminiError: null,
          geminiBody: includeDevBody ? geminiBody : undefined,
          modelDiscovery: modelDiscoveryDebug
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
        geminiApiVersion,
        geminiStatus: lastStatus,
        geminiError: (lastErrorBody ?? "unknown_error").slice(0, 1200),
        modelDiscovery: modelDiscoveryDebug
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
        geminiApiVersion,
        geminiStatus,
        geminiError: errMessage,
        geminiBody: includeDevBody ? geminiBody : undefined,
        modelDiscovery: modelDiscoveryDebug
      }
    };
  }
}
