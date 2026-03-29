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

function parseChileanMoneyLike(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const negative = raw.includes("(") || raw.startsWith("-");
  const sanitized = raw.replace(/[$()\s]/g, "").replace(/^-/, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized.replace(/\./g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

const moneyLikeNullableSchema = z.preprocess((value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseChileanMoneyLike(value);
  // Make schema tolerant to missing/unknown values; we normalize later.
  return null;
}, z.number().nullable());

const moneyLikeOptionalSchema = moneyLikeNullableSchema.nullable().optional().default(null);

function extractMoneyFromText(value: string) {
  // Pick the largest absolute CL-style token (statements often repeat the same amount).
  const tokenRe = /-?\$?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\)?/g;
  const tokens = Array.from(value.matchAll(tokenRe)).map((m) => m[0]).filter(Boolean);
  let best: number | null = null;
  for (const token of tokens) {
    const parsed = parseChileanMoneyLike(token);
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) continue;
    if (best == null || Math.abs(parsed) > Math.abs(best)) best = parsed;
  }
  return best;
}

function extractMerchantFromStatementLine(value: string) {
  const line = value.replace(/\s+/g, " ").trim();
  if (!line) return "";
  const dateMatch = line.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  if (!dateMatch) return "";

  const afterDate = line.slice((dateMatch.index ?? 0) + dateMatch[0].length).trim();
  if (!afterDate) return "";

  if (afterDate.includes(" T ")) {
    const between = afterDate.split(" T ")[0]?.trim() ?? "";
    return between;
  }

  const amountToken = afterDate.match(/-?\$?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\)?/);
  if (amountToken?.index != null && amountToken.index > 0) {
    return afterDate.slice(0, amountToken.index).trim();
  }

  return "";
}

const aiTransactionSchema = z
  .object({
    date: z.string().nullable().optional().default(null),
    merchant: z.string().default(""),
    merchantName: z.string().nullable().optional().default(null),
    merchant_name: z.string().nullable().optional().default(null),
    description: z.string().nullable().optional().default(null),
    descripcion: z.string().nullable().optional().default(null),
    glosa: z.string().nullable().optional().default(null),
    detalle: z.string().nullable().optional().default(null),
    comercio: z.string().nullable().optional().default(null),
    // Gemini may return different field names for the amount; we normalize post-parse.
    amount: moneyLikeOptionalSchema,
    postedAmount: moneyLikeOptionalSchema,
    chargeAmount: moneyLikeOptionalSchema,
    installmentAmount: moneyLikeOptionalSchema,
    totalAmount: moneyLikeOptionalSchema,
    value: moneyLikeOptionalSchema,
    monto: moneyLikeOptionalSchema,
    direction: directionSchema.optional().default("debit"),
    type: txTypeSchema.optional().default("other"),
    categorySuggestion: z.string().nullable().optional().default(null),
    descriptionRaw: z.string().nullable().optional().default(null),
    installment: z
      .object({
        isInstallment: z.boolean().optional().default(false),
        installmentCurrent: z.number().int().nullable(),
        installmentTotal: z.number().int().nullable(),
        installmentsRemaining: z.number().int().nullable(),
        installmentAmount: moneyLikeOptionalSchema,
        originalAmount: moneyLikeOptionalSchema
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
  .default({
    date: null,
    merchant: "",
    merchantName: null,
    merchant_name: null,
    description: null,
    descripcion: null,
    glosa: null,
    detalle: null,
    comercio: null,
    amount: null,
    postedAmount: null,
    chargeAmount: null,
    installmentAmount: null,
    totalAmount: null,
    value: null,
    monto: null,
    direction: "debit",
    type: "other",
    categorySuggestion: null,
    descriptionRaw: null,
    installment: {
      isInstallment: false,
      installmentCurrent: null,
      installmentTotal: null,
      installmentsRemaining: null,
      installmentAmount: null,
      originalAmount: null
    },
    needsReview: true
  });

const aiImportPreviewSchema = z.object({
  documentType: documentTypeSchema.default("unknown"),
  issuer: z.string().nullable().optional().default(null),
  accountName: z.string().nullable().optional().default(null),
  statementDate: z.string().nullable().optional().default(null),
  dueDate: z.string().nullable().optional().default(null),
  billedTotal: moneyLikeOptionalSchema,
  minimumPayment: moneyLikeOptionalSchema,
  creditLimitTotal: moneyLikeOptionalSchema,
  creditLimitUsed: moneyLikeOptionalSchema,
  creditLimitAvailable: moneyLikeOptionalSchema,
  currency: currencySchema.default("UNKNOWN"),
  summaryNeedsReview: z.boolean().optional().default(true),
  transactions: z.array(aiTransactionSchema).default([])
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
        geminiAttempts?: Array<{
          model: string;
          apiVersion: "v1" | "v1beta";
          status: number;
          ok: boolean;
          errorSnippet?: string;
        }>;
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
        geminiAttempts?: Array<{
          model: string;
          apiVersion: "v1" | "v1beta";
          status: number;
          ok: boolean;
          errorSnippet?: string;
        }>;
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

function normalizeAiPreview(preview: AiImportPreview) {
  const debug = process.env.DEBUG_IMPORT_PREVIEW === "true";

  const normalizedTransactions = preview.transactions.map((tx, idx) => {
    const candidates: Array<{ key: string; value: number | null }> = [
      { key: "amount", value: typeof tx.amount === "number" ? tx.amount : null },
      { key: "postedAmount", value: typeof tx.postedAmount === "number" ? tx.postedAmount : null },
      { key: "chargeAmount", value: typeof tx.chargeAmount === "number" ? tx.chargeAmount : null },
      { key: "installmentAmount", value: typeof tx.installmentAmount === "number" ? tx.installmentAmount : null },
      { key: "totalAmount", value: typeof tx.totalAmount === "number" ? tx.totalAmount : null },
      { key: "value", value: typeof tx.value === "number" ? tx.value : null },
      { key: "monto", value: typeof tx.monto === "number" ? tx.monto : null }
    ];

    const fromField = candidates.find((c) => typeof c.value === "number" && Number.isFinite(c.value)) ?? null;
    let amount: number | null = fromField?.value ?? null;
    let amountSource: string | null = fromField?.key ?? null;

    if (amount == null) {
      const text = [
        typeof tx.descriptionRaw === "string" ? tx.descriptionRaw : "",
        typeof tx.merchant === "string" ? tx.merchant : "",
        typeof tx.description === "string" ? tx.description : "",
        typeof tx.descripcion === "string" ? tx.descripcion : ""
      ]
        .join(" ")
        .trim();
      const fromText = text ? extractMoneyFromText(text) : null;
      if (typeof fromText === "number" && Number.isFinite(fromText)) {
        amount = fromText;
        amountSource = "text";
      }
    }

    const merchantCandidates = [
      { key: "merchant", value: typeof tx.merchant === "string" ? tx.merchant.trim() : "" },
      { key: "merchantName", value: typeof tx.merchantName === "string" ? tx.merchantName.trim() : "" },
      { key: "merchant_name", value: typeof tx.merchant_name === "string" ? tx.merchant_name.trim() : "" },
      { key: "description", value: typeof tx.description === "string" ? tx.description.trim() : "" },
      { key: "descripcion", value: typeof tx.descripcion === "string" ? tx.descripcion.trim() : "" },
      { key: "glosa", value: typeof tx.glosa === "string" ? tx.glosa.trim() : "" },
      { key: "detalle", value: typeof tx.detalle === "string" ? tx.detalle.trim() : "" },
      { key: "comercio", value: typeof tx.comercio === "string" ? tx.comercio.trim() : "" }
    ].filter((c) => c.value.length > 0);

    let merchant = merchantCandidates[0]?.value ?? "";
    let merchantSource = merchantCandidates[0]?.key ?? null;

    if (!merchant) {
      const raw = typeof tx.descriptionRaw === "string" ? tx.descriptionRaw : "";
      const fromLine = raw ? extractMerchantFromStatementLine(raw) : "";
      if (fromLine) {
        merchant = fromLine;
        merchantSource = "descriptionRaw";
      }
    }

    const needsReview = tx.needsReview === true || amount == null || merchant.length === 0;

    if (debug && idx < 10) {
      console.log("[imports/ai] tx normalize", {
        index: idx + 1,
        amountSource,
        amount,
        merchantSource,
        merchant: merchant ? merchant.slice(0, 80) : null,
        descriptionRaw: typeof tx.descriptionRaw === "string" ? tx.descriptionRaw.slice(0, 120) : null
      });
    }

    return { ...tx, merchant, amount, needsReview };
  });

  return { ...preview, transactions: normalizedTransactions };
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
  const attempts: Array<{
    model: string;
    apiVersion: GeminiApiVersion;
    status: number;
    ok: boolean;
    errorSnippet?: string;
  }> = [];
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
          attempts.push({
            model: candidateModel,
            apiVersion,
            status: res.status,
            ok: false,
            errorSnippet: bodyText ? bodyText.slice(0, 400) : undefined
          });
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
              ,
              geminiAttempts: attempts.slice(0, 20)
            }
          };
        }

        attempts.push({
          model: candidateModel,
          apiVersion,
          status: res.status,
          ok: true
        });

        payload = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        break;
      }

      if (!payload) {
        // This model didn't work on any API version. Try the next model.
        continue;
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
            ,
            geminiAttempts: attempts.slice(0, 20)
          }
        };
      }

      const parsed = aiImportPreviewSchema.safeParse(parsedJson);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 10)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
        return {
          ok: false,
          error: "ai_invalid_response",
          message: "La IA devolvió JSON, pero no pasó validación.",
          debug: {
            geminiKeyPresent,
            geminiModel: candidateModel,
            geminiApiVersion,
            geminiStatus,
            geminiError: `zod_validation_failed: ${issues.join(" | ")}`.slice(0, 1200),
            geminiBody: includeDevBody ? geminiBody : undefined,
            modelDiscovery: modelDiscoveryDebug,
            geminiAttempts: attempts.slice(0, 20)
          }
        };
      }

      const preview = normalizeAiPreview(parsed.data);

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
          ,
          geminiAttempts: attempts.slice(0, 20)
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
        ,
        geminiAttempts: attempts.slice(0, 20)
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
        ,
        geminiAttempts: attempts.slice(0, 20)
      }
    };
  }
}
